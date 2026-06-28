import express from 'express';

import { asyncHandler } from '../middleware/errorHandler.js';
import {
  buildHealthPayload,
  buildHealthErrorPayload,
  buildLivenessPayload,
  buildReadinessPayload,
} from '../services/healthService.js';

const router = express.Router();

export const healthHandler = asyncHandler(async (_req, res) => {
  try {
    const payload = await buildHealthPayload();
    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: buildHealthErrorPayload(error),
    });
  }
});

export const livenessHandler = asyncHandler(async (_req, res) => {
  return res.status(200).json({ success: true, data: buildLivenessPayload() });
});

export const readinessHandler = asyncHandler(async (_req, res) => {
  const payload = await buildReadinessPayload();
  const statusCode = payload.status === 'ready' ? 200 : 503;
  return res.status(statusCode).json({ success: statusCode === 200, data: payload });
});

router.get('/', healthHandler);
router.get('/live', livenessHandler);
router.get('/ready', readinessHandler);

export default router;
