'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Search, SlidersHorizontal, Download, Upload, Tag, X, Star,
  FolderOpen, ArrowUpDown, ChevronDown
} from 'lucide-react';
import type { FavoriteTemplate, Category } from '../hooks/useFavorites';
import CategoryManager from './CategoryManager';

type SortKey = 'name' | 'addedAt' | 'category';

interface Props {
  favorites: FavoriteTemplate[];
  categories: Category[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateFavorite: (id: string, patch: Partial<Pick<FavoriteTemplate, 'categoryId' | 'tags'>>) => void;
  onAddCategory: (cat: Omit<Category, 'id'>) => void;
  onUpdateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  onDeleteCategory: (id: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

export default function FavoritesManager({
  favorites, categories, onOpen, onRemove, onUpdateFavorite,
  onAddCategory, onUpdateCategory, onDeleteCategory, onExport, onImport,
}: Props) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('addedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(
    () => Array.from(new Set(favorites.flatMap((f) => f.tags))).sort(),
    [favorites]
  );

  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    let list = favorites.filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) &&
          !f.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && f.categoryId !== filterCategory) return false;
      if (filterTag && !f.tags.includes(filterTag)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'addedAt') cmp = a.addedAt.localeCompare(b.addedAt);
      else if (sortKey === 'category') {
        const ca = catById[a.categoryId ?? '']?.name ?? '';
        const cb = catById[b.categoryId ?? '']?.name ?? '';
        cmp = ca.localeCompare(cb);
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [favorites, search, filterCategory, filterTag, sortKey, sortAsc, catById]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { onImport(ev.target?.result as string); } catch { /* invalid JSON */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const commitTag = (id: string) => {
    const tag = tagInput.trim().toLowerCase();
    if (tag) {
      const fav = favorites.find((f) => f.id === id);
      if (fav && !fav.tags.includes(tag)) {
        onUpdateFavorite(id, { tags: [...fav.tags, tag] });
      }
    }
    setTagInput('');
  };

  const removeTag = (id: string, tag: string) => {
    const fav = favorites.find((f) => f.id === id);
    if (fav) onUpdateFavorite(id, { tags: fav.tags.filter((t) => t !== tag) });
  };

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search favorites…"
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm outline-none focus:border-teal-500 text-gray-100 placeholder-gray-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={filterCategory ?? ''}
            onChange={(e) => setFilterCategory(e.target.value || null)}
            className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 outline-none focus:border-teal-500 cursor-pointer"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="relative">
            <select
              value={filterTag ?? ''}
              onChange={(e) => setFilterTag(e.target.value || null)}
              className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="">All tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          </div>
        )}

        {/* Sort */}
        <button
          onClick={() => cycleSort(sortKey)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:border-gray-600"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortKey === 'name' ? 'Name' : sortKey === 'addedAt' ? 'Date' : 'Category'}
          {sortAsc ? ' ↑' : ' ↓'}
        </button>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setShowCategories((v) => !v)}
            title="Manage categories"
            className={`p-2 rounded-lg border transition ${showCategories ? 'bg-teal-500/20 border-teal-500/50 text-teal-400' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'}`}
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button onClick={onExport} title="Export favorites" className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={() => importRef.current?.click()} title="Import favorites" className="p-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">
            <Upload className="w-4 h-4" />
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {/* Category manager panel */}
      {showCategories && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Categories
          </h3>
          <CategoryManager
            categories={categories}
            onAdd={onAddCategory}
            onUpdate={onUpdateCategory}
            onDelete={onDeleteCategory}
          />
        </div>
      )}

      {/* Favorites list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{favorites.length === 0 ? 'No favorites yet' : 'No matches'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((fav) => {
            const cat = catById[fav.categoryId ?? ''];
            return (
              <div
                key={fav.id}
                className="group flex flex-col gap-2 p-3 bg-gray-900/60 border border-gray-800 rounded-xl hover:border-gray-700 transition"
              >
                <div className="flex items-start gap-3">
                  {/* Category color stripe */}
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: cat?.color ?? '#374151' }} />

                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onOpen(fav.id)}
                      className="font-medium text-sm text-gray-100 hover:text-teal-400 transition text-left"
                    >
                      {fav.name}
                    </button>
                    {fav.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{fav.description}</p>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {fav.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-400 group/tag"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                          <button
                            onClick={() => removeTag(fav.id, tag)}
                            className="opacity-0 group-hover/tag:opacity-100 hover:text-red-400 transition ml-0.5"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                      {editingTags === fav.id ? (
                        <input
                          autoFocus
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitTag(fav.id);
                            if (e.key === 'Escape') { setEditingTags(null); setTagInput(''); }
                          }}
                          onBlur={() => { commitTag(fav.id); setEditingTags(null); }}
                          placeholder="tag…"
                          className="px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-300 outline-none w-20 placeholder-gray-600"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingTags(fav.id)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-gray-600 hover:text-teal-400 transition"
                        >
                          <Tag className="w-2.5 h-2.5" /> add tag
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Category select */}
                    <select
                      value={fav.categoryId ?? ''}
                      onChange={(e) => onUpdateFavorite(fav.id, { categoryId: e.target.value || null })}
                      className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-400 outline-none focus:border-teal-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <button
                      onClick={() => onRemove(fav.id)}
                      title="Remove from favorites"
                      className="text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
