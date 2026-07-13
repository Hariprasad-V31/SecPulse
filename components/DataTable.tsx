"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  FileText,
  Info,
  MessageSquare,
  Minus,
  Search,
  Table2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { TIER_STYLES } from "@/lib/constants";
import { bracketLabelForTier, type ScoreTier } from "@/lib/scores";
import { cn } from "@/lib/utils";
import type { ParsedData, QuestionRow } from "@/lib/types";

interface DataTableProps {
  data: ParsedData;
  target: string;
  remedies?: string[];
}

function ScoreBadge({ tier }: { tier: ScoreTier | null }) {
  if (!tier) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-slate-400">
        <Minus className="h-3 w-3" />
        —
      </span>
    );
  }
  const style = TIER_STYLES[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        style.bg,
        style.border,
        style.text,
      )}
    >
      {style.shortLabel}
    </span>
  );
}

export function DataTable({ data, target, remedies = [] }: DataTableProps) {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState<QuestionRow | null>(null);

  // Map row.id → index in data.rows (which aligns with remedies[])
  const rowIdToIndex = React.useMemo(() => {
    const map = new Map<number, number>();
    data.rows.forEach((row, i) => map.set(row.id, i));
    return map;
  }, [data.rows]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter(
      (row) =>
        row.question.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q) ||
        row.maturityStage.toLowerCase().includes(q) ||
        (row.comments[target] ?? "").toLowerCase().includes(q),
    );
  }, [data.rows, query, target]);

  return (
    <>
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">
              <Table2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                AppSec Assessment Matrix
              </h2>
              <p className="text-xs text-slate-500">
                {filtered.length} of {data.rows.length} items · click a row for
                details
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items, categories, or comments…"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[40rem] overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
              <tr className="border-b border-slate-200">
                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Category
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Maturity Stage
                </th>
                <th className="min-w-[260px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Assessment Item
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Score
                </th>
                <th className="min-w-[200px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Comment
                </th>
                <th className="min-w-[220px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Remediation
                </th>
                <th className="px-2 py-3">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    No items match{" "}
                    <span className="font-medium text-slate-700">
                      &ldquo;{query}&rdquo;
                    </span>
                    .
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const tier = row.scores[target] ?? null;
                  const style = tier ? TIER_STYLES[tier] : null;
                  const comment = row.comments[target] ?? "";
                  const isNaMissingComment = tier === "na" && !comment.trim();
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setActive(row)}
                      className={cn(
                        "cursor-pointer border-b border-l-2 border-slate-200 transition-colors hover:bg-slate-50",
                        isNaMissingComment
                          ? "border-l-rose-400 bg-rose-50/50"
                          : style ? style.rowAccent : "border-l-transparent",
                      )}
                    >
                      <td className="px-4 py-3 align-top">
                        <span className="whitespace-nowrap text-xs text-slate-500">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="whitespace-nowrap text-xs text-slate-600">
                          {row.maturityStage || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-900">
                        {row.question}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <ScoreBadge tier={tier} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {comment ? (
                          <span
                            className="line-clamp-2 max-w-xs text-xs text-slate-600"
                            title={comment}
                          >
                            {comment}
                          </span>
                        ) : isNaMissingComment ? (
                          <span className="text-xs font-medium text-rose-600">
                            ⚠ Justification required for N/A
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {(() => {
                          const idx = rowIdToIndex.get(row.id) ?? -1;
                          const remedy = idx >= 0 ? remedies[idx] : "";
                          return remedy ? (
                            <span
                              className="line-clamp-2 max-w-xs text-xs text-indigo-700"
                              title={remedy}
                            >
                              {remedy}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-3 align-top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActive(row);
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                          aria-label="View description and evidence"
                          title="View description & evidence"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DetailDrawer
        row={active}
        target={target}
        onClose={() => setActive(null)}
      />
    </>
  );
}

/** Slide-in side panel revealing the full Description & Evidence for a row. */
function DetailDrawer({
  row,
  target,
  onClose,
}: {
  row: QuestionRow | null;
  target: string;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  // Render into <body> via a portal so the fixed-position overlay is anchored
  // to the viewport. Ancestor elements use transform-based animations
  // (animate-fade-in), which would otherwise become the containing block for a
  // `position: fixed` child and push this panel out of view.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const tier = row ? row.scores[target] ?? null : null;
  const style = tier ? TIER_STYLES[tier] : null;

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50",
        row ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!row}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
          row ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out",
          row ? "translate-x-0" : "translate-x-full",
        )}
      >
        {row && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {row.category}
                  </span>
                  {row.maturityStage && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {row.maturityStage}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug text-slate-900">
                  {row.question}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-auto p-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Selected Score
                </p>
                {style ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm font-medium",
                      style.bg,
                      style.border,
                      style.text,
                    )}
                  >
                    {bracketLabelForTier(tier)}
                  </span>
                ) : (
                  <span className="text-sm text-slate-500">Not answered</span>
                )}
              </div>

              <DrawerField
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="Comment / Justification"
                value={row.comments[target]}
                empty="No comment provided."
              />
              <DrawerField
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Description"
                value={row.description}
                empty="No description provided."
              />
              <DrawerField
                icon={<ClipboardList className="h-3.5 w-3.5" />}
                label="Examples / Evidence"
                value={row.evidence}
                empty="No evidence guidance provided."
              />
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
}

function DrawerField({
  label,
  value,
  empty,
  icon,
}: {
  label: string;
  value?: string;
  empty: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </p>
      <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
        {value && value.trim() ? (
          value
        ) : (
          <span className="text-slate-400">{empty}</span>
        )}
      </p>
    </div>
  );
}
