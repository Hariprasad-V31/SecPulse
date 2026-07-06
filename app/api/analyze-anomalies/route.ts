import { NextResponse } from "next/server";
import {
  coerceAnomalies,
  detectAnomaliesLocal,
  sortAnomalies,
} from "@/lib/anomalies";
import type {
  AnomalyRequest,
  AnomalyResponse,
  AnswerRecord,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o";
const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Sampling controls for reproducibility. `temperature: 0` makes the model pick
 * the most-likely token at every step (greedy), `top_p: 1` disables nucleus
 * sampling, and a fixed `seed` pins the backend RNG so identical input yields
 * the same output on a best-effort basis. Note: GPT-4o is not bit-for-bit
 * deterministic even so — minor backend floating-point/batching effects remain
 * — but run-to-run variance drops dramatically.
 */
const SAMPLING_TEMPERATURE = 0;
const SAMPLING_TOP_P = 1;

const SAMPLING_SEED = 42;

/** Verbatim system prompt for the AppSec maturity auditor persona. */
const SYSTEM_PROMPT = `You are an expert Application Security Auditor evaluating an organization's maturity spreadsheet. Your core job is to flag structural discrepancies and comment gaps.

**Look for two specific anomaly archetypes:**
1. **Comment vs Score Contradictions:** When a team claims a high maturity tier like \`Embedded & Measured [3]\` or \`Consistently Implemented [2]\`, but their written comment indicates work is still pending, incomplete, or merely 'planned for next quarter'. (e.g., Marking a scanning capability as fully embedded, but commenting: 'We are evaluating the tool right now').
2. **Dependency Disconnects:** When foundational capabilities (like 'Secure coding practices formally defined') are marked as \`Not Started [0]\`, but advanced downstream capabilities (like 'Testing for scanner-invisible vulnerabilities') are marked as \`Embedded & Measured [3]\`. It is highly improbable to embed advanced security metrics without foundational elements.

**Input Layout Provided per row:**
\`{"category": "...", "question": "...", "selected_score": "...", "comment": "..."}\`

- Judge every row using ONLY the provided fields. Never speculate, infer intent, or use outside knowledge.
- NEVER flag a "Comment Contradiction" when the \`comment\` is empty or whitespace — with no written justification there is nothing to contradict the score.
- Only flag a "Dependency Disconnect" when a foundational row is explicitly \`Not Started [0]\` AND a dependent advanced row is \`Embedded & Measured [3]\` within this same submission.
- If no row clearly matches an archetype, return an empty array \`[]\`.

**Strict JSON Response Format Required:**
Return ONLY a raw JSON array adhering exactly to this structure:
\`[{"type": "Comment Contradiction" | "Dependency Disconnect", "item": "The exact question text", "severity": "High" | "Medium", "explanation": "Clear, concise sentence pointing out exactly how the text in the comment field undermines the maturity score selected or conflicts with upstream dependencies."}]\``;

/** Build the compact JSON payload the auditor expects. */
function buildUserPrompt(target: string, answers: AnswerRecord[]): string {
  const rows = answers.map((a) => ({
    category: a.category,
    question: a.question,
    selected_score: a.selected_score || "(blank)",
    comment: a.comment || "",
  }));
  return `Assessment target: ${target}\n\nQuestionnaire rows:\n${JSON.stringify(
    rows,
    null,
    2,
  )}`;
}

/** Robustly extract a JSON array from an LLM text response. */
function parseJsonArray(text: string): unknown {
  const withoutFences = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // Try direct parse first.
  try {
    return JSON.parse(withoutFences);
  } catch {
    // Fall back to slicing the outermost array.
  }

  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(withoutFences.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** Validate the incoming request body. */
function validateBody(body: unknown): AnomalyRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.target !== "string" || !Array.isArray(b.answers)) return null;

  const answers: AnswerRecord[] = [];
  for (const item of b.answers) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.question !== "string") continue;
    const tier = rec.tier;
    answers.push({
      category: typeof rec.category === "string" ? rec.category : "General",
      maturityStage:
        typeof rec.maturityStage === "string" ? rec.maturityStage : "",
      question: rec.question,
      selected_score:
        typeof rec.selected_score === "string" ? rec.selected_score : "",
      tier:
        tier === "not-started" ||
        tier === "partial" ||
        tier === "consistent" ||
        tier === "embedded" ||
        tier === "na"
          ? tier
          : null,
      comment: typeof rec.comment === "string" ? rec.comment : "",
    });
  }

  if (answers.length === 0) return null;
  return { target: b.target, answers };
}

/** Call GitHub Models. Throws on any non-success condition. */
async function callGitHubModels(
  target: string,
  answers: AnswerRecord[],
): Promise<{ anomalies: ReturnType<typeof coerceAnomalies>; model: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("missing-token");

  const endpoint = process.env.GITHUB_MODELS_ENDPOINT || DEFAULT_ENDPOINT;
  const model = process.env.GITHUB_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          temperature: SAMPLING_TEMPERATURE,
          top_p: SAMPLING_TOP_P,
          seed: SAMPLING_SEED,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(target, answers) },
          ],
        }),
        signal: controller.signal,
      });
    } catch (netErr) {
      // fetch() rejects on network/TLS failures (no HTTP status available).
      if (controller.signal.aborted) throw new Error("abort");
      const code =
        netErr instanceof Error &&
        "cause" in netErr &&
        netErr.cause &&
        typeof netErr.cause === "object" &&
        "code" in netErr.cause
          ? String((netErr.cause as { code?: unknown }).code)
          : "fetch-failed";
      throw new Error(`network-${code}`);
    }

    if (!res.ok) {
      throw new Error(`github-models-${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonArray(content);
    const anomalies = coerceAnomalies(parsed);
    return { anomalies, model };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const body = validateBody(parsedBody);
  if (!body) {
    return NextResponse.json(
      { error: "Request must include a target and a non-empty answers array." },
      { status: 400 },
    );
  }

  // Primary path: GitHub Models.
  try {
    console.log(process.env.GITHUB_TOKEN+"Hi")
    const { anomalies, model } = await callGitHubModels(
      body.target,
      body.answers,
    );
    const response: AnomalyResponse = {
      anomalies: sortAnomalies(anomalies),
      source: "github-llm",
      model,
    };
    return NextResponse.json(response);
  } catch (err) {
    // Graceful degradation to the deterministic local engine.
    const reason = err instanceof Error ? err.message : "unknown-error";
    const notice = noticeForReason(reason);

    const anomalies = sortAnomalies(detectAnomaliesLocal(body.answers));
    const response: AnomalyResponse = {
      anomalies,
      source: "fallback",
      notice,
    };
    return NextResponse.json(response);
  }
}

/** Build a human-friendly fallback notice from the failure reason. */
function noticeForReason(reason: string): string {
  if (reason === "missing-token") {
    return "GITHUB_TOKEN not set — using the built-in local anomaly engine.";
  }

  const statusMatch = reason.match(/github-models-(\d+)/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 401) {
      return "GitHub Models rejected the token (401 Unauthorized) — check it is valid. Using the local engine.";
    }
    if (status === 403) {
      return "GitHub Models denied access (403) — the token lacks the 'Models' permission, or Models isn't enabled for this account/org. Using the local engine.";
    }
    if (status === 404) {
      return `GitHub Models could not find the model (404) — check GITHUB_MODEL. Using the local engine.`;
    }
    if (status === 429) {
      return "GitHub Models rate limit hit (429) — using the local engine for now.";
    }
    return `GitHub Models request failed (${status}) — using the built-in local anomaly engine.`;
  }

  if (reason.includes("abort")) {
    return "GitHub Models timed out — using the built-in local anomaly engine.";
  }

  const netMatch = reason.match(/network-(.+)/);
  if (netMatch) {
    const code = netMatch[1];
    if (/CERT|ISSUER|SELF_SIGNED|TLS|SSL/i.test(code)) {
      return "Could not establish a trusted TLS connection to GitHub Models — a corporate proxy is likely intercepting HTTPS. Set NODE_EXTRA_CA_CERTS to your corporate root CA. Using the local engine.";
    }
    return "Could not reach GitHub Models (network error) — check connectivity/proxy. Using the built-in local anomaly engine.";
  }

  return "GitHub Models request failed — using the built-in local anomaly engine.";
}

