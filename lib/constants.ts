import {
  Cloud,
  Code2,
  Container,
  KeyRound,
  LayoutDashboard,
  Package,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ScoreTier } from "./scores";

interface CategoryStyle {
  icon: LucideIcon;
  /** Tailwind text color for the icon. */
  color: string;
  /** Tailwind background tint for the icon chip. */
  tint: string;
}

const DEFAULT_STYLE: CategoryStyle = {
  icon: ShieldCheck,
  color: "text-indigo-600",
  tint: "bg-indigo-50",
};

/**
 * Map a free-form category label to a representative icon + accent.
 * Matching is keyword based so it tolerates wording differences.
 */
export function getCategoryStyle(category: string): CategoryStyle {
  const c = category.toLowerCase();

  if (/(1st|first)\b|secure coding|sast|static analysis/.test(c)) {
    return { icon: Code2, color: "text-sky-600", tint: "bg-sky-50" };
  }
  if (/(3rd|third)\b|dependenc|sca|supply chain|package/.test(c)) {
    return { icon: Package, color: "text-violet-600", tint: "bg-violet-50" };
  }
  if (/container|image|docker|registry/.test(c)) {
    return { icon: Container, color: "text-cyan-600", tint: "bg-cyan-50" };
  }
  if (/credential|secret|key|vault|password/.test(c)) {
    return { icon: KeyRound, color: "text-amber-600", tint: "bg-amber-50" };
  }
  if (/cloud|deploy|infra|iam|wiz|aws|azure|gcp/.test(c)) {
    return { icon: Cloud, color: "text-emerald-600", tint: "bg-emerald-50" };
  }
  if (/dashboard|track|monitor|metric|report/.test(c)) {
    return {
      icon: LayoutDashboard,
      color: "text-fuchsia-600",
      tint: "bg-fuchsia-50",
    };
  }

  return DEFAULT_STYLE;
}

/** Accent color helper for maturity percentages. */
export function scoreAccent(percent: number): {
  ring: string;
  text: string;
  label: string;
} {
  if (percent >= 80) {
    return { ring: "stroke-emerald-500", text: "text-emerald-600", label: "Strong" };
  }
  if (percent >= 60) {
    return { ring: "stroke-lime-500", text: "text-lime-600", label: "Solid" };
  }
  if (percent >= 40) {
    return { ring: "stroke-amber-500", text: "text-amber-600", label: "Developing" };
  }
  return { ring: "stroke-rose-500", text: "text-rose-600", label: "At Risk" };
}

export interface TierStyle {
  label: string;
  /** Short label for compact chips. */
  shortLabel: string;
  /** Badge text color. */
  text: string;
  /** Badge background tint. */
  bg: string;
  /** Badge border color. */
  border: string;
  /** Solid color for bars / dots. */
  solid: string;
  /** Row accent (left border) tint for the data table. */
  rowAccent: string;
}

/** Visual treatment for each maturity tier across the dashboard. */
export const TIER_STYLES: Record<ScoreTier, TierStyle> = {
  "not-started": {
    label: "Not Started",
    shortLabel: "Not Started",
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    solid: "bg-rose-500",
    rowAccent: "border-l-rose-400",
  },
  partial: {
    label: "Partially Implemented",
    shortLabel: "Partial",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    solid: "bg-amber-500",
    rowAccent: "border-l-amber-400",
  },
  consistent: {
    label: "Consistently Implemented",
    shortLabel: "Consistent",
    text: "text-lime-700",
    bg: "bg-lime-50",
    border: "border-lime-200",
    solid: "bg-lime-500",
    rowAccent: "border-l-lime-400",
  },
  embedded: {
    label: "Embedded & Measured",
    shortLabel: "Embedded",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    solid: "bg-emerald-500",
    rowAccent: "border-l-emerald-400",
  },
  na: {
    label: "Not Applicable",
    shortLabel: "N/A",
    text: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
    solid: "bg-slate-400",
    rowAccent: "border-l-slate-300",
  },
};
