// Unit tests for the automated secret rotation service (issue #738).
// Covers: encrypted-in-memory storage, atomic swap, rollback on listener
// failure, invalid-credential alerts, source-file reloads, and the periodic
// trigger. The guarded webhook route is covered in credentialRoute.test.js.

import { createRequire } from 'module';

const nodeRequire = createRequire(import.meta.url);
const os = nodeRequire('os');
const fs = nodeRequire('fs/promises');
const path = nodeRequire('path');

const mockAlert = jest.fn();
jest.mock('../src/utils/alerting.js', () => ({
  __esModule: true,
  alertManager: { alert: (...args) => mockAlert(...args) },
  AlertManager: class {},
}));

import { CredentialRotationService } from '../src/services/credentialRotationService.js';

describe('CredentialRotationService', () => {
  let svc;

  beforeEach(() => {
    mockAlert.mockClear();
    svc = new CredentialRotationService().configure({
      encryptionKey: 'unit-test-key',
      initial: { API_KEY: 'secret-value', REDIS_URL: 'redis://old' },
    });
  });

  afterEach(() => svc.stop());

  it('stores credentials encrypted in memory, not as plaintext', () => {
    expect(svc.getCredential('API_KEY')).toBe('secret-value');

    const record = svc.store.get('API_KEY');
    expect(Buffer.isBuffer(record.data)).toBe(true);
    expect(record.data.toString('utf8')).not.toBe('secret-value');
    expect(record.iv).toBeDefined();
    expect(record.tag).toBeDefined();
  });

  it('atomically swaps a credential and refreshes its consumer', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    svc.onRotate('REDIS_URL', refresh);

    const result = await svc.rotate({ REDIS_URL: 'redis://new' });

    expect(result).toEqual({ rotated: ['REDIS_URL'] });
    expect(refresh).toHaveBeenCalledWith('redis://new', 'REDIS_URL');
    expect(svc.getCredential('REDIS_URL')).toBe('redis://new');
    expect(svc.getPreviousCredential('REDIS_URL')).toBe('redis://old');
  });

  it('rolls back to the backup when a consumer refresh fails', async () => {
    const calls = [];
    svc.onRotate('REDIS_URL', (value) => {
      calls.push(value);
      if (value === 'redis://broken') throw new Error('refresh failed');
    });

    await expect(svc.rotate({ REDIS_URL: 'redis://broken' })).rejects.toThrow(
      'refresh failed'
    );

    // Value restored, consumer re-driven with the old value.
    expect(svc.getCredential('REDIS_URL')).toBe('redis://old');
    expect(calls).toEqual(['redis://broken', 'redis://old']);
    expect(mockAlert).toHaveBeenCalledWith(
      'credential_rotation_failed',
      expect.objectContaining({ name: 'REDIS_URL' })
    );
  });

  it('rejects an invalid credential and raises a security alert', async () => {
    await expect(svc.rotate({ API_KEY: '' })).rejects.toThrow(
      'Invalid credential'
    );
    expect(mockAlert).toHaveBeenCalledWith('invalid_credential', {
      name: 'API_KEY',
    });
    // unchanged
    expect(svc.getCredential('API_KEY')).toBe('secret-value');
  });

  it('unsubscribing a listener stops it from firing', async () => {
    const fn = jest.fn();
    const off = svc.onRotate('API_KEY', fn);
    off();
    await svc.rotate({ API_KEY: 'next' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects a non-function listener', () => {
    expect(() => svc.onRotate('API_KEY', 'nope')).toThrow(TypeError);
  });

  it('returns undefined for unknown credentials', () => {
    expect(svc.has('NOPE')).toBe(false);
    expect(svc.getCredential('NOPE')).toBeUndefined();
    expect(svc.getPreviousCredential('NOPE')).toBeUndefined();
  });

  it('start() is a no-op without a configured source/interval', () => {
    expect(svc.start().started).toBe(false);
  });

  it('checkSource() returns null when no source file is configured', async () => {
    expect(await svc.checkSource()).toBeNull();
  });

  it('honors a configured grace period', () => {
    svc.configure({ graceMs: 1234 });
    expect(svc.graceMs).toBe(1234);
  });

  describe('source-file reloads', () => {
    let file;

    beforeEach(async () => {
      file = path.join(os.tmpdir(), `cred-rotation-${process.pid}.json`);
      await fs.writeFile(
        file,
        JSON.stringify({ API_KEY: 'secret-value', REDIS_URL: 'redis://old' })
      );
      svc.configure({ encryptionKey: 'unit-test-key', sourceFile: file });
    });

    afterEach(async () => {
      await fs.rm(file, { force: true });
    });

    it('rotates only changed keys from the source file', async () => {
      await fs.writeFile(
        file,
        JSON.stringify({ API_KEY: 'secret-value', REDIS_URL: 'redis://fresh' })
      );
      const updates = await svc.checkSource();
      expect(updates).toEqual({ REDIS_URL: 'redis://fresh' });
      expect(svc.getCredential('REDIS_URL')).toBe('redis://fresh');
    });

    it('returns null when the source content is unchanged', async () => {
      await svc.checkSource(); // primes the snapshot
      expect(await svc.checkSource()).toBeNull();
    });

    it('alerts and returns null for unparseable source', async () => {
      await fs.writeFile(file, 'not json');
      expect(await svc.checkSource()).toBeNull();
      expect(mockAlert).toHaveBeenCalledWith(
        'invalid_credential',
        expect.objectContaining({ reason: expect.any(String) })
      );
    });

    it('alerts and returns null when the source is unreadable', async () => {
      svc.configure({
        encryptionKey: 'unit-test-key',
        sourceFile: path.join(os.tmpdir(), 'does-not-exist-xyz.json'),
      });
      expect(await svc.checkSource()).toBeNull();
      expect(mockAlert).toHaveBeenCalledWith(
        'credential_source_unreadable',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('starts a periodic poll that invokes checkSource', () => {
      jest.useFakeTimers();
      try {
        const poller = new CredentialRotationService().configure({
          encryptionKey: 'k',
          sourceFile: file,
          intervalMs: 1000,
        });
        const spy = jest.spyOn(poller, 'checkSource').mockResolvedValue(null);
        poller.start();
        expect(poller.started).toBe(true);
        jest.advanceTimersByTime(2500);
        expect(spy).toHaveBeenCalledTimes(2);
        poller.stop();
        expect(poller.started).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
