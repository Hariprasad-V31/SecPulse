import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o";
const REQUEST_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You are a critical Application Security reviewer performing a maturity assessment critique. For each assessment item you are given:
- The assessment question (what is being evaluated)
- The description (what this question actually means in practice)
- The examples/evidence (concrete indicators teams should demonstrate)
- The team's self-assessed score
- The team's remarks/justification

Your job: Write a SHORT critical review (2-3 sentences) for each item that:
1. Evaluates whether the team's remarks/justification adequately address the SPECIFIC expectations described in the description and examples/evidence.
2. Identifies gaps — what is the team NOT demonstrating or mentioning that the evidence criteria expects?
3. Provides a specific, actionable next step tied to the item's context.

Be direct and constructive. If the score is high but the justification is vague or doesn't match the evidence criteria, flag it. If N/A with no justification, challenge it. If the score is low, reference what the description/evidence expects and recommend a concrete first action.

Return a JSON array of strings, one critique per item in the same order provided.
Return ONLY the raw JSON array, no markdown fences.`;

interface AnswerInput {
  question: string;
  description: string;
  evidence: string;
  selected_score: string;
  comment: string;
}

interface RemediateRequest {
  category: string;
  answers: AnswerInput[];
}

function generateRuleBasedCritique(a: AnswerInput): string {
  const hasComment = a.comment && a.comment.trim().length > 0;
  const commentShort = hasComment && a.comment.trim().length < 20;
  const evidenceSnippet = (a.evidence || a.description || "the stated criteria").slice(0, 100);

  if (!a.selected_score || a.selected_score === "(blank)") {
    return `Unscored item. The expected evidence includes: "${evidenceSnippet}..." — assess current state and assign a baseline score.`;
  }
  if (a.selected_score.toLowerCase().includes("n/a") && !hasComment) {
    return `N/A claimed without justification. The assessment expects evidence of: "${evidenceSnippet}..." — explain why this control is not applicable to your context.`;
  }
  if (a.selected_score.includes("[0]")) {
    return `Not started. Per the assessment criteria, you should demonstrate: "${evidenceSnippet}..." — define ownership and create an implementation plan for this practice.`;
  }
  if (a.selected_score.includes("[1]")) {
    if (!hasComment || commentShort) {
      return `Score [1] with insufficient justification. The evidence criteria expects: "${evidenceSnippet}..." — document your existing practices and show how they map to these expectations.`;
    }
    return `Ad-hoc practices noted. To progress, formalize into documented repeatable processes that demonstrate: "${evidenceSnippet}..."`;
  }
  if (a.selected_score.includes("[2]")) {
    if (!hasComment || commentShort) {
      return `Score [2] claimed but remarks lack detail. Expected evidence: "${evidenceSnippet}..." — provide specific artifacts or metrics that prove consistent application.`;
    }
    return `Consistent practices claimed. To reach embedded maturity, add quantitative metrics and regular reviews demonstrating: "${evidenceSnippet}..."`;
  }
  // [3] - Embedded
  if (!hasComment || commentShort) {
    return `Highest score [3] claimed with minimal justification. The assessment requires evidence of: "${evidenceSnippet}..." — substantiate with specific artifacts, metrics, or audit results.`;
  }
  return `Embedded maturity claimed. Verify through periodic audits that the team continues to demonstrate: "${evidenceSnippet}..."`;
}

export async function POST(request: Request) {
  let body: RemediateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.answers || body.answers.length === 0) {
    return NextResponse.json({ error: "No answers provided" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    const remedies = body.answers.map((a) => generateRuleBasedCritique(a));
    return NextResponse.json({ remedies });
  }

  const endpoint = process.env.GITHUB_MODELS_ENDPOINT || DEFAULT_ENDPOINT;
  const model = process.env.GITHUB_MODEL || DEFAULT_MODEL;

  const userPrompt = `Category: ${body.category}\n\nItems to critique:\n${JSON.stringify(
    body.answers.map((a) => ({
      question: a.question,
      description: a.description || "(no description)",
      expected_evidence: a.evidence || "(no evidence criteria)",
      score: a.selected_score || "(blank)",
      team_remarks: a.comment || "(no remarks provided)",
    })),
    null,
    2,
  )}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`LLM returned ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "[]";

    const cleaned = content
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .trim();
    let remedies: string[];
    try {
      remedies = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start !== -1 && end > start) {
        remedies = JSON.parse(cleaned.slice(start, end + 1));
      } else {
        throw new Error("Failed to parse remedies");
      }
    }

    while (remedies.length < body.answers.length) {
      remedies.push("Review this item against the stated evidence criteria and identify gaps.");
    }

    return NextResponse.json({ remedies });
  } catch {
    // Fallback to rule-based critique
    const remedies = body.answers.map((a) => generateRuleBasedCritique(a));
    return NextResponse.json({ remedies });
  } finally {
    clearTimeout(timeout);
  }
}
