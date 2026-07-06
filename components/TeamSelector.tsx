"use client";

import { Users } from "lucide-react";
import { Select } from "@/components/ui/select";

interface TeamSelectorProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function TeamSelector({
  options,
  value,
  onChange,
  label = "Assessment Target",
}: TeamSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
        <Users className="h-3.5 w-3.5" />
        {label}
        <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {options.length}
        </span>
      </label>
      <Select
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={label}
        placeholder="Select an assessment…"
        icon={<Users className="h-4 w-4 text-indigo-600" />}
      />
    </div>
  );
}
