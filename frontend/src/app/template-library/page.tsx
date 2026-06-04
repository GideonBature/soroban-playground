"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Code2, ExternalLink, BookOpen } from "lucide-react";
import TemplateSearchBar from "../../components/TemplateSearchBar";
import TemplateFilter, { TemplateFilters, FilterCategory } from "../../components/TemplateFilter";

interface Template {
  id: string;
  name: string;
  description: string;
  category: FilterCategory;
  tags: string[];
  path: string;
}

const TEMPLATES: Template[] = [
  { id: "hello-world", name: "Hello World", description: "Minimal Soroban contract — the classic starting point.", category: "utility", tags: ["beginner", "tutorial"], path: "/contracts/hello-world" },
  { id: "counter", name: "Counter", description: "Simple on-chain counter with increment and decrement.", category: "utility", tags: ["beginner", "storage"], path: "/contracts/counter" },
  { id: "key-value-store", name: "Key-Value Store", description: "Generic persistent key-value storage contract.", category: "utility", tags: ["storage", "utility"], path: "/contracts/key-value-store" },
  { id: "message-board", name: "Message Board", description: "Decentralized message board with on-chain posts.", category: "utility", tags: ["messaging", "social"], path: "/contracts/message-board" },
  { id: "token_contract", name: "Token Contract", description: "Fungible token following the Soroban token interface.", category: "defi", tags: ["token", "fungible"], path: "/contracts/token_contract" },
  { id: "token-burn", name: "Token Burn", description: "Token contract with a deflationary burn mechanism.", category: "defi", tags: ["token", "burn"], path: "/contracts/token-burn" },
  { id: "token-vesting", name: "Token Vesting", description: "Vesting schedule for locked token distribution.", category: "defi", tags: ["token", "vesting", "staking"], path: "/contracts/token-vesting" },
  { id: "airdrop", name: "Airdrop", description: "Merkle-proof based token airdrop distribution.", category: "defi", tags: ["token", "airdrop"], path: "/contracts/airdrop" },
  { id: "staking", name: "Staking", description: "Stake tokens and earn yield rewards on-chain.", category: "defi", tags: ["staking", "yield"], path: "/contracts/staking" },
  { id: "yield-optimizer", name: "Yield Optimizer", description: "Auto-compounding yield optimizer across strategies.", category: "defi", tags: ["yield", "staking", "amm"], path: "/contracts/yield-optimizer" },
  { id: "yield-farming", name: "Yield Farming", description: "Liquidity mining and yield farming rewards contract.", category: "defi", tags: ["yield", "staking", "amm"], path: "/contracts/yield-farming" },
  { id: "escrow", name: "Escrow", description: "Trustless two-party escrow with dispute resolution.", category: "defi", tags: ["escrow"], path: "/contracts/escrow" },
  { id: "stablecoin", name: "Stablecoin", description: "Collateral-backed stablecoin peg mechanism.", category: "defi", tags: ["stablecoin", "token"], path: "/contracts/stablecoin" },
  { id: "flash-loan", name: "Flash Loan", description: "Single-transaction uncollateralized flash loans.", category: "defi", tags: ["lending", "amm"], path: "/contracts/flash-loan" },
  { id: "lending-protocol", name: "Lending Protocol", description: "Borrow and lend assets with interest rate model.", category: "defi", tags: ["lending"], path: "/contracts/lending-protocol" },
  { id: "interest-rate-model", name: "Interest Rate Model", description: "Dynamic interest rate model for DeFi lending.", category: "defi", tags: ["lending"], path: "/contracts/interest-rate-model" },
  { id: "amm-pool", name: "AMM Pool", description: "Automated market maker constant-product liquidity pool.", category: "defi", tags: ["amm"], path: "/contracts/amm-pool" },
  { id: "nft-amm", name: "NFT AMM", description: "AMM pool for buying and selling NFTs.", category: "nft", tags: ["nft", "amm"], path: "/contracts/nft-amm" },
  { id: "limit-order-book", name: "Limit Order Book", description: "On-chain order book for limit buy/sell orders.", category: "defi", tags: ["marketplace", "amm"], path: "/contracts/limit-order-book" },
  { id: "dex-aggregator", name: "DEX Aggregator", description: "Route swaps across multiple DEX liquidity sources.", category: "defi", tags: ["amm", "token"], path: "/contracts/dex-aggregator" },
  { id: "cross-chain-bridge", name: "Cross-Chain Bridge", description: "Lock-and-mint asset bridge between chains.", category: "defi", tags: ["bridge"], path: "/contracts/cross-chain-bridge" },
  { id: "options-protocol", name: "Options Protocol", description: "On-chain covered call and put options.", category: "defi", tags: ["lending", "token"], path: "/contracts/options-protocol" },
  { id: "synthetic-assets", name: "Synthetic Assets", description: "Create synthetic on-chain representations of real-world assets.", category: "defi", tags: ["stablecoin", "oracle"], path: "/contracts/synthetic-assets" },
  { id: "prediction-market", name: "Prediction Market", description: "Binary outcome prediction market with settlement.", category: "defi", tags: ["oracle", "voting"], path: "/contracts/prediction-market" },
  { id: "voting", name: "Voting", description: "Configurable on-chain proposal voting system.", category: "governance", tags: ["voting", "governance"], path: "/contracts/voting" },
  { id: "quadratic-voting", name: "Quadratic Voting", description: "Credit-weighted quadratic voting to prevent whale dominance.", category: "governance", tags: ["voting", "governance"], path: "/contracts/quadratic-voting" },
  { id: "governance", name: "Governance", description: "Full DAO governance with proposals and execution.", category: "governance", tags: ["voting", "governance"], path: "/contracts/governance" },
  { id: "dao-treasury", name: "DAO Treasury", description: "Multi-sig treasury with governance-controlled spending.", category: "governance", tags: ["voting", "escrow"], path: "/contracts/dao-treasury" },
  { id: "multisig-wallet", name: "Multisig Wallet", description: "M-of-N threshold signature wallet.", category: "governance", tags: ["escrow", "identity"], path: "/contracts/multisig-wallet" },
  { id: "access-control", name: "Access Control", description: "Role-based access control for contract administration.", category: "governance", tags: ["identity"], path: "/contracts/access-control" },
  { id: "admin-setter", name: "Admin Setter", description: "Simple admin key management for contract ownership.", category: "governance", tags: ["identity"], path: "/contracts/admin-setter" },
  { id: "allowlist", name: "Allowlist", description: "On-chain address allowlist for permissioned access.", category: "governance", tags: ["identity"], path: "/contracts/allowlist" },
  { id: "pause-toggle-contract", name: "Pause Toggle", description: "Emergency circuit-breaker pause/unpause pattern.", category: "utility", tags: ["utility"], path: "/contracts/pause-toggle-contract" },
  { id: "erc-721", name: "ERC-721 / NFT", description: "Non-fungible token standard implementation on Soroban.", category: "nft", tags: ["nft", "token"], path: "/contracts/erc-721" },
  { id: "nft-marketplace", name: "NFT Marketplace", description: "List, bid, and trade NFTs with royalty support.", category: "nft", tags: ["nft", "marketplace"], path: "/contracts/nft-marketplace" },
  { id: "supply-chain", name: "Supply Chain", description: "Product provenance and supply chain tracking.", category: "utility", tags: ["oracle", "utility"], path: "/contracts/supply-chain" },
  { id: "real-estate", name: "Real Estate", description: "Tokenized property ownership and transfer.", category: "nft", tags: ["nft", "token"], path: "/contracts/real-estate" },
  { id: "tokenized-reit", name: "Tokenized REIT", description: "Fractional real-estate investment trust tokens.", category: "nft", tags: ["token", "staking"], path: "/contracts/tokenized-reit" },
  { id: "content-publishing", name: "Content Publishing", description: "Publish and monetize digital content on-chain.", category: "utility", tags: ["marketplace", "token"], path: "/contracts/content-publishing" },
  { id: "music-royalty", name: "Music Royalty", description: "Music rights and royalty distribution contract.", category: "utility", tags: ["token", "marketplace"], path: "/contracts/music-royalty" },
  { id: "music-licensing", name: "Music Licensing", description: "Issue and verify music licenses on-chain.", category: "utility", tags: ["marketplace", "identity"], path: "/contracts/music-licensing" },
  { id: "patent-registry", name: "Patent Registry", description: "Register and verify intellectual property patents.", category: "utility", tags: ["identity"], path: "/contracts/patent-registry" },
  { id: "did-registry", name: "DID Registry", description: "Decentralized identity document registry.", category: "utility", tags: ["identity"], path: "/contracts/did-registry" },
  { id: "profile-registry", name: "Profile Registry", description: "On-chain user profile and social graph.", category: "utility", tags: ["identity", "social"], path: "/contracts/profile-registry" },
  { id: "file-notary", name: "File Notary", description: "Immutable timestamped proof-of-existence for documents.", category: "utility", tags: ["identity", "utility"], path: "/contracts/file-notary" },
  { id: "donation-tracker", name: "Donation Tracker", description: "Transparent donation and fund tracking.", category: "utility", tags: ["utility", "escrow"], path: "/contracts/donation-tracker" },
  { id: "job-marketplace", name: "Job Marketplace", description: "Hire freelancers with on-chain escrow milestones.", category: "utility", tags: ["marketplace", "escrow"], path: "/contracts/job-marketplace" },
  { id: "data-marketplace", name: "Data Marketplace", description: "Buy and sell datasets with access-controlled delivery.", category: "utility", tags: ["marketplace", "oracle"], path: "/contracts/data-marketplace" },
  { id: "cloud-storage", name: "Cloud Storage", description: "Decentralized file storage reference and access control.", category: "utility", tags: ["storage", "utility"], path: "/contracts/cloud-storage" },
  { id: "social-media", name: "Social Media", description: "On-chain social posts, likes, and follow graph.", category: "utility", tags: ["social"], path: "/contracts/social-media" },
  { id: "lottery", name: "Lottery", description: "Verifiable random lottery with provably fair draws.", category: "gaming", tags: ["lottery", "oracle"], path: "/contracts/lottery" },
  { id: "sports-prediction", name: "Sports Prediction", description: "Predict sports match outcomes with rewards.", category: "gaming", tags: ["oracle", "voting"], path: "/contracts/sports-prediction" },
  { id: "sports-prediction-market", name: "Sports Prediction Market", description: "Full prediction market for sporting events.", category: "gaming", tags: ["oracle", "marketplace"], path: "/contracts/sports-prediction-market" },
  { id: "sports-results-oracle", name: "Sports Results Oracle", description: "Push verified sports results on-chain.", category: "oracle", tags: ["oracle"], path: "/contracts/sports-results-oracle" },
  { id: "bug-bounty", name: "Bug Bounty", description: "On-chain bug bounty reward escrow program.", category: "governance", tags: ["escrow", "identity"], path: "/contracts/bug-bounty" },
  { id: "insurance-protocol", name: "Insurance Protocol", description: "Parametric on-chain insurance coverage.", category: "defi", tags: ["oracle", "escrow"], path: "/contracts/insurance-protocol" },
  { id: "insurance-oracle", name: "Insurance Oracle", description: "Oracle feeding claim conditions to insurance contracts.", category: "oracle", tags: ["oracle"], path: "/contracts/insurance-oracle" },
  { id: "real-estate-oracle", name: "Real Estate Oracle", description: "Property price feed oracle for real-estate contracts.", category: "oracle", tags: ["oracle"], path: "/contracts/real-estate-oracle" },
  { id: "supply-chain-oracle", name: "Supply Chain Oracle", description: "External data feed for supply chain events.", category: "oracle", tags: ["oracle"], path: "/contracts/supply-chain-oracle" },
  { id: "supply-chain-data-oracle", name: "Supply Chain Data Oracle", description: "High-frequency supply chain data oracle.", category: "oracle", tags: ["oracle"], path: "/contracts/supply-chain-data-oracle" },
  { id: "carbon-credit", name: "Carbon Credit", description: "Tokenize, trade, and retire carbon credits.", category: "utility", tags: ["token", "oracle"], path: "/contracts/carbon-credit" },
  { id: "warranty-management", name: "Warranty Management", description: "Issue and verify product warranty certificates.", category: "utility", tags: ["identity", "utility"], path: "/contracts/warranty-management" },
  { id: "subscription_manager", name: "Subscription Manager", description: "Recurring subscription billing on-chain.", category: "defi", tags: ["token", "utility"], path: "/contracts/subscription_manager" },
  { id: "payment_splitter", name: "Payment Splitter", description: "Split incoming payments among multiple recipients.", category: "defi", tags: ["token", "escrow"], path: "/contracts/payment_splitter" },
  { id: "price_feed_adapter", name: "Price Feed Adapter", description: "Adapt external price feeds to Soroban contracts.", category: "oracle", tags: ["oracle"], path: "/contracts/price_feed_adapter" },
  { id: "proxy-pattern", name: "Proxy Pattern", description: "Upgradeable proxy delegation pattern.", category: "utility", tags: ["utility"], path: "/contracts/proxy-pattern" },
  { id: "upgradeable", name: "Upgradeable Contract", description: "Contract with built-in upgrade mechanism.", category: "utility", tags: ["utility"], path: "/contracts/upgradeable" },
  { id: "versioned", name: "Versioned Contract", description: "Versioned state migration and storage layout.", category: "utility", tags: ["utility", "storage"], path: "/contracts/versioned" },
  { id: "storage-utils", name: "Storage Utils", description: "Utilities for complex Soroban storage patterns.", category: "utility", tags: ["storage", "utility"], path: "/contracts/storage-utils" },
  { id: "cross-contract-utils", name: "Cross-Contract Utils", description: "Helpers for invoking other Soroban contracts.", category: "utility", tags: ["utility"], path: "/contracts/cross-contract-utils" },
  { id: "debugging-utils", name: "Debugging Utils", description: "Logging and debugging utilities for Soroban.", category: "utility", tags: ["utility"], path: "/contracts/debugging-utils" },
  { id: "analysis-utils", name: "Analysis Utils", description: "On-chain analysis and statistical utilities.", category: "utility", tags: ["utility"], path: "/contracts/analysis-utils" },
  { id: "simulation-engine", name: "Simulation Engine", description: "Event-driven simulation framework for contracts.", category: "utility", tags: ["utility"], path: "/contracts/simulation-engine" },
];

const CATEGORY_COLORS: Record<FilterCategory, string> = {
  all: "text-slate-400 bg-slate-800/60",
  defi: "text-teal-400 bg-teal-500/10",
  governance: "text-purple-400 bg-purple-500/10",
  nft: "text-pink-400 bg-pink-500/10",
  oracle: "text-orange-400 bg-orange-500/10",
  utility: "text-blue-400 bg-blue-500/10",
  gaming: "text-yellow-400 bg-yellow-500/10",
};

function matches(template: Template, query: string, filters: TemplateFilters): boolean {
  if (filters.category !== "all" && template.category !== filters.category) return false;
  if (filters.functionality && !template.tags.includes(filters.functionality)) return false;
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    template.name.toLowerCase().includes(q) ||
    template.description.toLowerCase().includes(q) ||
    template.tags.some((t) => t.includes(q)) ||
    template.category.includes(q)
  );
}

export default function TemplateLibraryPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<TemplateFilters>({ category: "all", functionality: "" });

  const results = useMemo(
    () => TEMPLATES.filter((t) => matches(t, query, filters)),
    [query, filters]
  );

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={18} className="text-teal-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-teal-400">
            Contract Library
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Template Library</h1>
        <p className="text-sm text-slate-400">
          Browse {TEMPLATES.length} Soroban contract templates. Click any card to open it in the playground.
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <TemplateSearchBar value={query} onChange={setQuery} />
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
        <TemplateFilter filters={filters} onChange={setFilters} />
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">
          {results.length === TEMPLATES.length
            ? `${results.length} templates`
            : `${results.length} of ${TEMPLATES.length} templates`}
        </p>
        {(query || filters.category !== "all" || filters.functionality) && (
          <button
            onClick={() => { setQuery(""); setFilters({ category: "all", functionality: "" }); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Grid */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Code2 size={40} className="text-slate-700 mb-4" />
          <p className="text-slate-400 font-medium mb-1">No templates found</p>
          <p className="text-sm text-slate-600">Try a different search term or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {results.map((template) => (
            <Link
              key={template.id}
              href={`/playground?template=${template.id}`}
              className="group relative flex flex-col gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/60 hover:border-slate-700/80 hover:bg-slate-900/80 transition-all"
            >
              {/* Category badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    CATEGORY_COLORS[template.category]
                  }`}
                >
                  {template.category}
                </span>
                <ExternalLink
                  size={13}
                  className="text-slate-600 group-hover:text-teal-400 transition-colors"
                />
              </div>

              {/* Name */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors mb-1">
                  {template.name}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {template.description}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mt-auto">
                {template.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
