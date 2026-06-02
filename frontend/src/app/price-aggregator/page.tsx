"use client";

// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

import React, { useState, useEffect, useCallback } from "react";
import PriceAggregatorDashboard, {
  AggregatedPrice,
  PriceSource,
  Strategy,
} from "../../components/PriceAggregatorDashboard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export default function PriceAggregatorPage() {
  const [contractId, setContractId] = useState(
    process.env.NEXT_PUBLIC_PA_CONTRACT_ID ?? ""
  );
  const [walletAddress] = useState<string | undefined>(undefined);
  const [sources, setSources] = useState<PriceSource[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // For demo purposes – in production derive from wallet
  const isAdmin = true;

  const fetchSources = useCallback(async () => {
    if (!contractId) return;
    setIsLoading(true);
    setError("");
    try {
      const countRes = await fetch(
        `${API_BASE}/api/price-aggregator/sources/count?contractId=${encodeURIComponent(contractId)}`
      );
      const countData = await countRes.json();
      if (!countData.success) throw new Error(countData.error);

      const count: number = countData.data.count;
      const fetched: PriceSource[] = [];
      for (let i = 0; i < count; i++) {
        const res = await fetch(
          `${API_BASE}/api/price-aggregator/sources/${i}?contractId=${encodeURIComponent(contractId)}`
        );
        const data = await res.json();
        if (data.success) {
          const s = data.data;
          fetched.push({ id: s.id, name: s.name, weight: s.weight, active: s.active });
        }
      }
      setSources(fetched);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  const fetchStatus = useCallback(async () => {
    if (!contractId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/price-aggregator/status?contractId=${encodeURIComponent(contractId)}`
      );
      const data = await res.json();
      if (data.success) setIsPaused(data.data.paused);
    } catch {
      // non-critical
    }
  }, [contractId]);

  useEffect(() => {
    fetchSources();
    fetchStatus();
  }, [fetchSources, fetchStatus]);

  const handleAddSource = useCallback(
    async (name: string, weight: number) => {
      const res = await fetch(`${API_BASE}/api/price-aggregator/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, admin: walletAddress, name, weight }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchSources();
    },
    [contractId, walletAddress, fetchSources]
  );

  const handleRemoveSource = useCallback(
    async (sourceId: number) => {
      const res = await fetch(
        `${API_BASE}/api/price-aggregator/sources/${sourceId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId, admin: walletAddress }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchSources();
    },
    [contractId, walletAddress, fetchSources]
  );

  const handleSetWeight = useCallback(
    async (sourceId: number, weight: number) => {
      const res = await fetch(
        `${API_BASE}/api/price-aggregator/sources/${sourceId}/weight`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId, admin: walletAddress, weight }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchSources();
    },
    [contractId, walletAddress, fetchSources]
  );

  const handleUpdatePrice = useCallback(
    async (sourceId: number, asset: string, price: string) => {
      const res = await fetch(`${API_BASE}/api/price-aggregator/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          sourceAddr: walletAddress,
          sourceId,
          asset,
          price,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    [contractId, walletAddress]
  );

  const handleGetAggregated = useCallback(
    async (asset: string): Promise<AggregatedPrice> => {
      const res = await fetch(
        `${API_BASE}/api/price-aggregator/prices/aggregated/${encodeURIComponent(asset)}?contractId=${encodeURIComponent(contractId)}`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as AggregatedPrice;
    },
    [contractId]
  );

  const handleSetStrategy = useCallback(
    async (strategy: Strategy) => {
      const res = await fetch(`${API_BASE}/api/price-aggregator/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, admin: walletAddress, strategy }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    [contractId, walletAddress]
  );

  const handlePause = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/price-aggregator/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, admin: walletAddress }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    setIsPaused(true);
  }, [contractId, walletAddress]);

  const handleUnpause = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/price-aggregator/unpause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, admin: walletAddress }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    setIsPaused(false);
  }, [contractId, walletAddress]);

  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Contract ID (C…)"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            className="flex-1 bg-slate-800 text-white text-sm rounded px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            aria-label="Contract ID"
          />
          <button
            onClick={() => { fetchSources(); fetchStatus(); }}
            className="bg-cyan-700 hover:bg-cyan-600 text-white text-sm px-4 py-2 rounded transition-colors"
            aria-label="Refresh"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div
            className="bg-rose-900/30 border border-rose-700 text-rose-300 text-xs rounded p-3"
            role="alert"
          >
            {error}
          </div>
        )}

        <PriceAggregatorDashboard
          contractId={contractId}
          walletAddress={walletAddress}
          isAdmin={isAdmin}
          isPaused={isPaused}
          sources={sources}
          isLoading={isLoading}
          onAddSource={handleAddSource}
          onRemoveSource={handleRemoveSource}
          onSetWeight={handleSetWeight}
          onUpdatePrice={handleUpdatePrice}
          onGetAggregated={handleGetAggregated}
          onSetStrategy={handleSetStrategy}
          onPause={handlePause}
          onUnpause={handleUnpause}
        />
      </div>
    </main>
  );
}
