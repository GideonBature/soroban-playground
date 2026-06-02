"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Clock, Star } from "lucide-react";

const HISTORY_KEY = "favorites_search_history";
const MAX_HISTORY = 8;

export interface FavoritesSearchBarProps {
  onSearch: (query: string) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

const FavoritesSearchBar: React.FC<FavoritesSearchBarProps> = ({
  onSearch,
  suggestions = [],
  placeholder = "Search favorite templates…",
  className = "",
}) => {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const commitSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const next = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY);
      setHistory(next);
      saveHistory(next);
      onSearch(trimmed);
      setShowDropdown(false);
    },
    [history, onSearch]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (v.trim()) onSearch(v.trim());
      else onSearch("");
    }, 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    commitSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    onSearch("");
    inputRef.current?.focus();
  };

  const handleHistoryClear = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = history.filter((h) => h !== item);
    setHistory(next);
    saveHistory(next);
  };

  const filteredSuggestions = query.length >= 1
    ? suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const showHistory = !query && history.length > 0;
  const dropdownVisible = showDropdown && (filteredSuggestions.length > 0 || showHistory);

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={(e) => e.key === "Escape" && setShowDropdown(false)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search favorites"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {dropdownVisible && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto"
        >
          {filteredSuggestions.length > 0 && (
            <>
              <p className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Suggestions
              </p>
              {filteredSuggestions.map((s) => (
                <button
                  key={s}
                  role="option"
                  aria-selected={false}
                  onClick={() => { setQuery(s); commitSearch(s); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                >
                  <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  {s}
                </button>
              ))}
            </>
          )}

          {showHistory && (
            <>
              <p className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Recent
              </p>
              {history.map((item) => (
                <div
                  key={item}
                  className="flex items-center group hover:bg-gray-50"
                >
                  <button
                    role="option"
                    aria-selected={false}
                    onClick={() => { setQuery(item); commitSearch(item); }}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-700 text-left"
                  >
                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {item}
                  </button>
                  <button
                    onClick={(e) => handleHistoryClear(item, e)}
                    aria-label={`Remove ${item} from history`}
                    className="pr-3 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FavoritesSearchBar;
