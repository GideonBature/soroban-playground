'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFreighterWallet } from '@/hooks/useFreighterWallet';

const STORAGE_KEY = 'template-library-favorites';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

function loadLocalFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function saveLocalFavorites(favorites: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

async function fetchRemoteFavorites(walletAddress: string): Promise<{ favorites: string[]; updatedAt: string } | null> {
  try {
    const res = await fetch('/api/favorites', {
      headers: { 'x-wallet-address': walletAddress },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function pushRemoteFavorites(walletAddress: string, favorites: string[]): Promise<boolean> {
  try {
    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': walletAddress,
      },
      body: JSON.stringify({ favorites }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function mergeLists(local: string[], remote: string[]): string[] {
  const union = new Set([...local, ...remote]);
  return Array.from(union);
}

export function useFavorites() {
  const { isAuthenticated } = useAuth();
  const wallet = useFreighterWallet();
  const walletAddress = wallet.address;

  const [favorites, setFavorites] = useState<string[]>(loadLocalFavorites);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isAuthenticated && walletAddress ? 'idle' : 'offline'
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(
    async (currentFavorites: string[]) => {
      if (!walletAddress) return;
      setSyncStatus('syncing');
      const ok = await pushRemoteFavorites(walletAddress, currentFavorites);
      setSyncStatus(ok ? 'synced' : 'error');
    },
    [walletAddress]
  );

  useEffect(() => {
    if (!isAuthenticated || !walletAddress) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('idle');

    const local = loadLocalFavorites();
    if (local.length > 0) {
      setFavorites(local);
    }

    fetchRemoteFavorites(walletAddress).then((remote) => {
      if (remote) {
        setFavorites((prev) => {
          const merged = mergeLists(prev, remote.favorites);
          saveLocalFavorites(merged);
          return merged;
        });
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    });
  }, [isAuthenticated, walletAddress]);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = prev.includes(id)
          ? prev.filter((fid) => fid !== id)
          : [...prev, id];
        saveLocalFavorites(next);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          sync(next);
        }, 2000);

        return next;
      });
    },
    [sync]
  );

  const retrySync = useCallback(() => {
    setFavorites((prev) => {
      sync(prev);
      return prev;
    });
  }, [sync]);

  return { favorites, toggleFavorite, syncStatus, retrySync };
}
