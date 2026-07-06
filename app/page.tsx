"use client";

import * as React from "react";
import {
  Download,
  FolderGit2,
  Loader2,
  ScanSearch,
  ShieldHalf,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { FileUpload } from "@/components/FileUpload";
import { TeamSelector } from "@/components/TeamSelector";
import { MaturityScore } from "@/components/MaturityScore";
import { StageDistribution } from "@/components/StageDistribution";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { AnomalyReport } from "@/components/AnomalyReport";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { parseFile } from "@/lib/parser";
import { exportAssessmentWorkbook } from "@/lib/export";
import {
  getAnswerRecords,
  getCategoryBreakdown,
  getMaturity,
} from "@/lib/metrics";
import { detectAnomaliesLocal, sortAnomalies } from "@/lib/anomalies";
import type { Anomaly, AnomalySource, ParsedData } from "@/lib/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SAMPLE_FILE = "Security Governance - Effectiveness Questionnaire_v2.0.xlsx";
const SAMPLE_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function Page() {
  const [data, setData] = React.useState<ParsedData | null>(null);
  const [rawFile, setRawFile] = React.useState<File | null>(null);
  const [target, setTarget] = React.useState("");
  const [projectName, setProjectName] = React.useState("");
  const [booting, setBooting] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const [anomalies, setAnomalies] = React.useState<Anomaly[]>([]);
  const [anomalyLoading, setAnomalyLoading] = React.useState(false);
  const [anomalySource, setAnomalySource] = React.useState<AnomalySource | null>(
    null,
  );
  const [anomalyNotice, setAnomalyNotice] = React.useState<string | undefined>();
  const [anomalyModel, setAnomalyModel] = React.useState<string | undefined>();

  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const runAnalysis = React.useCallback(
    async (dataset: ParsedData, targetName: string) => {
      setAnomalyLoading(true);
      const records = getAnswerRecords(dataset, targetName);
      try {
        const res = await fetch("/api/analyze-anomalies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: targetName, answers: records }),
        });
        if (!res.ok) throw new Error(`status-${res.status}`);
        const json = await res.json();
        setAnomalies(Array.isArray(json.anomalies) ? json.anomalies : []);
        setAnomalySource(json.source ?? "fallback");
        setAnomalyNotice(json.notice);
        setAnomalyModel(json.model);
      } catch {
        // Network/route failure — degrade to client-side local engine.
        setAnomalies(sortAnomalies(detectAnomaliesLocal(records)));
        setAnomalySource("fallback");
        setAnomalyNotice(
          "Could not reach the analysis service — using the in-browser local engine.",
        );
        setAnomalyModel(undefined);
      } finally {
        setAnomalyLoading(false);
      }
    },
    [],
  );

  const ingest = React.useCallback(
    async (file: File) => {
      setBooting(true);
      setParseError(null);
      setExportError(null);
      setAnomalies([]);
      setAnomalySource(null);
      try {
        // Flow 2 — feed the sheet to the parser/metrics script that builds the
        // dashboard. Once this resolves the dashboard can render immediately.
        const [dataset] = await Promise.all([parseFile(file), delay(600)]);
        const firstTarget = dataset.assessments[0] ?? "";
        setData(dataset);
        setRawFile(file);
        setTarget(firstTarget);
        // Flow 1 — feed the same sheet to the LLM for anomaly detection. This
        // runs independently (not awaited) so the dashboard is never blocked on
        // the model; the anomaly panel surfaces its own loading state.
        if (firstTarget) void runAnalysis(dataset, firstTarget);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong while parsing the file.";
        setParseError(message);
        setData(null);
      } finally {
        setBooting(false);
      }
    },
    [runAnalysis],
  );

  const handleTargetChange = React.useCallback(
    (next: string) => {
      setTarget(next);
      if (data) void runAnalysis(data, next);
    },
    [data, runAnalysis],
  );

  const loadSample = React.useCallback(async () => {
    setBooting(true);
    setParseError(null);
    try {
      const res = await fetch(`/${encodeURIComponent(SAMPLE_FILE)}`);
      if (!res.ok) throw new Error("Could not load the sample questionnaire.");
      const blob = await res.blob();
      const file = new File([blob], SAMPLE_FILE, { type: SAMPLE_MIME });
      await ingest(file);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Could not load the sample questionnaire.",
      );
      setBooting(false);
    }
  }, [ingest]);

  const reset = React.useCallback(() => {
    setData(null);
    setRawFile(null);
    setTarget("");
    setProjectName("");
    setAnomalies([]);
    setAnomalySource(null);
    setAnomalyNotice(undefined);
    setAnomalyModel(undefined);
    setParseError(null);
    setExportError(null);
  }, []);

  const handleExport = React.useCallback(async () => {
    if (!data || !target) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportAssessmentWorkbook({
        rawFile,
        data,
        target,
        projectName,
        anomalies,
      });
    } catch {
      setExportError(
        "Could not generate the Excel file. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }, [rawFile, data, target, projectName, anomalies]);

  const maturity = React.useMemo(
    () => (data && target ? getMaturity(data, target) : null),
    [data, target],
  );
  const categoryMetrics = React.useMemo(
    () => (data && target ? getCategoryBreakdown(data, target) : []),
    [data, target],
  );

  return (
    <div className="min-h-screen">
      <Navbar hasData={!!data} fileName={data?.fileName} onReset={reset} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {booting ? (
          <BootingScreen />
        ) : !data ? (
          <Hero
            onFile={ingest}
            onLoadSample={loadSample}
            error={parseError}
          />
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Section B: Assessment selection + executive score cards */}
            <section className="space-y-5">
              <SectionHeading
                eyebrow="Overview"
                title="Executive Maturity Summary"
                description="Cumulative maturity score and stage distribution for the selected assessment."
              />

              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
                    <TeamSelector
                      options={data.assessments}
                      value={target}
                      onChange={handleTargetChange}
                    />
                    <div className="space-y-2">
                      <label
                        htmlFor="project-name"
                        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500"
                      >
                        <FolderGit2 className="h-3.5 w-3.5" />
                        Project Name
                      </label>
                      <input
                        id="project-name"
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="e.g. Payments Platform"
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting || anomalyLoading}
                    className="h-9 shrink-0"
                    title={
                      anomalyLoading
                        ? "Waiting for anomaly analysis to finish…"
                        : "Export the original sheet, scored matrix, and anomalies"
                    }
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {exporting ? "Exporting…" : "Export to Excel"}
                  </Button>
                </div>
                {exportError && (
                  <p className="mt-3 text-xs text-rose-600">{exportError}</p>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  {maturity && (
                    <MaturityScore target={target} metrics={maturity} />
                  )}
                </div>
                <div className="lg:col-span-2">
                  {maturity && (
                    <StageDistribution distribution={maturity.distribution} />
                  )}
                </div>
              </div>

              {categoryMetrics.length > 0 && (
                <CategoryBreakdown metrics={categoryMetrics} />
              )}
            </section>

            {/* Section C: AI validation & justification anomalies */}
            <section className="space-y-5">
              <SectionHeading
                eyebrow="AI Engine"
                title="Validation & Justification Anomalies"
                description="Flags comment-vs-score contradictions and upstream dependency conflicts."
              />
              <AnomalyReport
                anomalies={anomalies}
                loading={anomalyLoading}
                source={anomalySource}
                notice={anomalyNotice}
                model={anomalyModel}
              />
            </section>

            {/* Section D: Deep-dive raw matrix */}
            <section className="space-y-5">
              <SectionHeading
                eyebrow="Source Data"
                title="Deep-Dive Assessment Matrix"
                description="Color-coded scores with per-item description & evidence on click."
              />
              <DataTable data={data} target={target} />
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-6">
        <p className="text-center text-xs text-slate-500">
          SecPulse · Anomaly analysis powered by GitHub Models with a local
          deterministic fallback.
        </p>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-views                                                           */
/* ------------------------------------------------------------------ */

function Hero({
  onFile,
  onLoadSample,
  error,
}: {
  onFile: (file: File) => void;
  onLoadSample: () => void;
  error: string | null;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center sm:py-16">
      <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 animate-fade-in">
        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
        AI-Powered Security Maturity Tracker
      </span>

      <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl animate-fade-in">
        SecPulse{" "}
        <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 bg-clip-text text-transparent">
          Dashboard
        </span>
      </h1>

      <p className="mt-4 max-w-lg text-base text-slate-600 animate-fade-in">
        Upload an application-security questionnaire to score maturity and let
        GitHub Models surface logical anomalies between scores and their
        justifications.
      </p>

      <div className="mt-10 w-full animate-scale-in">
        <FileUpload onFile={onFile} onLoadSample={onLoadSample} error={error} />
      </div>
    </div>
  );
}

function BootingScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-28 text-center animate-fade-in">
      <div className="relative grid h-20 w-20 place-items-center">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-indigo-500/20" />
        <div className="relative grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-glow-indigo">
          <ShieldHalf className="h-9 w-9 text-white" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-900">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          Parsing questionnaire &amp; scoring maturity…
        </p>
        <p className="flex items-center justify-center gap-1.5 text-sm text-slate-500">
          <ScanSearch className="h-4 w-4" />
          Reading the sheet and computing tier scores — AI anomaly detection runs next
        </p>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}
