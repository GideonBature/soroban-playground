'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface FavoriteTemplate {
  id: string;           // template slug/path
  name: string;
  description: string;
  categoryId: string | null;
  tags: string[];
  addedAt: string;      // ISO date string
}

export interface FavoritesState {
  favorites: FavoriteTemplate[];
  categories: Category[];
}

const STORAGE_KEY = 'soroban_template_favorites';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'defi', name: 'DeFi', color: '#2dd4bf' },
  { id: 'nft', name: 'NFT', color: '#a78bfa' },
  { id: 'governance', name: 'Governance', color: '#f97316' },
];

function load(): FavoritesState {
  if (typeof window === 'undefined') return { favorites: [], categories: DEFAULT_CATEGORIES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { favorites: [], categories: DEFAULT_CATEGORIES };
    const parsed = JSON.parse(raw) as FavoritesState;
    return {
      favorites: parsed.favorites ?? [],
      categories: parsed.categories ?? DEFAULT_CATEGORIES,
    };
  } catch {
    return { favorites: [], categories: DEFAULT_CATEGORIES };
  }
}

function save(state: FavoritesState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or SSR — ignore
  }
}

export function useFavorites() {
  const [state, setState] = useState<FavoritesState>({ favorites: [], categories: DEFAULT_CATEGORIES });

  useEffect(() => {
    setState(load());
  }, []);

  const persist = useCallback((next: FavoritesState) => {
    setState(next);
    save(next);
  }, []);

  const isFavorite = useCallback(
    (id: string) => state.favorites.some((f) => f.id === id),
    [state.favorites]
  );

  const addFavorite = useCallback(
    (template: Omit<FavoriteTemplate, 'addedAt'>) => {
      if (state.favorites.some((f) => f.id === template.id)) return;
      persist({
        ...state,
        favorites: [...state.favorites, { ...template, addedAt: new Date().toISOString() }],
      });
    },
    [state, persist]
  );

  const removeFavorite = useCallback(
    (id: string) => {
      persist({ ...state, favorites: state.favorites.filter((f) => f.id !== id) });
    },
    [state, persist]
  );

  const updateFavorite = useCallback(
    (id: string, patch: Partial<Pick<FavoriteTemplate, 'categoryId' | 'tags'>>) => {
      persist({
        ...state,
        favorites: state.favorites.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      });
    },
    [state, persist]
  );

  const addCategory = useCallback(
    (category: Omit<Category, 'id'>) => {
      const id = `cat_${Date.now()}`;
      persist({ ...state, categories: [...state.categories, { ...category, id }] });
      return id;
    },
    [state, persist]
  );

  const updateCategory = useCallback(
    (id: string, patch: Partial<Omit<Category, 'id'>>) => {
      persist({
        ...state,
        categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
    },
    [state, persist]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      persist({
        ...state,
        categories: state.categories.filter((c) => c.id !== id),
        favorites: state.favorites.map((f) => (f.categoryId === id ? { ...f, categoryId: null } : f)),
      });
    },
    [state, persist]
  );

  const exportFavorites = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soroban-favorites.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importFavorites = useCallback(
    (json: string) => {
      const parsed = JSON.parse(json) as FavoritesState;
      // merge: deduplicate by id
      const merged: FavoritesState = {
        categories: [
          ...state.categories,
          ...(parsed.categories ?? []).filter(
            (c) => !state.categories.some((e) => e.id === c.id)
          ),
        ],
        favorites: [
          ...state.favorites,
          ...(parsed.favorites ?? []).filter(
            (f) => !state.favorites.some((e) => e.id === f.id)
          ),
        ],
      };
      persist(merged);
    },
    [state, persist]
  );

  return {
    favorites: state.favorites,
    categories: state.categories,
    isFavorite,
    addFavorite,
    removeFavorite,
    updateFavorite,
    addCategory,
    updateCategory,
    deleteCategory,
    exportFavorites,
    importFavorites,
  };
}
