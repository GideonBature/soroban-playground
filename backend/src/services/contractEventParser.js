import { xdr, scValToNative } from '@stellar/stellar-sdk';

/**
 * Decodes a base64-encoded Soroban XDR ScVal to a native JS value.
 * Throws on invalid XDR — callers must catch to avoid halting the indexer.
 */
export function decodeScVal(base64XdrStr) {
  return scValToNative(xdr.ScVal.fromXDR(base64XdrStr, 'base64'));
}

/**
 * Parses a raw Soroban RPC event object into a flat, indexable record.
 *
 * Raw event shape from SorobanRpc.Server.getEvents():
 *   { contractId, ledger, topic: string[], value: { xdr: string }, type }
 */
export function parseEvent(raw) {
  const topics = (raw.topic ?? []).map((t) => {
    try {
      return decodeScVal(t);
    } catch {
      return t;
    }
  });

  let value = null;
  if (raw.value?.xdr) {
    try {
      value = decodeScVal(raw.value.xdr);
    } catch {
      value = raw.value.xdr;
    }
  }

  return {
    contractId: raw.contractId,
    ledgerSequence: raw.ledger,
    topics,
    value,
    rawXdr: raw.value?.xdr ?? null,
    eventType: raw.type ?? 'contract',
  };
}

// Decoupled handler registry — register one handler per contract type.
// Use '*' as a wildcard to handle events from any unregistered contract type.
const handlers = new Map();

export function registerHandler(contractType, fn) {
  handlers.set(contractType, fn);
}

export function dispatchEvent(parsed) {
  const type = String(parsed.topics[0] ?? 'unknown');
  const fn = handlers.get(type) ?? handlers.get('*');
  if (fn) {
    try {
      fn(parsed);
    } catch (e) {
      console.error(`Handler error for contract type "${type}":`, e.message);
    }
  }
}
