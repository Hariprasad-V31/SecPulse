"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  FileUp,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFile: (file: File) => void;
  onLoadSample?: () => void;
  disabled?: boolean;
  error?: string | null;
}

const ACCEPTED = [".xlsx", ".xls", ".csv"];

function isAccepted(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED.some((ext) => lower.endsWith(ext));
}

export function FileUpload({
  onFile,
  onLoadSample,
  disabled,
  error,
}: FileUploadProps) {
  const [dragging, setDragging] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      setLocalError(null);
      const file = files?.[0];
      if (!file) return;
      if (!isAccepted(file)) {
        setLocalError("Unsupported file type. Please upload a .xlsx, .xls, or .csv file.");
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const shownError = error ?? localError;

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70",
          dragging
            ? "border-indigo-400 bg-indigo-50 shadow-glow-indigo"
            : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />

        <div
          className={cn(
            "grid h-16 w-16 place-items-center rounded-2xl transition-all duration-300",
            dragging
              ? "scale-110 bg-indigo-100 text-indigo-600"
              : "bg-slate-100 text-slate-500 group-hover:text-indigo-600",
          )}
        >
          <FileUp className="h-7 w-7" />
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-900">
            {dragging ? "Drop to upload" : "Drag & drop your questionnaire"}
          </p>
          <p className="text-sm text-slate-600">
            or{" "}
            <span className="font-medium text-indigo-600 underline-offset-4 group-hover:underline">
              browse files
            </span>{" "}
            from your computer
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1">
            <FileSpreadsheet className="h-3.5 w-3.5" /> .xlsx
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1">
            <FileSpreadsheet className="h-3.5 w-3.5" /> .csv
          </span>
        </div>
      </div>

      {shownError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 animate-fade-in-fast">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{shownError}</span>
        </div>
      )}

      {onLoadSample && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onLoadSample}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-indigo-600 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Or explore with the sample dataset
          </button>
        </div>
      )}
    </div>
  );
}
