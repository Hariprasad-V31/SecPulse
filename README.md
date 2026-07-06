# SecPulse — AI-Powered Security Maturity Tracker

SecPulse is a sleek, single-page dashboard that parses an application-security
maturity questionnaire, scores the project against a four-tier maturity model,
and uses an LLM (via **GitHub Models**) to surface **logical anomalies** between
the scores and their justification comments.

The uploaded sheet drives **two independent flows**:

1. **AI anomaly detection** — the sheet is sent to the LLM, which flags
   contradictions between each score and its comment.
2. **Dashboard scoring** — the same sheet is parsed by the local scoring script
   to compute maturity and render the dashboard.

The dashboard renders as soon as parsing finishes; anomaly detection runs in
parallel and fills its panel when the model responds, so the view is never
blocked on the LLM.

Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and
**Lucide** icons.

---

## ✨ Features

- **Drag-and-drop upload** for `.xlsx`, `.xls`, and `.csv` questionnaires.
  In multi-sheet workbooks only the **`ApplicationSecurityv1`** sheet is read —
  the `Summary Dashboard` and unversioned `ApplicationSecurity` sheets are
  ignored.
- **Assessment selector** populated dynamically from each "Assessed Score" column.
- **Maturity gauge** — a weighted score (earned ÷ possible points) across the
  four tiers, with "Not Applicable" items excluded from the denominator.
- **Stage distribution** bars showing how many items sit in each maturity tier.
- **Category breakdown** mini-cards (Secure Coding, Dependency Hardening,
  Cloud Deployment, Credential Handling, Container Standardization, …).
- **AI Anomaly Report** — flags two archetypes: *Comment Contradictions*
  (a high score justified by a "still pending" comment) and *Dependency
  Disconnects* (an advanced control marked mature while its foundational
  prerequisite is "Not Started").
- **Interactive matrix** with live search, color-coded score badges, and a
  per-item detail drawer (description + evidence).
- **Resilient by design** — if no `GITHUB_TOKEN` is configured (or the API call
  fails), a deterministic local rule engine produces the same style of report.

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

> The `xlsx` dependency is pulled from the official SheetJS CDN tarball
> (`https://cdn.sheetjs.com/...`) to ship the patched, CVE-free build rather than
> the outdated npm release.

### 2. (Optional) Configure GitHub Models

Copy the example env file and add a GitHub token that has the **`models`**
permission:

```bash
cp .env.local.example .env.local
```

```dotenv
GITHUB_TOKEN=ghp_your_token_here
# Optional overrides:
# GITHUB_MODELS_ENDPOINT=https://models.github.ai/inference/chat/completions
# GITHUB_MODEL=openai/gpt-4o
```

Create a token at <https://github.com/settings/tokens>. **Without a token the app
still works** — it transparently falls back to the built-in local engine.

### 3. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>, then drag in your file or click
**"explore with the sample dataset"** to load the bundled
[`Security Governance - Effectiveness Questionnaire_v2.0.xlsx`](public/Security%20Governance%20-%20Effectiveness%20Questionnaire_v2.0.xlsx).

---

## 📄 Expected File Format

The parser targets the **`ApplicationSecurityv1`** layout — seven core columns,
followed by optional per-tier **"Scoring Criteria"** reference columns that the
parser ignores. **Category** and **Maturity Stage** are forward-filled, so they
may either repeat on every row or be left blank on continuation rows:

| Appsec Category | Appsec Maturity Stage | Assessment Item | Project Assessed Score | Comments | Description | Examples / Evidence |
| --------------- | --------------------- | --------------- | ---------------------- | -------- | ----------- | ------------------- |
| Security Requirements, Architecture & Design | Preventative | Are security architecture patterns defined and enforced in IaC? | Embedded & Measured [3] | Reviewed quarterly via CSPM. | Whether ZTA / least-privilege patterns are operationalised. | Reference architectures, OPA gates |
| Secure Development & Coding Practices | Preventative | Are secure coding practices formally defined and verified in review? | Not Started [0] | Standard still in draft. | Whether documented secure-coding standards are adopted. | Secure-coding standard, PR checklist |

- Columns are matched by **header keyword**, not fixed position, so banner rows
  above the header, reordered columns, or extra reference columns are handled
  automatically. In multi-sheet workbooks **only the versioned
  `ApplicationSecurityv1` sheet is read** — the `Summary Dashboard` and
  unversioned `ApplicationSecurity` sheets are intentionally skipped.
- **Assessed Score** accepts the bracketed tiers below (the `[0-3]` weight is
  read first, then keywords, then a bare `0-3`):

  | Tier | Points |
  | ---- | ------ |
  | `Not Started [0]` | 0 |
  | `Partially Implemented [1]` | 1 |
  | `Consistently Implemented [2]` | 2 |
  | `Embedded & Measured [3]` | 3 |
  | `Not Applicable` / `N/A` | excluded from scoring |

- Multiple **"Assessed Score"** columns are supported — each becomes a separate
  selectable assessment; a single column is labelled **"Project Assessment"**.

The bundled [`Security Governance - Effectiveness Questionnaire_v2.0.xlsx`](public/Security%20Governance%20-%20Effectiveness%20Questionnaire_v2.0.xlsx)
is the real template that teams complete (scores + comments).

---

## 🧠 How It Works

A single upload feeds two independent flows that share one parse pass:

```
                   ┌──────────────────────────────┐
  Uploaded sheet → │ parseFile → ParsedData        │
 (ApplicationSec…) └──────────────┬───────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼ Flow 1 (LLM)                                   ▼ Flow 2 (script)
  getAnswerRecords →                              getMaturity /
  POST /api/analyze-anomalies                     getCategoryBreakdown
          │                                               │
          ▼                                               ▼
  Anomaly panel (own loading state)            Dashboard renders immediately
```

### Flow 1 — AI anomaly detection

1. The selected assessment is flattened into records of
   `{ category, question, selected_score, comment }`.
2. `POST /api/analyze-anomalies` sends `{ target, answers }` to GitHub Models
   with an **AppSec Auditor** system prompt that hunts for two archetypes:
   - **Comment Contradiction** — a `[2]`/`[3]` score whose comment admits the
     work is still planned, in progress, or "evaluating".
   - **Dependency Disconnect** — an advanced control marked `[3]` while a
     foundational prerequisite is `Not Started [0]`.
3. The response is parsed into `[{ type, item, severity, explanation }]` and
   rendered as alert cards grouped by archetype.
4. If the token is missing or the request fails, `lib/anomalies.ts` reproduces
   the same two rules locally (regex-matched), so the panel is never empty.

### Flow 2 — Dashboard scoring

1. `lib/parser.ts` reads the sheet into a structured matrix.
2. `lib/metrics.ts` computes the weighted maturity score, stage distribution,
   and per-category breakdown.
3. The dashboard renders as soon as this resolves — it does **not** wait on the
   LLM. Switching the assessment target re-runs both flows.

---

## 🗂️ Project Structure

```
app/
  api/analyze-anomalies/route.ts   # GitHub Models call + local fallback
  layout.tsx                       # Root layout, fonts, theme
  page.tsx                         # Single-page orchestration & state
components/
  ui/                              # Card, Badge, Button, Select primitives
  Navbar, FileUpload, TeamSelector,
  MaturityScore, StageDistribution,
  CategoryBreakdown, AnomalyReport, DataTable
lib/
  scores.ts        # 4-tier maturity model (parse + weights)
  parser.ts        # xlsx / CSV → structured matrix (ApplicationSecurityv1 only)
  metrics.ts       # points-based maturity + category scoring
  anomalies.ts     # local rule engine + LLM output normalizer
  constants.ts     # category icons / tier styles
  types.ts         # shared domain types
public/
  Security Governance - Effectiveness Questionnaire_v2.0.xlsx
```

---

## 🛠️ Scripts

| Command         | Description               |
| --------------- | ------------------------- |
| `npm run dev`   | Start the dev server      |
| `npm run build` | Production build          |
| `npm run start` | Serve the production build|
