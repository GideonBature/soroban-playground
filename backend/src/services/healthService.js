import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

import healthConfig from '../config/health.config.js';
import redisService from './redisService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedPackageInfo = null;

function loadPackageInfo() {
  if (cachedPackageInfo) return cachedPackageInfo;

  const candidates = [
    path.join(__dirname, '../../../package.json'),
    path.join(__dirname, '../../package.json'),
  ];

  for (const candidate of candidates) {
    try {
      cachedPackageInfo = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      return cachedPackageInfo;
    } catch {
      // try next candidate
    }
  }

  cachedPackageInfo = {
    version: 'unknown',
    name: 'soroban-playground-backend',
  };
  return cachedPackageInfo;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Health check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (timer.unref) timer.unref();
    }),
  ]);
}

export function getCpuUsage() {
  return os.cpus().map((cpu, index) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return {
      core: index,
      model: cpu.model,
      speedMHz: cpu.speed,
      usedPercent: total > 0 ? +((1 - idle / total) * 100).toFixed(1) : 0,
    };
  });
}

export function getMemoryInfo() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const toMB = (bytes) => +(bytes / 1024 / 1024).toFixed(2);

  return {
    totalMB: toMB(totalBytes),
    freeMB: toMB(freeBytes),
    usedMB: toMB(usedBytes),
    usedPercent: +((usedBytes / totalBytes) * 100).toFixed(1),
  };
}

export function getUptimeInfo() {
  const formatSeconds = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`, `${secs}s`]
      .filter(Boolean)
      .join(' ');
  };

  return {
    processSec: Math.floor(process.uptime()),
    processHuman: formatSeconds(process.uptime()),
    systemSec: Math.floor(os.uptime()),
    systemHuman: formatSeconds(os.uptime()),
  };
}

export function getRuntimeInfo() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
  };
}

export async function checkDatabase() {
  try {
    const { getDatabase } = await import('../database/connection.js');
    const db = getDatabase();
    await withTimeout(
      db.get('SELECT 1 AS ok'),
      healthConfig.dependencyCheckTimeoutMs
    );
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }
}

export async function checkRedis() {
  if (redisService.isFallbackMode) {
    return {
      status: 'degraded',
      message: 'Running in in-memory fallback mode',
    };
  }

  if (!redisService.client) {
    return {
      status: 'disconnected',
      message: 'Redis client not initialized',
    };
  }

  try {
    const pong = await withTimeout(
      redisService.client.ping(),
      healthConfig.dependencyCheckTimeoutMs
    );
    return {
      status: 'ok',
      ping: pong,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
    };
  }
}

export function checkSorobanCli() {
  return new Promise((resolve) => {
    const child = spawn(healthConfig.sorobanCliCommand, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        status: 'error',
        message: `Soroban CLI check timed out after ${healthConfig.dependencyCheckTimeoutMs}ms`,
      });
    }, healthConfig.dependencyCheckTimeoutMs);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        status: 'error',
        message: error.message,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({
          status: 'ok',
          version: output.trim(),
        });
        return;
      }

      resolve({
        status: 'error',
        message: `Soroban CLI exited with code ${code}`,
      });
    });
  });
}

function resolveOverallStatus(memory, dependencies) {
  if (memory.usedPercent > healthConfig.memoryDegradedThresholdPercent) {
    return 'degraded';
  }

  const dependencyStatuses = Object.values(dependencies).map(
    (dependency) => dependency.status
  );
  if (dependencyStatuses.some((status) => status === 'error')) {
    return 'degraded';
  }

  return 'ok';
}

export async function getDependencyChecks() {
  const [database, redis, sorobanCli] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkSorobanCli(),
  ]);

  return { database, redis, sorobanCli };
}

export async function buildHealthPayload() {
  const packageJson = loadPackageInfo();
  const memory = getMemoryInfo();
  const dependencies = await getDependencyChecks();

  return {
    status: resolveOverallStatus(memory, dependencies),
    version: packageJson.version ?? 'unknown',
    service: packageJson.name ?? 'soroban-playground-backend',
    timestamp: new Date().toISOString(),
    uptime: getUptimeInfo(),
    cpu: getCpuUsage(),
    memory,
    runtime: getRuntimeInfo(),
    dependencies,
  };
}

export function buildLivenessPayload() {
  return {
    status: 'ok',
    probe: 'live',
    timestamp: new Date().toISOString(),
    uptime: getUptimeInfo(),
  };
}

export async function buildReadinessPayload() {
  const checks = await getDependencyChecks();
  const ready = checks.database.status === 'ok';

  return {
    status: ready ? 'ready' : 'not_ready',
    probe: 'ready',
    timestamp: new Date().toISOString(),
    checks,
  };
}

export function buildHealthErrorPayload(error) {
  const packageJson = loadPackageInfo();

  return {
    status: 'error',
    version: packageJson.version ?? 'unknown',
    timestamp: new Date().toISOString(),
    error: error.message,
  };
}
