import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  Clock3,
  History,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type FavoriteTemplateStatus =
  | "up-to-date"
  | "update-available"
  | "deprecated"
  | "beta";

export type StatusHistoryEvent = {
  date: string;
  status: FavoriteTemplateStatus;
  note: string;
};

type StatusConfig = {
  label: string;
  description: string;
  tone: string;
  icon: LucideIcon;
};

const STATUS_CONFIG: Record<FavoriteTemplateStatus, StatusConfig> = {
  "up-to-date": {
    label: "Up to date",
    description: "Favorite matches the latest published template version.",
    tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    icon: CheckCircle2,
  },
  "update-available": {
    label: "Update available",
    description: "A newer template version is ready to review.",
    tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    icon: RefreshCw,
  },
  deprecated: {
    label: "Deprecated",
    description: "Template is kept for reference and should be migrated.",
    tone: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    icon: XCircle,
  },
  beta: {
    label: "Beta",
    description: "Template is experimental and may change quickly.",
    tone: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    icon: Beaker,
  },
};

const formatAuditDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

export function getFavoriteTemplateStatusConfig(status: FavoriteTemplateStatus) {
  return STATUS_CONFIG[status];
}

export default function FavoritesStatusIndicator({
  status,
  lastCheckedAt,
  history,
  compact = false,
}: {
  status: FavoriteTemplateStatus;
  lastCheckedAt: string;
  history: StatusHistoryEvent[];
  compact?: boolean;
}) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const latestHistory = history.slice(0, compact ? 1 : 3);

  return (
    <div className="space-y-3">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${config.tone}`}
        title={config.description}
      >
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </div>

      {!compact && (
        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
          <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <History className="h-3.5 w-3.5 text-teal-300" />
              Status audit trail
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Checked {formatAuditDate(lastCheckedAt)}
            </span>
          </div>

          <ol className="mt-3 space-y-2">
            {latestHistory.map((event) => {
              const eventConfig = STATUS_CONFIG[event.status];
              return (
                <li key={`${event.date}-${event.note}`} className="flex gap-2 text-xs">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-300 shadow-[0_0_10px_rgba(45,212,191,0.55)]" />
                  <span>
                    <span className="font-semibold text-slate-200">
                      {eventConfig.label}
                    </span>{" "}
                    <span className="text-slate-500">· {formatAuditDate(event.date)}</span>
                    <span className="block text-slate-400">{event.note}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {status === "deprecated" && !compact && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Review migration guidance before using this favorite in new projects.</span>
        </div>
      )}
    </div>
  );
}
