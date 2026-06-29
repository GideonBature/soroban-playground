import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import redisService from './redisService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_dev';
const ACCESS_TOKEN_EXPIRATION_SEC = 15 * 60; // 15 mins
const REFRESH_TOKEN_EXPIRATION_SEC = 7 * 24 * 60 * 60; // 7 days

class AuthService {
  generateTokens(user) {
    const accessTokenJti = uuidv4();
    const refreshTokenJti = uuidv4();
    const familyId = uuidv4();

    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, jti: accessTokenJti },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRATION_SEC }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, familyId, jti: refreshTokenJti, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRATION_SEC }
    );

    return { accessToken, refreshToken, accessTokenJti, refreshTokenJti, familyId };
  }

  async verifyAccessToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if token is blacklisted in Redis
    const isBlacklisted = await redisService.get(`bl_access:${decoded.jti}`);
    if (isBlacklisted) {
      throw new Error('Token is blacklisted');
    }
    return decoded;
  }

  async blacklistAccessToken(jti, exp) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;
    if (ttl > 0) {
      await redisService.set(`bl_access:${jti}`, '1', ttl);
    }
  }

  async rotateRefreshToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new Error('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Check if the refresh token is already used
    const isUsed = await redisService.get(`used_refresh:${decoded.jti}`);
    if (isUsed) {
      // Anomaly detected: Refresh token reuse!
      // Invalidate the entire token family
      await redisService.set(`bl_family:${decoded.familyId}`, '1', REFRESH_TOKEN_EXPIRATION_SEC);
      throw new Error('Refresh token reuse detected. Family invalidated.');
    }

    // Check if the family is blacklisted
    const isFamilyBlacklisted = await redisService.get(`bl_family:${decoded.familyId}`);
    if (isFamilyBlacklisted) {
      throw new Error('Token family is blacklisted due to previous anomaly.');
    }

    // Mark current refresh token as used
    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - now;
    if (ttl > 0) {
      await redisService.set(`used_refresh:${decoded.jti}`, '1', ttl);
    }

    // Issue new tokens
    const newAccessTokenJti = uuidv4();
    const newRefreshTokenJti = uuidv4();

    const newAccessToken = jwt.sign(
      { sub: decoded.sub, jti: newAccessTokenJti },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRATION_SEC }
    );

    const newRefreshToken = jwt.sign(
      { sub: decoded.sub, familyId: decoded.familyId, jti: newRefreshTokenJti, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRATION_SEC }
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }
}

export default new AuthService();
