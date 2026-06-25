// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

// Credential rotation webhook (issue #738).
//
// POST /api/credentials/rotate triggers a rotation — either from an explicit
// `credentials` map in the body, or by re-reading the configured source file.
// The endpoint is guarded by a constant-time shared-secret check and is disabled
// (503) unless CREDENTIAL_ROTATION_WEBHOOK_SECRET is configured, so it can never
// be reached by an unauthenticated caller (rotation is a DoS vector).

import express from 'express';
import crypto from 'crypto';
import credentialRotationService from '../services/credentialRotationService.js';

const router = express.Router();

function tokenMatches(provided, expected) {
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  // timingSafeEqual requires equal-length buffers.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/rotate', async (req, res) => {
  const secret = process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET;
  if (!secret) {
    return res
      .status(503)
      .json({ error: 'Credential rotation webhook is not configured' });
  }

  const provided = req.headers['x-rotation-token'] || '';
  if (!tokenMatches(provided, secret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    let rotated;
    if (req.body && typeof req.body.credentials === 'object') {
      const result = await credentialRotationService.rotate(
        req.body.credentials
      );
      rotated = result.rotated;
    } else {
      const updates = await credentialRotationService.checkSource();
      rotated = updates ? Object.keys(updates) : [];
    }
    res.json({ success: true, rotated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
