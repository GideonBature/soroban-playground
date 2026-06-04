"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface TemplateSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function TemplateSearchBar({
  value,
  onChange,
  placeholder = "Search templates by name, description, or keyword…",
}: TemplateSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Debounce: emit changes immediately (parent handles debounce if needed)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onChange("");
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full">
      <div
        className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-all ${
          focused
            ? "border-teal-500/50 bg-slate-900 shadow-[0_0_0_3px_rgba(45,212,191,0.1)]"
            : "border-slate-700/60 bg-slate-900/60"
        }`}
      >
        <Search
          className={`shrink-0 transition-colors ${focused ? "text-teal-400" : "text-slate-500"}`}
          size={18}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search templates"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
