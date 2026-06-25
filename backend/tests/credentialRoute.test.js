// Tests for the guarded credential rotation webhook (issue #738).

import express from 'express';
import request from 'supertest';

const mockRotate = jest.fn();
const mockCheckSource = jest.fn();
jest.mock('../src/services/credentialRotationService.js', () => ({
  __esModule: true,
  default: {
    rotate: (...a) => mockRotate(...a),
    checkSource: () => mockCheckSource(),
  },
}));

import credentialsRouter from '../src/routes/credentials.js';

describe('POST /api/credentials/rotate', () => {
  let app;
  const prevSecret = process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/credentials', credentialsRouter);
  });

  beforeEach(() => {
    mockRotate.mockReset();
    mockCheckSource.mockReset();
  });

  afterAll(() => {
    process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET = prevSecret;
  });

  it('is disabled (503) when no webhook secret is configured', async () => {
    delete process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET;
    const res = await request(app).post('/api/credentials/rotate').send({});
    expect(res.status).toBe(503);
    expect(mockRotate).not.toHaveBeenCalled();
  });

  it('rejects a request with a wrong token (403)', async () => {
    process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET = 'topsecret';
    const res = await request(app)
      .post('/api/credentials/rotate')
      .set('x-rotation-token', 'wrong')
      .send({});
    expect(res.status).toBe(403);
    expect(mockRotate).not.toHaveBeenCalled();
  });

  it('rotates explicit credentials from the body when authorized', async () => {
    process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET = 'topsecret';
    mockRotate.mockResolvedValue({ rotated: ['REDIS_URL'] });

    const res = await request(app)
      .post('/api/credentials/rotate')
      .set('x-rotation-token', 'topsecret')
      .send({ credentials: { REDIS_URL: 'redis://new' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, rotated: ['REDIS_URL'] });
    expect(mockRotate).toHaveBeenCalledWith({ REDIS_URL: 'redis://new' });
  });

  it('falls back to the source file when no body credentials are given', async () => {
    process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET = 'topsecret';
    mockCheckSource.mockResolvedValue({ API_KEY: 'rotated' });

    const res = await request(app)
      .post('/api/credentials/rotate')
      .set('x-rotation-token', 'topsecret')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, rotated: ['API_KEY'] });
    expect(mockCheckSource).toHaveBeenCalled();
  });

  it('returns 400 when the rotation itself fails', async () => {
    process.env.CREDENTIAL_ROTATION_WEBHOOK_SECRET = 'topsecret';
    mockRotate.mockRejectedValue(new Error('refresh failed'));

    const res = await request(app)
      .post('/api/credentials/rotate')
      .set('x-rotation-token', 'topsecret')
      .send({ credentials: { REDIS_URL: 'redis://x' } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'refresh failed' });
  });
});
