"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

/** Lightweight, accessible custom dropdown with smooth open/close animation. */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  className,
  icon,
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Sync active index with current value when opening.
  React.useEffect(() => {
    if (open) setActiveIndex(Math.max(0, options.indexOf(value)));
  }, [open, options, value]);

  const commit = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[activeIndex];
      if (option) commit(option);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300",
          "bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-900",
          "transition-all duration-200 hover:border-slate-400 hover:bg-slate-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70",
          open && "border-indigo-500 ring-2 ring-indigo-200",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className={cn("truncate", !value && "text-slate-400")}>
            {value || placeholder}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-slate-200",
            "bg-white p-1 shadow-xl shadow-slate-200/70",
            "animate-scale-in",
          )}
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No options</li>
          )}
          {options.map((option, idx) => {
            const selected = option === value;
            const active = idx === activeIndex;
            return (
              <li key={option} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(option)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm",
                    "transition-colors duration-150",
                    active ? "bg-indigo-50 text-slate-900" : "text-slate-700",
                    selected && "font-semibold",
                  )}
                >
                  <span className="truncate">{option}</span>
                  {selected && <Check className="h-4 w-4 text-indigo-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
