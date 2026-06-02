import { ArrowRight, Bell, GitCompare, PackageCheck, Sparkles } from "lucide-react";

export type VersionComparisonProps = {
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  changelog: string;
};

const parseVersion = (version: string) =>
  version
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

const compareVersions = (currentVersion: string, latestVersion: string) => {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);
  const length = Math.max(current.length, latest.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = current[index] ?? 0;
    const latestPart = latest[index] ?? 0;

    if (latestPart > currentPart) return "behind";
    if (latestPart < currentPart) return "ahead";
  }

  return "current";
};

const formatReleaseDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

export default function VersionComparison({
  currentVersion,
  latestVersion,
  releaseDate,
  changelog,
}: VersionComparisonProps) {
  const comparison = compareVersions(currentVersion, latestVersion);
  const hasUpdate = comparison === "behind";

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <GitCompare className="h-4 w-4 text-orange-300" />
          Version comparison
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            hasUpdate
              ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {hasUpdate ? <Bell className="h-3 w-3" /> : <PackageCheck className="h-3 w-3" />}
          {hasUpdate ? "Notify team" : "Synced"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Favorite</p>
          <p className="mt-1 text-lg font-bold text-slate-100">{currentVersion}</p>
        </div>
        <ArrowRight className="hidden h-4 w-4 text-slate-500 sm:block" />
        <div className="rounded-xl border border-teal-400/20 bg-teal-400/10 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-teal-200/70">Latest</p>
          <p className="mt-1 text-lg font-bold text-teal-100">{latestVersion}</p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" />
        <span>
          <span className="font-semibold text-slate-100">{formatReleaseDate(releaseDate)}:</span>{" "}
          {changelog}
        </span>
      </div>
    </div>
  );
}
