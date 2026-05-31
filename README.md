# Explainity

> AI-powered GitHub repository explainer — paste a repo URL, get a clear, structured, tutorial-style breakdown of how the codebase works.

Explainity fetches a repository's structure, README, and key source files via the GitHub API, then uses an LLM to generate five sections streamed live: **Summary**, **Architecture**, **Key Functions**, **Data Flow**, and **Execution Walkthrough**. Users can choose a detail level — beginner, intermediate, or advanced — and browse all past analyses in a History page.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Package manager | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Frontend | React + Vite + Tailwind CSS + shadcn/ui + framer-motion |
| API server | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI GPT-5.1 |
| Validation | Zod (`zod/v4`), `drizzle-zod` |
| API codegen | Orval (from OpenAPI spec) |
| Build | esbuild (CJS bundle) |
| Markdown rendering | react-markdown + remark-gfm + @tailwindcss/typography |

---

## Prerequisites

- **Node.js 24+**
- **pnpm** — install with `npm install -g pnpm`
- **PostgreSQL** database (local or hosted)
- OpenAI-compatible API key 
---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/pranavsan/Explainity.git
cd Explainity
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up the database

Push the Drizzle schema to your PostgreSQL database:

```bash
pnpm --filter @workspace/db run push
```

### 4. Run the development servers

You need **two terminals** — one for the API server, one for the frontend:

**Terminal 1 — API server** (runs on port 8080):
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — Frontend** (runs on port 24608):
```bash
pnpm --filter @workspace/codeexplainer run dev
```

Then open **http://localhost:24608** in your browser.

---

## Usage

1. Navigate to `http://localhost:24608`
2. Paste any public GitHub repository URL (e.g. `https://github.com/facebook/react`)
3. Select an explanation level: **Beginner**, **Intermediate**, or **Advanced**
4. Click Analyse — the AI streams five sections live as it works
5. Revisit any past analysis from the **History** page

---

## All Available Commands

| Command | What it does |
|---|---|
| `pnpm --filter @workspace/api-server run dev` | Start the API server on port 8080 |
| `pnpm --filter @workspace/codeexplainer run dev` | Start the frontend on port 24608 |
| `pnpm run typecheck` | Full TypeScript typecheck across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from the OpenAPI spec |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |

---

## Project Structure

```
Explainity/
├── artifacts/
│   ├── api-server/
│   │   └── src/routes/analyses.ts   # All analysis routes + AI streaming logic
│   └── codeexplainer/
│       └── src/
│           ├── pages/               # Home, AnalysisDetail, History pages
│           └── components/          # Layout, ThemeToggle, MarkdownRenderer
├── lib/
│   ├── api-spec/
│   │   └── openapi.yaml             # OpenAPI spec — source of truth for API contracts
│   ├── db/
│   │   └── src/schema/analyses.ts   # Drizzle schema for the analyses table
│   └── integrations-openai-ai-server/  # OpenAI client (server-side)
├── scripts/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.json
```
