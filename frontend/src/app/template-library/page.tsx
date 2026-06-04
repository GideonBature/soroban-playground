'use client';

import { Heart } from 'lucide-react';
import { useFavorites } from '@/components/FavoritesSyncManager';
import SyncStatusIndicator from '@/components/SyncStatusIndicator';
import TemplateLibraryGrid from '@/components/TemplateLibraryGrid';

const TEMPLATES = [
  { id: 'hello-world', name: 'Hello World', description: 'A simple Hello World contract to get started with Soroban.' },
  { id: 'token', name: 'Token Contract', description: 'Standard Stellar token contract with mint, burn, and transfer.' },
  { id: 'nft', name: 'NFT Contract', description: 'Non-fungible token contract with metadata and royalties.' },
  { id: 'amm', name: 'AMM Pool', description: 'Automated market maker for constant product trading.' },
  { id: 'voting', name: 'Voting Contract', description: 'Decentralized voting with proposal creation and tallying.' },
  { id: 'escrow', name: 'Escrow Contract', description: 'Time-locked escrow with multi-signature release.' },
];

export default function TemplateLibraryPage() {
  const { favorites, toggleFavorite, syncStatus, retrySync } = useFavorites();

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Template Library</h1>
            <p className="text-sm text-slate-400 mt-1">
              Browse and save your favorite contract templates.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <Heart size={14} className="text-rose-400 fill-rose-400" />
              <span>{favorites.length}</span>
            </div>
            <SyncStatusIndicator status={syncStatus} onRetry={retrySync} />
          </div>
        </div>

        <TemplateLibraryGrid
          templates={TEMPLATES}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      </div>
    </main>
  );
}
