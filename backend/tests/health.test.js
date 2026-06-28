import express from 'express';
import request from 'supertest';

import healthRouter, { healthHandler } from '../src/routes/health.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRouter);
  app.get('/api/health', healthHandler);
  app.use(errorHandler);
  return app;
}

describe('Health Check and Readiness Probes', () => {
  const testApp = createTestApp();

  it('GET /health returns 200 with system stats', async () => {
    const res = await request(testApp).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('version');
    expect(res.body.data).toHaveProperty('service');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('cpu');
    expect(res.body.data).toHaveProperty('memory');
    expect(res.body.data).toHaveProperty('runtime');
    expect(res.body.data).toHaveProperty('dependencies');
    expect(res.body.data.dependencies).toHaveProperty('database');
    expect(res.body.data.dependencies).toHaveProperty('redis');
    expect(res.body.data.dependencies).toHaveProperty('sorobanCli');
  });

  it('GET /api/health remains backward compatible', async () => {
    const res = await request(testApp).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('memory');
    expect(res.body.data).toHaveProperty('cpu');
  });

  it('GET /health/live returns liveness probe payload', async () => {
    const res = await request(testApp).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.probe).toBe('live');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data).toHaveProperty('uptime');
  });

  it('GET /health/ready returns readiness probe payload', async () => {
    const res = await request(testApp).get('/health/ready');

    expect([200, 503]).toContain(res.status);
    expect(res.body.data.probe).toBe('ready');
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('checks');
    expect(res.body.data.checks).toHaveProperty('database');
    expect(res.body.data.checks).toHaveProperty('redis');
    expect(res.body.data.checks).toHaveProperty('sorobanCli');
  });

  it('reports ok or degraded status based on resource usage', async () => {
    const res = await request(testApp).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(['ok', 'degraded']).toContain(res.body.data.status);
  });
});
