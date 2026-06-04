'use client';

import { Heart } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
}

interface TemplateLibraryGridProps {
  templates: Template[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export default function TemplateLibraryGrid({
  templates,
  favorites,
  onToggleFavorite,
}: TemplateLibraryGridProps) {
  if (templates.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No templates found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => {
        const isFavorited = favorites.includes(template.id);
        return (
          <div
            key={template.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-200 truncate">
                  {template.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {template.description}
                </p>
              </div>
              <button
                onClick={() => onToggleFavorite(template.id)}
                className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                  isFavorited
                    ? 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
                aria-label={isFavorited ? `Remove ${template.name} from favorites` : `Add ${template.name} to favorites`}
              >
                <Heart
                  size={16}
                  className={isFavorited ? 'fill-rose-400' : ''}
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
