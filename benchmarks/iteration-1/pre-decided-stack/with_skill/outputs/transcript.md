# Stack Agent Skill — Transcript

**Task:** "I need to scaffold a project for a team task tracker. Next.js, Postgres, deploy to Vercel."

---

## Phase 1: Pick the Stack

### Step 1 — Project Info

**User:** I need to scaffold a project for a team task tracker. Next.js, Postgres, deploy to Vercel.

Extracted from user message:
- **Project name:** `team-task-tracker`
- **Description:** A team task tracker application

Both provided — skipping project info prompt.

---

### Step 2 — Initial Stack Recommendation

The user pre-specified Next.js, Postgres, and Vercel. Filling in the remaining categories with opinionated defaults for a team task tracker.

| #  | Category   | Recommendation       | Rationale                                  | Status |
|----|------------|---------------------|--------------------------------------------|--------|
| 1  | Frontend   | Next.js             | Pre-specified by user                      |   ◆    |
| 2  | Backend    | —                   | Next.js API routes sufficient              |   ⊘    |
| 3  | Database   | Postgres + Drizzle  | Pre-specified Postgres; Drizzle for TS DX  |   ◆    |
| 4  | Auth       | Clerk               | Drop-in auth, team/org support built-in    |   ◆    |
| 5  | Payments   | —                   | Not needed for a task tracker              |   ⊘    |
| 6  | AI/LLM    | —                   | Not needed for a task tracker              |   ⊘    |
| 7  | Deployment | Vercel              | Pre-specified by user                      |   ◆    |
| 8  | Extras     | —                   | None needed                                |   ⊘    |

Pick a number to review, or 'looks good' to confirm all and build.

---

### Step 3 — Stage Review (Simulated)

**Simulated user response:** "looks good"

All categories confirmed. No changes needed.

---

### Step 4 — Confirm

Final stack:

| #  | Category   | Decision            | Status |
|----|------------|---------------------|--------|
| 1  | Frontend   | Next.js (App Router)|   ✓    |
| 2  | Backend    | —                   |   ⊘    |
| 3  | Database   | Postgres + Drizzle  |   ✓    |
| 4  | Auth       | Clerk               |   ✓    |
| 5  | Payments   | —                   |   ⊘    |
| 6  | AI/LLM    | —                   |   ⊘    |
| 7  | Deployment | Vercel              |   ✓    |
| 8  | Extras     | —                   |   ⊘    |

Ready to scaffold?

**Simulated user response:** "yes"

---

## Phase 2: Scaffold & Wire Up

### Step 1 — Bootstrap

Would run:
```bash
npx create-next-app@latest team-task-tracker --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

(Simulated — files written directly instead.)

### Step 2 — Wire Up Integrations

Files created:

| File | Purpose |
|------|---------|
| `src/db/index.ts` | Drizzle DB client instance (connects to Postgres via `DATABASE_URL`) |
| `src/db/schema.ts` | Database schema: users, teams, tasks tables with relations |
| `drizzle.config.ts` | Drizzle Kit config for migrations |
| `src/middleware.ts` | Clerk auth middleware — protects all routes except sign-in/sign-up |
| `src/app/layout.tsx` | Root layout wrapped with `<ClerkProvider>` |
| `src/app/page.tsx` | Landing page with sign-in redirect |
| `src/app/dashboard/page.tsx` | Protected dashboard page (task list placeholder) |
| `src/app/api/tasks/route.ts` | API route: GET/POST tasks (wired to Drizzle + Clerk auth) |
| `.env.example` | All required environment variables |
| `package.json` | Dependencies, scripts including deploy |
| `deploy.sh` | Vercel deploy script |
| `tsconfig.json` | TypeScript config |
| `tailwind.config.ts` | Tailwind CSS config |
| `README.md` | Setup instructions, env var table, project structure |

### Step 3 — Deploy Script

Created `deploy.sh` — checks for Vercel CLI, checks auth, runs `vercel --prod`.

### Step 4 — README

Generated with tech stack overview, prerequisites, local dev setup, env var table, deployment instructions, and project structure.

### Step 5 — Install

Would run:
```bash
cd team-task-tracker && npm install
```

(Simulated — skipped.)

### Step 6 — Summary

**Scaffolded:** `team-task-tracker/`

Key wiring:
- Drizzle ORM connects to Postgres via `DATABASE_URL` env var
- Clerk middleware protects all routes; `ClerkProvider` wraps the app
- API route at `/api/tasks` uses both Clerk auth and Drizzle queries
- `deploy.sh` handles Vercel deployment with pre-flight checks

Next steps:
1. Copy `.env.example` to `.env.local` and fill in values
2. Run `npx drizzle-kit push` to create database tables
3. Run `npm run dev` to start development
4. Start building task management features
