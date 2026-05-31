# Explainity

An AI-powered tool that analyses GitHub repositories and generates clear, structured, tutorial-style explanations of how codebases work — with beginner, intermediate, and advanced detail levels.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/codeexplainer run dev` — run the frontend (port 24608)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set by Replit AI Integrations

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI GPT-5.1 via Replit AI Integrations
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Markdown rendering: react-markdown + remark-gfm + @tailwindcss/typography

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/analyses.ts` — Drizzle schema for analyses table
- `artifacts/api-server/src/routes/analyses.ts` — All analysis routes + AI streaming logic
- `artifacts/codeexplainer/src/pages/` — Home, AnalysisDetail, History pages
- `artifacts/codeexplainer/src/components/` — Layout, ThemeToggle, MarkdownRenderer
- `lib/integrations-openai-ai-server/` — OpenAI client (server-side)

## Architecture decisions

- **SSE streaming for AI analysis**: The `/api/analyses/:id/stream` endpoint streams AI-generated content section-by-section via Server-Sent Events, enabling a live "watching the AI think" UX. Orval-generated hooks can't handle SSE, so the frontend uses raw `fetch` + `ReadableStream`.
- **GitHub API without auth**: Repository content is fetched via the public GitHub REST API. Rate limits apply (60 req/hr unauthenticated). Adding a `GITHUB_TOKEN` env var would remove limits.
- **Async analysis model**: Analysis is created as `pending`, then a separate `/stream` POST triggers the AI. This decouples creation from processing and allows the frontend to start polling immediately.
- **Layered explanation levels**: The system prompt adapts based on the user's chosen level (beginner/intermediate/advanced), using the same repo context but different instruction framing.

## Product

- Users paste a GitHub URL and select an explanation level
- The AI fetches the repo structure, README, and key source files via the GitHub API
- Five sections are generated and streamed live: Summary, Architecture, Key Functions, Data Flow, Execution Walkthrough
- All past analyses are saved and browsable in the History page
