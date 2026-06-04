'use client';

import { useEffect, useRef } from 'react';
import type { SyncStatus } from './FavoritesSyncManager';
import { Cloud, CloudOff, Check, AlertTriangle, Loader2 } from 'lucide-react';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  onRetry: () => void;
}

const STATUS_CONFIG: Record<
  SyncStatus,
  { icon: React.ReactNode; label: string; ariaLabel: string }
> = {
  idle: {
    icon: <Cloud size={14} />,
    label: 'Syncing...',
    ariaLabel: 'Favorites synced',
  },
  synced: {
    icon: <Check size={14} className="text-emerald-400" />,
    label: 'Synced',
    ariaLabel: 'Favorites synced',
  },
  syncing: {
    icon: <Loader2 size={14} className="animate-spin" />,
    label: 'Syncing...',
    ariaLabel: 'Syncing favorites',
  },
  error: {
    icon: <AlertTriangle size={14} className="text-amber-400" />,
    label: 'Sync failed',
    ariaLabel: 'Sync failed',
  },
  offline: {
    icon: <CloudOff size={14} className="text-slate-500" />,
    label: 'Offline',
    ariaLabel: 'Offline — favorites saved locally',
  },
};

export default function SyncStatusIndicator({ status, onRetry }: SyncStatusIndicatorProps) {
  const prevStatus = useRef<SyncStatus>(status);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prevStatus.current !== status) {
      prevStatus.current = status;
    }
  }, [status]);

  const config = STATUS_CONFIG[status];

  return (
    <div className="inline-flex items-center gap-1.5" role="status">
      <span aria-hidden="true" className="inline-flex items-center">
        {config.icon}
      </span>
      <span className="text-xs text-slate-400 hidden sm:inline">{config.label}</span>
      {status === 'error' && (
        <button
          onClick={onRetry}
          className="text-xs text-amber-400 hover:text-amber-300 underline ml-1"
          aria-label="Retry sync"
        >
          Retry
        </button>
      )}

      <div
        ref={liveRegionRef}
        aria-live="polite"
        className="sr-only"
      >
        {config.ariaLabel}
      </div>
    </div>
  );
}
