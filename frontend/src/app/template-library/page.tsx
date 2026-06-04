'use client';

import React, { useState, useMemo } from 'react';
import { Search, Star, BookOpen, Tag, X, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';
import FavoritesManager from '../../components/FavoritesManager';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  code: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'The simplest Soroban contract — returns a greeting string.',
    category: 'Basics',
    tags: ['starter', 'simple'],
    difficulty: 'beginner',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, String};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: String) -> String {
        String::from_str(&env, &format!("Hello, {}!", to))
    }
}`,
  },
  {
    id: 'token-contract',
    name: 'Fungible Token',
    description: 'SEP-41 compliant fungible token with mint, burn, and transfer.',
    category: 'DeFi',
    tags: ['token', 'sep-41', 'defi'],
    difficulty: 'intermediate',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String) { /* ... */ }
    pub fn mint(env: Env, to: Address, amount: i128) { /* ... */ }
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) { /* ... */ }
    pub fn balance(env: Env, id: Address) -> i128 { 0 }
}`,
  },
  {
    id: 'nft-contract',
    name: 'Non-Fungible Token',
    description: 'Mint and transfer unique NFTs with on-chain metadata.',
    category: 'NFT',
    tags: ['nft', 'collectible'],
    difficulty: 'intermediate',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};

#[contract]
pub struct NftContract;

#[contractimpl]
impl NftContract {
    pub fn mint(env: Env, to: Address, token_id: u64, uri: String) { /* ... */ }
    pub fn owner_of(env: Env, token_id: u64) -> Address { /* ... */ todo!() }
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) { /* ... */ }
}`,
  },
  {
    id: 'voting-contract',
    name: 'Governance Vote',
    description: 'On-chain voting with proposals, quorum, and time-locked execution.',
    category: 'Governance',
    tags: ['governance', 'voting', 'dao'],
    difficulty: 'advanced',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct VoteContract;

#[contractimpl]
impl VoteContract {
    pub fn propose(env: Env, proposer: Address, description: soroban_sdk::String) -> u64 { 0 }
    pub fn vote(env: Env, voter: Address, proposal_id: u64, in_favor: bool) { /* ... */ }
    pub fn execute(env: Env, proposal_id: u64) { /* ... */ }
}`,
  },
  {
    id: 'amm-contract',
    name: 'AMM Liquidity Pool',
    description: 'Constant-product AMM (Uniswap v2 style) with swap and LP token logic.',
    category: 'DeFi',
    tags: ['amm', 'defi', 'liquidity'],
    difficulty: 'advanced',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct AmmContract;

#[contractimpl]
impl AmmContract {
    pub fn add_liquidity(env: Env, provider: Address, amount_a: i128, amount_b: i128) -> i128 { 0 }
    pub fn swap(env: Env, trader: Address, amount_in: i128, min_out: i128) -> i128 { 0 }
    pub fn remove_liquidity(env: Env, provider: Address, lp_amount: i128) { /* ... */ }
}`,
  },
  {
    id: 'vesting-contract',
    name: 'Token Vesting',
    description: 'Linear or cliff vesting schedules for team and investor allocations.',
    category: 'DeFi',
    tags: ['vesting', 'defi', 'token'],
    difficulty: 'intermediate',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct VestingContract;

#[contractimpl]
impl VestingContract {
    pub fn create_schedule(env: Env, recipient: Address, amount: i128, start: u64, duration: u64) { /* ... */ }
    pub fn release(env: Env, recipient: Address) -> i128 { 0 }
    pub fn vested_amount(env: Env, recipient: Address) -> i128 { 0 }
}`,
  },
  {
    id: 'multisig-contract',
    name: 'Multisig Wallet',
    description: 'M-of-N multisignature wallet with proposal and approval flow.',
    category: 'Security',
    tags: ['multisig', 'wallet', 'security'],
    difficulty: 'advanced',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

#[contract]
pub struct MultisigContract;

#[contractimpl]
impl MultisigContract {
    pub fn initialize(env: Env, owners: Vec<Address>, threshold: u32) { /* ... */ }
    pub fn submit(env: Env, to: Address, value: i128) -> u64 { 0 }
    pub fn approve(env: Env, approver: Address, tx_id: u64) { /* ... */ }
    pub fn execute(env: Env, tx_id: u64) { /* ... */ }
}`,
  },
  {
    id: 'storage-contract',
    name: 'Key-Value Storage',
    description: 'Simple persistent key-value store demonstrating Soroban storage types.',
    category: 'Basics',
    tags: ['storage', 'starter'],
    difficulty: 'beginner',
    code: `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol, Val};

#[contract]
pub struct KvStore;

#[contractimpl]
impl KvStore {
    pub fn put(env: Env, key: Symbol, val: Val) {
        env.storage().persistent().set(&key, &val);
    }
    pub fn get(env: Env, key: Symbol) -> Option<Val> {
        env.storage().persistent().get(&key)
    }
}`,
  },
];

const CATEGORIES = Array.from(new Set(TEMPLATES.map((t) => t.category))).sort();
const ALL_TAGS = Array.from(new Set(TEMPLATES.flatMap((t) => t.tags))).sort();

const DIFFICULTY_COLORS: Record<Template['difficulty'], string> = {
  beginner: 'text-emerald-400 bg-emerald-400/10',
  intermediate: 'text-amber-400 bg-amber-400/10',
  advanced: 'text-red-400 bg-red-400/10',
};

export default function TemplateLibraryPage() {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'browse' | 'favorites'>('browse');

  const favs = useFavorites();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return TEMPLATES.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      if (filterCat && t.category !== filterCat) return false;
      if (filterTag && !t.tags.includes(filterTag)) return false;
      return true;
    });
  }, [search, filterCat, filterTag]);

  const handleFavoriteToggle = (t: Template) => {
    if (favs.isFavorite(t.id)) {
      favs.removeFavorite(t.id);
    } else {
      favs.addFavorite({ id: t.id, name: t.name, description: t.description, categoryId: null, tags: [] });
    }
  };

  const handleOpen = (id: string) => {
    const t = TEMPLATES.find((t) => t.id === id);
    if (!t) return;
    // Navigate to main playground with template code — store in sessionStorage for the editor to pick up
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('playground_template', JSON.stringify({ id: t.id, name: t.name, code: t.code }));
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-teal-400" />
              Template Library
            </h1>
            <p className="text-gray-400 mt-1">Start from a production-ready Soroban contract template.</p>
          </div>
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition ${activeTab === 'browse' ? 'bg-teal-500/20 text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Browse
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition flex items-center gap-1.5 ${activeTab === 'favorites' ? 'bg-teal-500/20 text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Star className="w-3.5 h-3.5" />
              Favorites
              {favs.favorites.length > 0 && (
                <span className="bg-teal-500/30 text-teal-300 text-xs px-1.5 rounded-full">{favs.favorites.length}</span>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'browse' ? (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates…"
                  className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm outline-none focus:border-teal-500 text-gray-100 placeholder-gray-500"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={filterCat ?? ''}
                  onChange={(e) => setFilterCat(e.target.value || null)}
                  className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={filterTag ?? ''}
                  onChange={(e) => setFilterTag(e.target.value || null)}
                  className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">All tags</option>
                  {ALL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>

              <div className="flex gap-1 ml-auto">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 rounded-lg border transition ${view === 'grid' ? 'bg-teal-500/20 border-teal-500/50 text-teal-400' : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 rounded-lg border transition ${view === 'list' ? 'bg-teal-500/20 border-teal-500/50 text-teal-400' : 'bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active filters */}
            {(filterCat || filterTag) && (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-600">Filters:</span>
                {filterCat && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-300">
                    {filterCat}
                    <button onClick={() => setFilterCat(null)} className="hover:text-red-400 transition"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {filterTag && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-300">
                    <Tag className="w-2.5 h-2.5" /> {filterTag}
                    <button onClick={() => setFilterTag(null)} className="hover:text-red-400 transition"><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
            )}

            {/* Template grid / list */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No templates match your filters</p>
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isFavorite={favs.isFavorite(t.id)}
                    onOpen={handleOpen}
                    onToggleFavorite={handleFavoriteToggle}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    isFavorite={favs.isFavorite(t.id)}
                    onOpen={handleOpen}
                    onToggleFavorite={handleFavoriteToggle}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <FavoritesManager
            favorites={favs.favorites}
            categories={favs.categories}
            onOpen={handleOpen}
            onRemove={favs.removeFavorite}
            onUpdateFavorite={favs.updateFavorite}
            onAddCategory={favs.addCategory}
            onUpdateCategory={favs.updateCategory}
            onDeleteCategory={favs.deleteCategory}
            onExport={favs.exportFavorites}
            onImport={favs.importFavorites}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

interface CardProps {
  template: Template;
  isFavorite: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (t: Template) => void;
}

function TemplateCard({ template: t, isFavorite, onOpen, onToggleFavorite }: CardProps) {
  return (
    <div className="group flex flex-col gap-3 p-4 bg-gray-900/60 border border-gray-800 rounded-xl hover:border-gray-700 transition">
      <div className="flex justify-between items-start gap-2">
        <div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[t.difficulty]}`}>
            {t.difficulty}
          </span>
          <span className="ml-2 text-xs text-gray-600">{t.category}</span>
        </div>
        <button
          onClick={() => onToggleFavorite(t)}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`transition flex-shrink-0 ${isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-600 hover:text-yellow-400'}`}
        >
          <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="flex-1">
        <h3 className="font-semibold text-gray-100">{t.name}</h3>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {t.tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-500">
            <Tag className="w-2.5 h-2.5" /> {tag}
          </span>
        ))}
      </div>

      <button
        onClick={() => onOpen(t.id)}
        className="mt-auto w-full py-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 hover:border-teal-500/50 text-teal-400 text-sm font-medium rounded-lg transition"
      >
        Use Template
      </button>
    </div>
  );
}

function TemplateRow({ template: t, isFavorite, onOpen, onToggleFavorite }: CardProps) {
  return (
    <div className="group flex items-center gap-4 p-3 bg-gray-900/60 border border-gray-800 rounded-xl hover:border-gray-700 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-100">{t.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[t.difficulty]}`}>{t.difficulty}</span>
          <span className="text-xs text-gray-600">{t.category}</span>
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">{t.description}</p>
      </div>

      <div className="hidden sm:flex flex-wrap gap-1 max-w-48">
        {t.tags.map((tag) => (
          <span key={tag} className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-600">{tag}</span>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onToggleFavorite(t)}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`transition ${isFavorite ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-600 hover:text-yellow-400'}`}
        >
          <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={() => onOpen(t.id)}
          className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 text-xs font-medium rounded-lg transition"
        >
          Use
        </button>
      </div>
    </div>
  );
}
