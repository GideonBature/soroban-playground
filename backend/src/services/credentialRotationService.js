// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

// Automated secret rotation engine (issue #738).
//
// Rotates credentials (database filename/URL, Redis URL, API keys) at runtime
// without a server restart. Credentials live in memory **encrypted** with
// AES-256-GCM; the plaintext only exists transiently inside getCredential().
//
// Rotation is atomic with a backup/fallback: new values are staged and each
// registered consumer (DB pool, Redis client, …) is refreshed in turn; if any
// refresh fails the whole batch is rolled back to the previous credentials and a
// security alert is raised. Reloads are driven either by a periodic check of a
// JSON source file or by an explicit webhook trigger.
//
// SQLite/ioredis stack note: there is no classic connection pool to "drain".
// The DB refresh swaps the module handle and closes the old one after a grace
// period; the Redis refresh swaps the client and quits the old gracefully.

import crypto from 'crypto';
import { alertManager } from '../utils/alerting.js';

const ALGO = 'aes-256-gcm';
const KEY_SALT = 'soroban-credential-rotation';
const DEFAULT_GRACE_MS = 5000;

function deriveKey(secret) {
  return crypto.scryptSync(String(secret), KEY_SALT, 32);
}

function isValidCredential(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export class CredentialRotationService {
  constructor() {
    this.store = new Map(); // name -> { iv, data, tag }
    this.previous = new Map(); // name -> { iv, data, tag } (fallback backup)
    this.listeners = new Map(); // name -> Set<fn>
    this.key = deriveKey(crypto.randomBytes(32).toString('hex'));
    this.sourceFile = null;
    this.intervalMs = 0;
    this.graceMs = DEFAULT_GRACE_MS;
    this.timer = null;
    this.lastSourceSnapshot = null;
    this.started = false;
  }

  /**
   * Configures the encryption key and reload sources, and seeds the initial
   * credential set. Safe to call once at startup.
   */
  configure({ encryptionKey, sourceFile, intervalMs, graceMs, initial } = {}) {
    if (isValidCredential(encryptionKey)) {
      this.key = deriveKey(encryptionKey);
    }
    this.sourceFile = sourceFile || null;
    this.intervalMs = Number(intervalMs) || 0;
    if (Number.isFinite(graceMs)) this.graceMs = graceMs;

    if (initial && typeof initial === 'object') {
      for (const [name, value] of Object.entries(initial)) {
        if (isValidCredential(value))
          this.store.set(name, this._encrypt(value));
      }
    }
    return this;
  }

  _encrypt(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, this.key, iv);
    const data = Buffer.concat([
      cipher.update(String(value), 'utf8'),
      cipher.final(),
    ]);
    return { iv, data, tag: cipher.getAuthTag() };
  }

  _decrypt(record) {
    if (!record) return undefined;
    const decipher = crypto.createDecipheriv(ALGO, this.key, record.iv);
    decipher.setAuthTag(record.tag);
    return Buffer.concat([
      decipher.update(record.data),
      decipher.final(),
    ]).toString('utf8');
  }

  has(name) {
    return this.store.has(name);
  }

  getCredential(name) {
    return this._decrypt(this.store.get(name));
  }

  /** The pre-rotation value, kept for fallback/audit. */
  getPreviousCredential(name) {
    return this._decrypt(this.previous.get(name));
  }

  /**
   * Registers a refresh callback fired whenever `name` is rotated. Returns an
   * unsubscribe function.
   */
  onRotate(name, fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('onRotate expects a function');
    }
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.listeners.get(name)?.delete(fn);
  }

  async _runListeners(name, value) {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of set) {
      await fn(value, name);
    }
  }

  /**
   * Atomically rotates one or more credentials. Stages each new value, refreshes
   * its consumers, and on any failure rolls the whole batch back to the previous
   * credentials and raises a security alert.
   */
  async rotate(updates = {}) {
    const names = Object.keys(updates);

    for (const name of names) {
      if (!isValidCredential(updates[name])) {
        alertManager.alert('invalid_credential', { name });
        throw new Error(`Invalid credential value for "${name}"`);
      }
    }

    const staged = [];
    const backups = new Map();

    try {
      for (const name of names) {
        backups.set(name, this.store.get(name) ?? null);
        this.store.set(name, this._encrypt(updates[name])); // atomic swap
        staged.push(name);
        await this._runListeners(name, updates[name]);
      }

      // Commit: remember the prior values for fallback.
      for (const [name, record] of backups) {
        if (record) this.previous.set(name, record);
      }
      return { rotated: names };
    } catch (err) {
      // Roll back every staged key (including the one whose refresh failed),
      // best-effort refreshing consumers back to the previous value.
      for (const name of staged) {
        const backup = backups.get(name);
        if (backup) {
          this.store.set(name, backup);
          try {
            await this._runListeners(name, this._decrypt(backup));
          } catch {
            // best-effort restoration — the alert below carries the failure
          }
        } else {
          this.store.delete(name);
        }
      }
      alertManager.alert('credential_rotation_failed', {
        name: staged[staged.length - 1] ?? names[0],
        error: err.message,
      });
      throw err;
    }
  }

  /** Starts the periodic source-file poll (no-op unless both are configured). */
  start() {
    if (this.started || !this.intervalMs || !this.sourceFile) return this;
    this.started = true;
    this.timer = setInterval(() => {
      this.checkSource().catch(() => {});
    }, this.intervalMs);
    if (this.timer.unref) this.timer.unref();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
    return this;
  }

  /**
   * Reads the JSON source file and rotates any credential whose value changed.
   * Returns the applied updates, or null when nothing changed / no source.
   */
  async checkSource() {
    if (!this.sourceFile) return null;

    const fs = await import('fs/promises');
    let raw;
    try {
      raw = await fs.readFile(this.sourceFile, 'utf8');
    } catch (err) {
      alertManager.alert('credential_source_unreadable', {
        file: this.sourceFile,
        error: err.message,
      });
      return null;
    }

    if (raw === this.lastSourceSnapshot) return null;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alertManager.alert('invalid_credential', {
        file: this.sourceFile,
        reason: 'source is not valid JSON',
      });
      return null;
    }
    this.lastSourceSnapshot = raw;

    const updates = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (isValidCredential(value) && this.getCredential(name) !== value) {
        updates[name] = value;
      }
    }
    if (Object.keys(updates).length === 0) return null;

    await this.rotate(updates);
    return updates;
  }
}

export const credentialRotationService = new CredentialRotationService();
export default credentialRotationService;
