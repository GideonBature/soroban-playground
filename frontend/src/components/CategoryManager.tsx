'use client';

import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { Category } from '../hooks/useFavorites';

const COLORS = ['#2dd4bf', '#a78bfa', '#f97316', '#60a5fa', '#f472b6', '#34d399', '#fbbf24'];

interface Props {
  categories: Category[];
  onAdd: (cat: Omit<Category, 'id'>) => void;
  onUpdate: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  onDelete: (id: string) => void;
}

export default function CategoryManager({ categories, onAdd, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) {
      onUpdate(editingId, { name: editName.trim(), color: editColor });
    }
    setEditingId(null);
  };

  const commitAdd = () => {
    if (newName.trim()) {
      onAdd({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(COLORS[0]);
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      {categories.map((cat) =>
        editingId === cat.id ? (
          <div key={cat.id} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setEditColor(c)}
                  className="w-4 h-4 rounded-full ring-offset-1 ring-offset-gray-800 transition"
                  style={{ background: c, outline: editColor === c ? `2px solid ${c}` : 'none' }}
                />
              ))}
            </div>
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
              className="flex-1 bg-gray-700 rounded px-2 py-1 text-sm outline-none text-gray-100"
            />
            <button onClick={commitEdit} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg group hover:bg-gray-800/50">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cat.color }} />
            <span className="flex-1 text-sm text-gray-200">{cat.name}</span>
            <button onClick={() => startEdit(cat)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(cat.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      )}

      {adding ? (
        <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-4 h-4 rounded-full transition"
                style={{ background: c, outline: newColor === c ? `2px solid ${c}` : 'none' }}
              />
            ))}
          </div>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Category name…"
            className="flex-1 bg-gray-700 rounded px-2 py-1 text-sm outline-none text-gray-100 placeholder-gray-500"
          />
          <button onClick={commitAdd} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
          <button onClick={() => setAdding(false)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-teal-400 transition px-2 py-1"
        >
          <Plus className="w-4 h-4" /> New category
        </button>
      )}
    </div>
  );
}
