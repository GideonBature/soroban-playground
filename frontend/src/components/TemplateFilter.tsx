"use client";

import React from "react";
import { X } from "lucide-react";

export type FilterCategory = "all" | "defi" | "governance" | "nft" | "oracle" | "utility" | "gaming";

export interface TemplateFilters {
  category: FilterCategory;
  functionality: string;
}

interface TemplateFilterProps {
  filters: TemplateFilters;
  onChange: (filters: TemplateFilters) => void;
}

const CATEGORIES: { value: FilterCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "defi", label: "DeFi" },
  { value: "governance", label: "Governance" },
  { value: "nft", label: "NFT" },
  { value: "oracle", label: "Oracle" },
  { value: "utility", label: "Utility" },
  { value: "gaming", label: "Gaming & Sports" },
];

const FUNCTIONALITIES = [
  "token", "voting", "staking", "escrow", "marketplace", "oracle",
  "lottery", "bridge", "amm", "lending", "stablecoin", "identity",
];

export default function TemplateFilter({ filters, onChange }: TemplateFilterProps) {
  const setCategory = (category: FilterCategory) =>
    onChange({ ...filters, category });

  const toggleFunctionality = (fn: string) =>
    onChange({ ...filters, functionality: filters.functionality === fn ? "" : fn });

  const hasActiveFilters = filters.category !== "all" || filters.functionality !== "";

  const clearAll = () => onChange({ category: "all", functionality: "" });

  return (
    <div className="space-y-4">
      {/* Category pills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Category
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={10} /> Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                filters.category === value
                  ? "bg-teal-500/15 border-teal-500/40 text-teal-300"
                  : "bg-transparent border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
              aria-pressed={filters.category === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Functionality tags */}
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 block mb-2">
          Functionality
        </span>
        <div className="flex flex-wrap gap-1.5">
          {FUNCTIONALITIES.map((fn) => (
            <button
              key={fn}
              onClick={() => toggleFunctionality(fn)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all capitalize ${
                filters.functionality === fn
                  ? "bg-orange-500/15 border-orange-500/40 text-orange-300"
                  : "bg-transparent border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
              }`}
              aria-pressed={filters.functionality === fn}
            >
              {fn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
