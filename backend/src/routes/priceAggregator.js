// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

/**
 * @openapi
 * tags:
 *   - name: Price Aggregator
 *     description: Price feed aggregator contract operations
 */

import express from 'express';
import paService from '../services/priceAggregatorService.js';
import { rateLimitMiddleware } from '../middleware/rateLimiter.js';

const router = express.Router();

function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  return missing.length ? missing : null;
}

function sendError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

// ── /initialize ───────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/initialize:
 *   post:
 *     tags: [Price Aggregator]
 *     summary: Initialize the price aggregator contract
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, admin]
 *             properties:
 *               contractId: { type: string }
 *               admin: { type: string }
 *               strategy: { type: string, enum: [Median, WeightedAverage, TrimmedMean] }
 *               maxPriceAge: { type: integer, description: "Seconds before a price is stale (default 3600)" }
 *               outlierBps: { type: integer, description: "Outlier threshold in basis points (default 2000)" }
 *               circuitBreakerBps: { type: integer, description: "Circuit-breaker threshold in basis points (default 5000)" }
 *               minSources: { type: integer, description: "Min valid sources for aggregation (default 1)" }
 *     responses:
 *       200: { description: Contract initialized }
 *       400: { description: Validation error }
 */
router.post('/initialize', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'admin']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);

  const { contractId, admin, strategy, maxPriceAge, outlierBps, circuitBreakerBps, minSources } =
    req.body;
  try {
    const result = await paService.initialize(
      contractId,
      admin,
      strategy ?? null,
      maxPriceAge ?? null,
      outlierBps ?? null,
      circuitBreakerBps ?? null,
      minSources ?? null
    );
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /sources (POST add) ───────────────────────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/sources:
 *   post:
 *     tags: [Price Aggregator]
 *     summary: Register a new price source
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, admin, name, weight]
 *             properties:
 *               contractId: { type: string }
 *               admin: { type: string }
 *               name: { type: string }
 *               weight: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       201: { description: Source added, returns source ID }
 *       400: { description: Validation error }
 */
router.post('/sources', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'admin', 'name', 'weight']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);

  const { contractId, admin, name, weight } = req.body;
  if (!Number.isInteger(weight) || weight < 1 || weight > 100)
    return sendError(res, 400, 'weight must be an integer between 1 and 100');

  try {
    const sourceId = await paService.addSource(contractId, admin, name, weight);
    res.status(201).json({ success: true, data: { sourceId } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /sources/:sourceId (DELETE remove) ───────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/sources/{sourceId}:
 *   delete:
 *     tags: [Price Aggregator]
 *     summary: Deactivate a price source
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, admin]
 *             properties:
 *               contractId: { type: string }
 *               admin: { type: string }
 *     responses:
 *       200: { description: Source removed }
 */
router.delete('/sources/:sourceId', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'admin']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);

  const sourceId = parseInt(req.params.sourceId, 10);
  if (isNaN(sourceId)) return sendError(res, 400, 'sourceId must be an integer');

  const { contractId, admin } = req.body;
  try {
    const result = await paService.removeSource(contractId, admin, sourceId);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /sources/:sourceId/weight ─────────────────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/sources/{sourceId}/weight:
 *   patch:
 *     tags: [Price Aggregator]
 *     summary: Update a source weight
 */
router.patch('/sources/:sourceId/weight', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'admin', 'weight']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);

  const sourceId = parseInt(req.params.sourceId, 10);
  if (isNaN(sourceId)) return sendError(res, 400, 'sourceId must be an integer');

  const { contractId, admin, weight } = req.body;
  if (!Number.isInteger(weight) || weight < 1 || weight > 100)
    return sendError(res, 400, 'weight must be an integer between 1 and 100');

  try {
    const result = await paService.setWeight(contractId, admin, sourceId, weight);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /sources/:sourceId (GET) ──────────────────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/sources/{sourceId}:
 *   get:
 *     tags: [Price Aggregator]
 *     summary: Get a source by ID
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 */
router.get('/sources/:sourceId', async (req, res) => {
  const { contractId } = req.query;
  if (!contractId) return sendError(res, 400, 'contractId query param required');

  const sourceId = parseInt(req.params.sourceId, 10);
  if (isNaN(sourceId)) return sendError(res, 400, 'sourceId must be an integer');

  try {
    const result = await paService.getSource(contractId, sourceId);
    res.json({ success: true, data: result });
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : 500;
    sendError(res, status, err.message);
  }
});

// ── /sources/count ────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/sources/count:
 *   get:
 *     tags: [Price Aggregator]
 *     summary: Get the total number of registered sources
 *     parameters:
 *       - in: query
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 */
router.get('/sources/count', async (req, res) => {
  const { contractId } = req.query;
  if (!contractId) return sendError(res, 400, 'contractId query param required');

  try {
    const count = await paService.getSourceCount(contractId);
    res.json({ success: true, data: { count } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /prices (POST submit) ─────────────────────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/prices:
 *   post:
 *     tags: [Price Aggregator]
 *     summary: Submit a price update from an authorized source
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, sourceAddr, sourceId, asset, price]
 *             properties:
 *               contractId: { type: string }
 *               sourceAddr: { type: string, description: "Stellar address of the source" }
 *               sourceId: { type: integer }
 *               asset: { type: string, description: "Asset pair, e.g. BTC/USD" }
 *               price: { type: string, description: "Price scaled to 18 decimal places" }
 *     responses:
 *       200: { description: Price updated }
 *       400: { description: Validation error }
 */
router.post('/prices', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'sourceAddr', 'sourceId', 'asset', 'price']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);

  const { contractId, sourceAddr, sourceId, asset, price } = req.body;
  if (typeof price !== 'string' && typeof price !== 'number')
    return sendError(res, 400, 'price must be a numeric string or number');

  try {
    const result = await paService.updatePrice(contractId, sourceAddr, sourceId, asset, price);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /prices/:sourceId/:asset (GET single source) ──────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/prices/{sourceId}/{asset}:
 *   get:
 *     tags: [Price Aggregator]
 *     summary: Get the latest price from a single source
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: asset
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 */
router.get('/prices/:sourceId/:asset', async (req, res) => {
  const { contractId } = req.query;
  if (!contractId) return sendError(res, 400, 'contractId query param required');

  const sourceId = parseInt(req.params.sourceId, 10);
  if (isNaN(sourceId)) return sendError(res, 400, 'sourceId must be an integer');

  try {
    const result = await paService.getPrice(contractId, sourceId, req.params.asset);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /prices/aggregated/:asset (GET aggregated) ────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/prices/aggregated/{asset}:
 *   get:
 *     tags: [Price Aggregator]
 *     summary: Get the aggregated price for an asset
 *     parameters:
 *       - in: path
 *         name: asset
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Aggregated price }
 */
router.get('/prices/aggregated/:asset', async (req, res) => {
  const { contractId } = req.query;
  if (!contractId) return sendError(res, 400, 'contractId query param required');

  try {
    const result = await paService.getAggregatedPrice(contractId, req.params.asset);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /strategy ─────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /api/price-aggregator/strategy:
 *   post:
 *     tags: [Price Aggregator]
 *     summary: Change the aggregation strategy
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, admin, strategy]
 *             properties:
 *               contractId: { type: string }
 *               admin: { type: string }
 *               strategy: { type: string, enum: [Median, WeightedAverage, TrimmedMean] }
 */
router.post('/strategy', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'admin', 'strategy']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);

  const { contractId, admin, strategy } = req.body;
  const valid = ['Median', 'WeightedAverage', 'TrimmedMean'];
  if (!valid.includes(strategy))
    return sendError(res, 400, `strategy must be one of: ${valid.join(', ')}`);

  try {
    const result = await paService.setStrategy(contractId, admin, strategy);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

// ── /pause / /unpause / /status ───────────────────────────────────────────────

router.post('/pause', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'admin']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);
  try {
    const result = await paService.pause(req.body.contractId, req.body.admin);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

router.post('/unpause', rateLimitMiddleware('invoke'), async (req, res) => {
  const missing = requireFields(req.body, ['contractId', 'admin']);
  if (missing) return sendError(res, 400, `Missing fields: ${missing.join(', ')}`);
  try {
    const result = await paService.unpause(req.body.contractId, req.body.admin);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

/**
 * @openapi
 * /api/price-aggregator/status:
 *   get:
 *     tags: [Price Aggregator]
 *     summary: Get contract pause status
 *     parameters:
 *       - in: query
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 */
router.get('/status', async (req, res) => {
  const { contractId } = req.query;
  if (!contractId) return sendError(res, 400, 'contractId query param required');
  try {
    const paused = await paService.isPaused(contractId);
    res.json({ success: true, data: { contractId, paused } });
  } catch (err) {
    sendError(res, 500, err.message);
  }
});

export default router;
