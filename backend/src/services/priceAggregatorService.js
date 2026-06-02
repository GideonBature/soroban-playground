// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

import { invokeContract } from './invokeService.js';
import cacheService from './cacheService.js';

const CACHE_TTL = 30; // 30 seconds – prices are time-sensitive

export async function initialize(
  contractId,
  admin,
  strategy = null,
  maxPriceAge = null,
  outlierBps = null,
  circuitBreakerBps = null,
  minSources = null
) {
  const args = { admin };
  if (strategy !== null) args.strategy = strategy;
  if (maxPriceAge !== null) args.max_price_age = maxPriceAge;
  if (outlierBps !== null) args.outlier_bps = outlierBps;
  if (circuitBreakerBps !== null) args.circuit_breaker_bps = circuitBreakerBps;
  if (minSources !== null) args.min_sources = minSources;

  return invokeContract({ contractId, functionName: 'initialize', args, network: 'testnet' });
}

export async function addSource(contractId, admin, name, weight) {
  const result = await invokeContract({
    contractId,
    functionName: 'add_source',
    args: { admin, name, weight },
    network: 'testnet',
  });
  await cacheService.del(`pa:sources:${contractId}`);
  return result;
}

export async function removeSource(contractId, admin, sourceId) {
  const result = await invokeContract({
    contractId,
    functionName: 'remove_source',
    args: { admin, source_id: sourceId },
    network: 'testnet',
  });
  await cacheService.del(`pa:sources:${contractId}`);
  await cacheService.del(`pa:source:${contractId}:${sourceId}`);
  return result;
}

export async function setWeight(contractId, admin, sourceId, weight) {
  const result = await invokeContract({
    contractId,
    functionName: 'set_weight',
    args: { admin, source_id: sourceId, weight },
    network: 'testnet',
  });
  await cacheService.del(`pa:source:${contractId}:${sourceId}`);
  return result;
}

export async function setStrategy(contractId, admin, strategy) {
  return invokeContract({
    contractId,
    functionName: 'set_strategy',
    args: { admin, strategy },
    network: 'testnet',
  });
}

export async function updatePrice(contractId, sourceAddr, sourceId, asset, price) {
  const result = await invokeContract({
    contractId,
    functionName: 'update_price',
    args: { source_addr: sourceAddr, source_id: sourceId, asset, price },
    network: 'testnet',
  });
  // Invalidate cached prices for this asset
  await cacheService.del(`pa:price:${contractId}:${sourceId}:${asset}`);
  await cacheService.del(`pa:aggregated:${contractId}:${asset}`);
  return result;
}

export async function getPrice(contractId, sourceId, asset) {
  const cacheKey = `pa:price:${contractId}:${sourceId}:${asset}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await invokeContract({
    contractId,
    functionName: 'get_price',
    args: { source_id: sourceId, asset },
    network: 'testnet',
  });
  await cacheService.set(cacheKey, JSON.stringify(result), CACHE_TTL);
  return result;
}

export async function getAggregatedPrice(contractId, asset) {
  const cacheKey = `pa:aggregated:${contractId}:${asset}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await invokeContract({
    contractId,
    functionName: 'get_aggregated_price',
    args: { asset },
    network: 'testnet',
  });
  await cacheService.set(cacheKey, JSON.stringify(result), CACHE_TTL);
  return result;
}

export async function getSource(contractId, sourceId) {
  const cacheKey = `pa:source:${contractId}:${sourceId}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await invokeContract({
    contractId,
    functionName: 'get_source',
    args: { source_id: sourceId },
    network: 'testnet',
  });
  await cacheService.set(cacheKey, JSON.stringify(result), CACHE_TTL);
  return result;
}

export async function getSourceCount(contractId) {
  const cacheKey = `pa:count:${contractId}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return parseInt(cached, 10);

  const result = await invokeContract({
    contractId,
    functionName: 'get_source_count',
    args: {},
    network: 'testnet',
  });
  await cacheService.set(cacheKey, String(result), CACHE_TTL);
  return result;
}

export async function isPaused(contractId) {
  const cacheKey = `pa:paused:${contractId}`;
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) return cached === 'true';

  const result = await invokeContract({
    contractId,
    functionName: 'is_paused',
    args: {},
    network: 'testnet',
  });
  await cacheService.set(cacheKey, String(result), CACHE_TTL);
  return result;
}

export async function pause(contractId, admin) {
  const result = await invokeContract({
    contractId,
    functionName: 'pause',
    args: { admin },
    network: 'testnet',
  });
  await cacheService.del(`pa:paused:${contractId}`);
  return result;
}

export async function unpause(contractId, admin) {
  const result = await invokeContract({
    contractId,
    functionName: 'unpause',
    args: { admin },
    network: 'testnet',
  });
  await cacheService.del(`pa:paused:${contractId}`);
  return result;
}

export default {
  initialize,
  addSource,
  removeSource,
  setWeight,
  setStrategy,
  updatePrice,
  getPrice,
  getAggregatedPrice,
  getSource,
  getSourceCount,
  isPaused,
  pause,
  unpause,
};
