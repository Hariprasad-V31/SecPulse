"use client";

import { Activity, ShieldHalf, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  hasData: boolean;
  fileName?: string;
  onReset?: () => void;
}

export function Navbar({ hasData, fileName, onReset }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glow-indigo">
            <ShieldHalf className="h-5 w-5 text-white" />
            <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 ring-2 ring-white">
              <Activity className="h-2 w-2 text-white" />
            </span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              SecPulse
            </p>
            <p className="hidden text-xs text-slate-500 sm:block">
              Security Maturity Tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {hasData && fileName && (
            <Badge variant="indigo" className="hidden max-w-[200px] md:inline-flex">
              <span className="truncate">{fileName}</span>
            </Badge>
          )}
          {hasData && onReset && (
            <Button variant="outline" size="sm" onClick={onReset}>
              <Upload className="h-3.5 w-3.5" />
              New file
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
