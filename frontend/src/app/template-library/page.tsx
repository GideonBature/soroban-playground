"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  BellRing,
  BookOpen,
  Boxes,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Filter,
  Heart,
  History,
  Library,
  Search,
  ShieldCheck,
  SortAsc,
  Star,
  Tags,
} from "lucide-react";
import FavoritesStatusIndicator, {
  type FavoriteTemplateStatus,
  type StatusHistoryEvent,
  getFavoriteTemplateStatusConfig,
} from "@/components/FavoritesStatusIndicator";
import VersionComparison from "@/components/VersionComparison";

type TemplateFavorite = {
  id: string;
  name: string;
  directory: string;
  description: string;
  currentVersion: string;
  latestVersion: string;
  status: FavoriteTemplateStatus;
  category: string;
  lastCheckedAt: string;
  latestReleaseDate: string;
  stars: number;
  readmeSignal: string;
  changelog: string;
  history: StatusHistoryEvent[];
};

type StatusFilter = FavoriteTemplateStatus | "all";
type SortMode = "status" | "version" | "name" | "lastChecked";

const FAVORITE_TEMPLATES: TemplateFavorite[] = [
  {
    id: "quadratic-voting",
    name: "Quadratic Voting",
    directory: "contracts/quadratic-voting",
    description:
      "Governance template with credit-weighted voting rounds, voter registration, and educational comments for DAO experiments.",
    currentVersion: "v1.3.0",
    latestVersion: "v1.4.0",
    status: "update-available",
    category: "Governance",
    lastCheckedAt: "2026-05-29",
    latestReleaseDate: "2026-05-26",
    stars: 42,
    readmeSignal: "README references a new tally snapshot flow and migration note.",
    changelog: "Adds vote receipt metadata and a safer round-closing helper for testnet simulations.",
    history: [
      {
        date: "2026-05-29",
        status: "update-available",
        note: "Detected v1.4.0 in template metadata while favorite remained on v1.3.0.",
      },
      {
        date: "2026-04-18",
        status: "up-to-date",
        note: "Favorite was synced after the v1.3.0 contract README refresh.",
      },
      {
        date: "2026-03-12",
        status: "beta",
        note: "Marked beta during initial governance template review.",
      },
    ],
  },
  {
    id: "escrow",
    name: "Escrow Basics",
    directory: "contracts/escrow",
    description:
      "Starter escrow contract covering deposits, release conditions, dispute hooks, and wallet simulation prompts.",
    currentVersion: "v2.1.2",
    latestVersion: "v2.1.2",
    status: "up-to-date",
    category: "Payments",
    lastCheckedAt: "2026-05-30",
    latestReleaseDate: "2026-05-10",
    stars: 57,
    readmeSignal: "README metadata matches the selected favorite version.",
    changelog: "No new changes since the last favorite sync.",
    history: [
      {
        date: "2026-05-30",
        status: "up-to-date",
        note: "Validated Cargo metadata, README front matter, and sample deployment steps.",
      },
      {
        date: "2026-04-06",
        status: "update-available",
        note: "v2.1.2 was available before the favorite was updated.",
      },
      {
        date: "2026-03-15",
        status: "up-to-date",
        note: "Initial favorite was pinned to v2.1.1.",
      },
    ],
  },
  {
    id: "token-burn",
    name: "Token Burn",
    directory: "contracts/token-burn",
    description:
      "Supply reduction example that demonstrates authorization checks, ledger events, and burn accounting.",
    currentVersion: "v0.9.0",
    latestVersion: "v1.0.0",
    status: "deprecated",
    category: "Token Utilities",
    lastCheckedAt: "2026-05-24",
    latestReleaseDate: "2026-05-18",
    stars: 31,
    readmeSignal: "README now recommends the v1.0.0 token lifecycle template for new projects.",
    changelog: "Deprecates the old standalone burn helper in favor of lifecycle-managed token operations.",
    history: [
      {
        date: "2026-05-24",
        status: "deprecated",
        note: "Template metadata marked v0.9.0 as deprecated after lifecycle API consolidation.",
      },
      {
        date: "2026-04-20",
        status: "update-available",
        note: "Release candidate v1.0.0-rc.1 became available.",
      },
      {
        date: "2026-02-28",
        status: "up-to-date",
        note: "Favorite matched v0.9.0 examples and audit comments.",
      },
    ],
  },
  {
    id: "supply-chain-oracle",
    name: "Supply Chain Oracle",
    directory: "contracts/supply-chain-oracle",
    description:
      "Oracle-backed logistics template with shipment checkpoints, attestation payloads, and freshness checks.",
    currentVersion: "v0.7.0-beta",
    latestVersion: "v0.8.0-beta",
    status: "beta",
    category: "Real World Assets",
    lastCheckedAt: "2026-05-27",
    latestReleaseDate: "2026-05-22",
    stars: 26,
    readmeSignal: "README labels oracle freshness logic as beta while integration tests mature.",
    changelog: "Improves checkpoint confidence scoring and documents retry windows for stale oracle data.",
    history: [
      {
        date: "2026-05-27",
        status: "beta",
        note: "Latest README retained beta status and added a stability warning.",
      },
      {
        date: "2026-04-27",
        status: "beta",
        note: "Favorite first tracked after oracle sample contracts were added.",
      },
    ],
  },
];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "up-to-date", label: "Up to date" },
  { value: "update-available", label: "Update available" },
  { value: "deprecated", label: "Deprecated" },
  { value: "beta", label: "Beta" },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "status", label: "Status priority" },
  { value: "version", label: "Version gap" },
  { value: "lastChecked", label: "Last checked" },
  { value: "name", label: "Name" },
];

const STATUS_PRIORITY: Record<FavoriteTemplateStatus, number> = {
  deprecated: 0,
  "update-available": 1,
  beta: 2,
  "up-to-date": 3,
};

const parseVersionScore = (version: string) =>
  version
    .replace(/^v/i, "")
    .replace(/-beta/i, "")
    .split(".")
    .reduce((score, part, index) => score + (Number.parseInt(part, 10) || 0) * 100 ** (2 - index), 0);

const getVersionGap = (template: TemplateFavorite) =>
  parseVersionScore(template.latestVersion) - parseVersionScore(template.currentVersion);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));

export default function TemplateLibraryPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("status");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return FAVORITE_TEMPLATES.filter((template) => {
      const matchesStatus = statusFilter === "all" || template.status === statusFilter;
      const matchesQuery =
        query.length === 0 ||
        [template.name, template.category, template.directory, template.description]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesStatus && matchesQuery;
    }).sort((first, second) => {
      if (sortMode === "status") {
        return STATUS_PRIORITY[first.status] - STATUS_PRIORITY[second.status];
      }

      if (sortMode === "version") {
        return getVersionGap(second) - getVersionGap(first);
      }

      if (sortMode === "lastChecked") {
        return new Date(second.lastCheckedAt).getTime() - new Date(first.lastCheckedAt).getTime();
      }

      return first.name.localeCompare(second.name);
    });
  }, [searchQuery, sortMode, statusFilter]);

  const statusCounts = FAVORITE_TEMPLATES.reduce(
    (counts, template) => ({
      ...counts,
      [template.status]: counts[template.status] + 1,
    }),
    {
      "up-to-date": 0,
      "update-available": 0,
      deprecated: 0,
      beta: 0,
    } satisfies Record<FavoriteTemplateStatus, number>,
  );

  const updateNotifications = FAVORITE_TEMPLATES.filter(
    (template) => template.status === "update-available" || template.status === "deprecated",
  ).length;

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 shadow-2xl shadow-teal-950/20 backdrop-blur">
        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-44 w-44 rounded-full bg-orange-400/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
                <Library className="h-3.5 w-3.5" />
                Contract template library
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                Favorite template status indicators
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Track favorite Soroban templates at a glance with visual health states, README-derived signals,
                version comparisons, update notifications, status filters, sorting, and audit history.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                  <BellRing className="h-3.5 w-3.5" />
                  Notifications
                </p>
                <p className="mt-2 text-3xl font-black text-cyan-100">{updateNotifications}</p>
                <p className="text-xs text-cyan-100/70">favorites require review</p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Current
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-100">{statusCounts["up-to-date"]}</p>
                <p className="text-xs text-emerald-100/70">favorites are synced</p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                  <History className="h-3.5 w-3.5" />
                  Audit events
                </p>
                <p className="mt-2 text-3xl font-black text-amber-100">
                  {FAVORITE_TEMPLATES.reduce((total, template) => total + template.history.length, 0)}
                </p>
                <p className="text-xs text-amber-100/70">status changes recorded</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 backdrop-blur sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search favorite templates, categories, or contract directories"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition focus:border-teal-400/70 focus:ring-2 focus:ring-teal-400/20"
            />
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
            <Filter className="h-4 w-4 text-teal-300" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="bg-transparent text-sm text-slate-100 outline-none"
            >
              {STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value} className="bg-slate-950">
                  {filter.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
            <SortAsc className="h-4 w-4 text-orange-300" />
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="bg-transparent text-sm text-slate-100 outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-950">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.filter((filter) => filter.value !== "all").map((filter) => {
            const status = filter.value as FavoriteTemplateStatus;
            const config = getFavoriteTemplateStatusConfig(status);
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === status
                    ? config.tone
                    : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {filter.label}: {statusCounts[status]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5">
        {filteredTemplates.map((template) => (
          <article
            key={template.id}
            className="rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur transition hover:border-teal-400/30 sm:p-6"
          >
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-semibold text-slate-300">
                        <Heart className="h-3.5 w-3.5 fill-rose-300 text-rose-300" />
                        Favorite
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                        <Tags className="h-3.5 w-3.5" />
                        {template.category}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                        <Star className="h-3.5 w-3.5 text-amber-300" />
                        {template.stars}
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black text-white">{template.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{template.description}</p>
                  </div>

                  <FavoritesStatusIndicator
                    status={template.status}
                    lastCheckedAt={template.lastCheckedAt}
                    history={template.history}
                    compact
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Boxes className="h-3.5 w-3.5" />
                      Directory
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-teal-200">{template.directory}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Last checked
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{formatDate(template.lastCheckedAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <BookOpen className="h-3.5 w-3.5" />
                      README signal
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{template.readmeSignal}</p>
                  </div>
                </div>

                <VersionComparison
                  currentVersion={template.currentVersion}
                  latestVersion={template.latestVersion}
                  releaseDate={template.latestReleaseDate}
                  changelog={template.changelog}
                />
              </div>

              <div className="space-y-4">
                <FavoritesStatusIndicator
                  status={template.status}
                  lastCheckedAt={template.lastCheckedAt}
                  history={template.history}
                />

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <ShieldCheck className="h-4 w-4 text-teal-300" />
                    Recommended next action
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {template.status === "up-to-date" &&
                      "Keep this template pinned; the current favorite matches the latest contract metadata."}
                    {template.status === "update-available" &&
                      "Review the changelog, compare generated files, and update the favorite version when tests pass."}
                    {template.status === "deprecated" &&
                      "Plan a migration to the replacement template before starting new contract work."}
                    {template.status === "beta" &&
                      "Use for prototypes and monitor the audit trail for stability or breaking metadata changes."}
                  </p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      {filteredTemplates.length === 0 && (
        <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/45 p-10 text-center">
          <CircleDot className="mx-auto h-10 w-10 text-slate-500" />
          <h2 className="mt-4 text-xl font-bold text-slate-100">No favorites match these filters</h2>
          <p className="mt-2 text-sm text-slate-400">
            Clear the search query or choose another status to see template favorites.
          </p>
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 backdrop-blur sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          <ArrowDownAZ className="h-4 w-4 text-orange-300" />
          Status workflow
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {STATUS_FILTERS.filter((filter) => filter.value !== "all").map((filter) => {
            const status = filter.value as FavoriteTemplateStatus;
            const config = getFavoriteTemplateStatusConfig(status);
            const Icon = config.icon;
            return (
              <div key={status} className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4">
                <div className={`inline-flex rounded-xl border p-2 ${config.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 font-bold text-slate-100">{config.label}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{config.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
