"use client";

import React from "react";
import { Filter, X } from "lucide-react";

export interface FavoritesFilterState {
  categories: string[];
  tags: string[];
}

export interface FavoritesFilterProps {
  availableCategories: string[];
  availableTags: string[];
  filters: FavoritesFilterState;
  onFiltersChange: (filters: FavoritesFilterState) => void;
  className?: string;
}

const FavoritesFilter: React.FC<FavoritesFilterProps> = ({
  availableCategories,
  availableTags,
  filters,
  onFiltersChange,
  className = "",
}) => {
  const toggleCategory = (cat: string) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onFiltersChange({ ...filters, categories: next });
  };

  const toggleTag = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: next });
  };

  const clearAll = () => {
    onFiltersChange({ categories: [], tags: [] });
  };

  const activeCount = filters.categories.length + filters.tags.length;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold text-sm text-gray-900">Filters</h3>
          {activeCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Categories */}
      {availableCategories.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Categories</h4>
          <div className="flex flex-wrap gap-1.5">
            {availableCategories.map((cat) => {
              const active = filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                  {active && <X className="inline w-3 h-3 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      {availableTags.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((tag) => {
              const active = filters.tags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    active
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tag}
                  {active && <X className="inline w-3 h-3 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {availableCategories.length === 0 && availableTags.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-2">
          No filters available
        </p>
      )}
    </div>
  );
};

export default FavoritesFilter;
