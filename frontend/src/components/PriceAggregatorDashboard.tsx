"use client";

// Copyright (c) 2026 StellarDevTools
// SPDX-License-Identifier: MIT

import React, { useState, useCallback } from "react";
import {
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  CheckCircle,
  BarChart2,
  Database,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Strategy = "Median" | "WeightedAverage" | "TrimmedMean";

export interface PriceSource {
  id: number;
  name: string;
  weight: number;
  active: boolean;
}

export interface AggregatedPrice {
  asset: string;
  price: string;
  timestamp: number;
  num_sources: number;
  strategy: Strategy;
}

interface Props {
  contractId?: string;
  walletAddress?: string;
  isAdmin: boolean;
  isPaused: boolean;
  sources: PriceSource[];
  isLoading: boolean;
  onAddSource: (name: string, weight: number) => Promise<void>;
  onRemoveSource: (sourceId: number) => Promise<void>;
  onSetWeight: (sourceId: number, weight: number) => Promise<void>;
  onUpdatePrice: (sourceId: number, asset: string, price: string) => Promise<void>;
  onGetAggregated: (asset: string) => Promise<AggregatedPrice>;
  onSetStrategy: (strategy: Strategy) => Promise<void>;
  onPause: () => Promise<void>;
  onUnpause: () => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STRATEGIES: Strategy[] = ["Median", "WeightedAverage", "TrimmedMean"];

const STRATEGY_LABEL: Record<Strategy, string> = {
  Median: "Median",
  WeightedAverage: "Weighted Avg",
  TrimmedMean: "Trimmed Mean",
};

function formatPrice(raw: string | number): string {
  const n = BigInt(raw);
  const scale = BigInt("1000000000000000000");
  const whole = n / scale;
  const frac = n % scale;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr.slice(0, 6)}` : whole.toString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ paused }: { paused: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
        paused ? "bg-rose-900/40 text-rose-300" : "bg-emerald-900/40 text-emerald-300"
      }`}
      aria-live="polite"
    >
      {paused ? <PauseCircle size={10} aria-hidden /> : <CheckCircle size={10} aria-hidden />}
      {paused ? "Paused" : "Active"}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PriceAggregatorDashboard({
  contractId,
  walletAddress,
  isAdmin,
  isPaused,
  sources,
  isLoading,
  onAddSource,
  onRemoveSource,
  onSetWeight,
  onUpdatePrice,
  onGetAggregated,
  onSetStrategy,
  onPause,
  onUnpause,
}: Props) {
  const [activeTab, setActiveTab] = useState<"prices" | "sources" | "admin">("prices");

  // Price lookup
  const [queryAsset, setQueryAsset] = useState("BTC/USD");
  const [aggregated, setAggregated] = useState<AggregatedPrice | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");

  // Price submission
  const [submitSourceId, setSubmitSourceId] = useState("");
  const [submitAsset, setSubmitAsset] = useState("BTC/USD");
  const [submitPrice, setSubmitPrice] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");

  // Add source
  const [newName, setNewName] = useState("");
  const [newWeight, setNewWeight] = useState(50);
  const [addMsg, setAddMsg] = useState("");

  // Strategy
  const [stratMsg, setStratMsg] = useState("");

  const handleGetAggregated = useCallback(async () => {
    if (!queryAsset.trim()) return;
    setPriceLoading(true);
    setPriceError("");
    try {
      const result = await onGetAggregated(queryAsset.trim());
      setAggregated(result);
    } catch (e: unknown) {
      setPriceError(e instanceof Error ? e.message : "Failed to fetch price");
      setAggregated(null);
    } finally {
      setPriceLoading(false);
    }
  }, [queryAsset, onGetAggregated]);

  const handleSubmitPrice = useCallback(async () => {
    const sid = parseInt(submitSourceId, 10);
    if (isNaN(sid) || !submitAsset.trim() || !submitPrice.trim()) return;
    setSubmitMsg("");
    try {
      await onUpdatePrice(sid, submitAsset.trim(), submitPrice.trim());
      setSubmitMsg("✓ Price submitted");
    } catch (e: unknown) {
      setSubmitMsg(e instanceof Error ? e.message : "Failed to submit price");
    }
  }, [submitSourceId, submitAsset, submitPrice, onUpdatePrice]);

  const handleAddSource = useCallback(async () => {
    if (!newName.trim()) return;
    setAddMsg("");
    try {
      await onAddSource(newName.trim(), newWeight);
      setNewName("");
      setNewWeight(50);
      setAddMsg("✓ Source added");
    } catch (e: unknown) {
      setAddMsg(e instanceof Error ? e.message : "Failed to add source");
    }
  }, [newName, newWeight, onAddSource]);

  const handleSetStrategy = useCallback(
    async (s: Strategy) => {
      setStratMsg("");
      try {
        await onSetStrategy(s);
        setStratMsg(`✓ Strategy set to ${s}`);
      } catch (e: unknown) {
        setStratMsg(e instanceof Error ? e.message : "Failed to set strategy");
      }
    },
    [onSetStrategy]
  );

  const tabClass = (t: string) =>
    `px-3 py-1.5 text-xs rounded transition-colors ${
      activeTab === t
        ? "bg-cyan-700 text-white"
        : "text-slate-400 hover:text-white hover:bg-slate-700"
    }`;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-cyan-400" aria-hidden />
          <span className="text-white text-sm font-semibold">Price Aggregator</span>
          <StatusBadge paused={isPaused} />
        </div>
        {isLoading && (
          <RefreshCw size={14} className="text-slate-400 animate-spin" aria-label="Loading" />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0">
        <button className={tabClass("prices")} onClick={() => setActiveTab("prices")}>
          <span className="flex items-center gap-1">
            <BarChart2 size={12} aria-hidden /> Prices
          </span>
        </button>
        <button className={tabClass("sources")} onClick={() => setActiveTab("sources")}>
          <span className="flex items-center gap-1">
            <Database size={12} aria-hidden /> Sources
          </span>
        </button>
        {isAdmin && (
          <button className={tabClass("admin")} onClick={() => setActiveTab("admin")}>
            <span className="flex items-center gap-1">
              <AlertTriangle size={12} aria-hidden /> Admin
            </span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* ── Prices tab ── */}
        {activeTab === "prices" && (
          <div className="space-y-4">
            {/* Aggregated price lookup */}
            <section aria-labelledby="agg-title">
              <h2
                id="agg-title"
                className="text-slate-400 text-xs uppercase tracking-wide mb-2"
              >
                Aggregated Price
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={queryAsset}
                  onChange={(e) => setQueryAsset(e.target.value)}
                  placeholder="Asset (e.g. BTC/USD)"
                  className="flex-1 bg-slate-800 text-white text-sm rounded px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  aria-label="Asset to query"
                />
                <button
                  onClick={handleGetAggregated}
                  disabled={priceLoading}
                  className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded transition-colors"
                >
                  {priceLoading ? "…" : "Fetch"}
                </button>
              </div>
              {priceError && (
                <p className="text-rose-400 text-xs mt-1" role="alert">
                  {priceError}
                </p>
              )}
              {aggregated && (
                <div className="mt-2 bg-slate-800 rounded p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Asset</span>
                    <span className="text-white font-mono">{aggregated.asset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price</span>
                    <span className="text-emerald-300 font-mono font-bold">
                      {formatPrice(aggregated.price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sources</span>
                    <span className="text-white">{aggregated.num_sources}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Strategy</span>
                    <span className="text-cyan-300">
                      {STRATEGY_LABEL[aggregated.strategy] ?? aggregated.strategy}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp</span>
                    <span className="text-slate-300 text-xs">
                      {new Date(aggregated.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Submit price */}
            {walletAddress && (
              <section aria-labelledby="submit-title">
                <h2
                  id="submit-title"
                  className="text-slate-400 text-xs uppercase tracking-wide mb-2"
                >
                  Submit Price (Source)
                </h2>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={submitSourceId}
                    onChange={(e) => setSubmitSourceId(e.target.value)}
                    placeholder="Source ID"
                    className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    aria-label="Source ID"
                  />
                  <input
                    type="text"
                    value={submitAsset}
                    onChange={(e) => setSubmitAsset(e.target.value)}
                    placeholder="Asset (e.g. BTC/USD)"
                    className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    aria-label="Asset"
                  />
                  <input
                    type="text"
                    value={submitPrice}
                    onChange={(e) => setSubmitPrice(e.target.value)}
                    placeholder="Price (18-decimal scaled, e.g. 50000000000000000000000)"
                    className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                    aria-label="Price (18-decimal)"
                  />
                  <button
                    onClick={handleSubmitPrice}
                    disabled={isPaused}
                    className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm py-2 rounded transition-colors"
                  >
                    Submit Price
                  </button>
                  {submitMsg && (
                    <p
                      className={`text-xs ${submitMsg.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}
                      role="status"
                    >
                      {submitMsg}
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Sources tab ── */}
        {activeTab === "sources" && (
          <div className="space-y-4">
            <section aria-labelledby="src-list-title">
              <h2 id="src-list-title" className="text-slate-400 text-xs uppercase tracking-wide mb-2">
                Registered Sources
              </h2>
              {sources.length === 0 ? (
                <p className="text-slate-500 text-sm">No sources registered yet.</p>
              ) : (
                <ul className="space-y-2" role="list">
                  {sources.map((src) => (
                    <li
                      key={src.id}
                      className="bg-slate-800 rounded p-3 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-white text-sm font-medium">{src.name}</span>
                        <span className="text-slate-400 text-xs ml-2">ID:{src.id}</span>
                        <span className="text-slate-400 text-xs ml-2">w:{src.weight}</span>
                        {!src.active && (
                          <span className="text-rose-400 text-xs ml-2">(inactive)</span>
                        )}
                      </div>
                      {isAdmin && src.active && (
                        <button
                          onClick={() => onRemoveSource(src.id)}
                          className="text-rose-400 hover:text-rose-300 transition-colors"
                          aria-label={`Remove source ${src.name}`}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Add source */}
            {isAdmin && (
              <section aria-labelledby="add-src-title">
                <h2
                  id="add-src-title"
                  className="text-slate-400 text-xs uppercase tracking-wide mb-2"
                >
                  Add Source
                </h2>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Source name (e.g. Chainlink)"
                    className="w-full bg-slate-800 text-white text-sm rounded px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    aria-label="Source name"
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-slate-400 text-xs whitespace-nowrap">
                      Weight: <span className="text-white">{newWeight}</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={newWeight}
                      onChange={(e) => setNewWeight(parseInt(e.target.value, 10))}
                      className="flex-1 accent-cyan-500"
                      aria-label="Weight"
                    />
                  </div>
                  <button
                    onClick={handleAddSource}
                    disabled={isPaused || !newName.trim()}
                    className="flex items-center gap-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm px-3 py-2 rounded transition-colors"
                  >
                    <Plus size={14} aria-hidden /> Add Source
                  </button>
                  {addMsg && (
                    <p
                      className={`text-xs ${addMsg.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}
                      role="status"
                    >
                      {addMsg}
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Admin tab ── */}
        {activeTab === "admin" && isAdmin && (
          <div className="space-y-4">
            {/* Strategy */}
            <section aria-labelledby="strat-title">
              <h2 id="strat-title" className="text-slate-400 text-xs uppercase tracking-wide mb-2">
                Aggregation Strategy
              </h2>
              <div className="flex gap-2 flex-wrap">
                {STRATEGIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSetStrategy(s)}
                    className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
                  >
                    {STRATEGY_LABEL[s]}
                  </button>
                ))}
              </div>
              {stratMsg && (
                <p
                  className={`text-xs mt-1 ${stratMsg.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}
                  role="status"
                >
                  {stratMsg}
                </p>
              )}
            </section>

            {/* Pause / Unpause */}
            <section aria-labelledby="pause-title">
              <h2 id="pause-title" className="text-slate-400 text-xs uppercase tracking-wide mb-2">
                Emergency Controls
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={onPause}
                  disabled={isPaused}
                  className="flex items-center gap-1 bg-rose-800 hover:bg-rose-700 disabled:opacity-50 text-white text-sm px-3 py-2 rounded transition-colors"
                  aria-label="Pause contract"
                >
                  <PauseCircle size={14} aria-hidden /> Pause
                </button>
                <button
                  onClick={onUnpause}
                  disabled={!isPaused}
                  className="flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm px-3 py-2 rounded transition-colors"
                  aria-label="Unpause contract"
                >
                  <PlayCircle size={14} aria-hidden /> Unpause
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
