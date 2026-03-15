# Cascading Invalidation Test — Transcript

## Test Setup

Testing the skill's cascading invalidation behavior when a user changes a confirmed decision that has downstream dependencies.

---

## Turn 1

**User:** "I want to scaffold a SaaS project management tool where teams can track tasks and deadlines"

**Assistant (following skill):**

Project name: `task-tracker` (kebab-case suggestion based on description).
Description: SaaS project management tool for teams to track tasks and deadlines.

Based on this description, here is the recommended stack:

| #  | Category   | Recommendation       | Rationale                                          | Status |
|----|------------|---------------------|----------------------------------------------------|--------|
| 1  | Frontend   | Next.js             | SSR + API routes, good for SaaS dashboards         |   ◆    |
| 2  | Backend    | —                   | Skip — Next.js API routes sufficient               |   ⊘    |
| 3  | Database   | Postgres + Drizzle  | Relational data (tasks, teams, deadlines) + TS ORM |   ◆    |
| 4  | Auth       | Clerk               | Drop-in auth with org/team support built in        |   ◆    |
| 5  | Payments   | —                   | Not specified yet — skip for now                   |   ⊘    |
| 6  | AI/LLM    | —                   | Not needed for this project                        |   ⊘    |
| 7  | Deployment | Vercel              | Native Next.js support, zero-config deploys        |   ◆    |
| 8  | Extras     | —                   | None needed                                        |   ⊘    |

Pick a number to review, or "looks good" to confirm all and build.

---

## Turn 2

**User:** "looks good"

**Assistant (following skill):**

All recommendations confirmed.

| #  | Category   | Recommendation       | Rationale                                          | Status |
|----|------------|---------------------|----------------------------------------------------|--------|
| 1  | Frontend   | Next.js             | SSR + API routes, good for SaaS dashboards         |   ✓    |
| 2  | Backend    | —                   | Skip — Next.js API routes sufficient               |   ⊘    |
| 3  | Database   | Postgres + Drizzle  | Relational data (tasks, teams, deadlines) + TS ORM |   ✓    |
| 4  | Auth       | Clerk               | Drop-in auth with org/team support built in        |   ✓    |
| 5  | Payments   | —                   | Not specified — skipped                            |   ⊘    |
| 6  | AI/LLM    | —                   | Not needed for this project                        |   ⊘    |
| 7  | Deployment | Vercel              | Native Next.js support, zero-config deploys        |   ✓    |
| 8  | Extras     | —                   | None needed                                        |   ⊘    |

Ready to scaffold?

---

## Turn 3 — KEY TEST: Cascading Invalidation

**User:** "actually, I want to change frontend to Vite + React instead of Next.js"

**Assistant (following skill):**

Frontend updated to Vite + React.

Changing frontend from Next.js to Vite + React invalidates two downstream decisions:

- **Backend (#2)** was set to "skip — Next.js API routes sufficient." Vite + React is a client-only SPA with no server-side API routes, so you now need a standalone backend. Reset to pending.
- **Deployment (#7)** was set to Vercel, chosen specifically for its native Next.js support. That advantage no longer applies with a Vite SPA. Reset to pending.

Auth (#4 Clerk) and Database (#3 Postgres + Drizzle) are not affected — Clerk works with any React frontend, and the database choice is independent of the frontend framework.

Updated table:

| #  | Category   | Recommendation       | Rationale                                          | Status |
|----|------------|---------------------|----------------------------------------------------|--------|
| 1  | Frontend   | Vite + React        | Lightweight SPA, fast dev server                   |   ✓    |
| 2  | Backend    | ?                   | Needs re-evaluation — no API routes in Vite        |   ◆    |
| 3  | Database   | Postgres + Drizzle  | Relational data (tasks, teams, deadlines) + TS ORM |   ✓    |
| 4  | Auth       | Clerk               | Drop-in auth with org/team support built in        |   ✓    |
| 5  | Payments   | —                   | Not specified — skipped                            |   ⊘    |
| 6  | AI/LLM    | —                   | Not needed for this project                        |   ⊘    |
| 7  | Deployment | ?                   | Needs re-evaluation — Vercel advantage was Next.js |   ◆    |
| 8  | Extras     | —                   | None needed                                        |   ⊘    |

Let's resolve the invalidated stages. First, **Backend**:

Backend options:
1. Express + tRPC — Type-safe API layer, pairs well with React + Drizzle [recommended]
2. Fastify — High performance, good plugin ecosystem
3. Hono — Lightweight, runs anywhere (Node, Bun, edge)

---

## Turn 4 — Re-deciding Backend

**User:** "1 sounds good — Express + tRPC"

**Assistant (following skill):**

Backend set to Express + tRPC — gives you end-to-end type safety between the Vite + React frontend and the API layer.

| #  | Category   | Recommendation       | Rationale                                          | Status |
|----|------------|---------------------|----------------------------------------------------|--------|
| 1  | Frontend   | Vite + React        | Lightweight SPA, fast dev server                   |   ✓    |
| 2  | Backend    | Express + tRPC      | Type-safe API, pairs with React + Drizzle          |   ✓    |
| 3  | Database   | Postgres + Drizzle  | Relational data (tasks, teams, deadlines) + TS ORM |   ✓    |
| 4  | Auth       | Clerk               | Drop-in auth with org/team support built in        |   ✓    |
| 5  | Payments   | —                   | Not specified — skipped                            |   ⊘    |
| 6  | AI/LLM    | —                   | Not needed for this project                        |   ⊘    |
| 7  | Deployment | ?                   | Needs re-evaluation — now have separate SPA + API  |   ◆    |
| 8  | Extras     | —                   | None needed                                        |   ⊘    |

Now, **Deployment** — with a Vite SPA + Express backend, the hosting story changes:

Deployment options:
1. Railway — Handles Node servers natively, easy Postgres add-on, deploy from Git [recommended]
2. Fly.io — Container-based, good for long-running servers, global edge
3. Render — Simple PaaS, free tier, auto-deploys from Git

---

## Turn 5 — Re-deciding Deployment

**User:** "Railway, let's go with that"

**Assistant (following skill):**

Deployment set to Railway — handles both the Express API server and a managed Postgres instance in one platform. The Vite SPA can be served as static assets from Express or deployed to a CDN separately.

Final table:

| #  | Category   | Recommendation       | Rationale                                          | Status |
|----|------------|---------------------|----------------------------------------------------|--------|
| 1  | Frontend   | Vite + React        | Lightweight SPA, fast dev server                   |   ✓    |
| 2  | Backend    | Express + tRPC      | Type-safe API, pairs with React + Drizzle          |   ✓    |
| 3  | Database   | Postgres + Drizzle  | Relational data (tasks, teams, deadlines) + TS ORM |   ✓    |
| 4  | Auth       | Clerk               | Drop-in auth with org/team support built in        |   ✓    |
| 5  | Payments   | —                   | Not specified — skipped                            |   ⊘    |
| 6  | AI/LLM    | —                   | Not needed for this project                        |   ⊘    |
| 7  | Deployment | Railway             | Native Node server + managed Postgres              |   ✓    |
| 8  | Extras     | —                   | None needed                                        |   ⊘    |

Ready to scaffold?

---

## Analysis: Cascading Invalidation Behavior

### What the skill prescribed

Per the "Cascading Invalidation" section of `SKILL.md`, when the frontend changes from Next.js to Vite + React:

> | Change | Invalidates | Why |
> |--------|------------|-----|
> | Frontend: Next.js → Vite + React | Backend (if it was "Next.js API routes"), Deployment (if Vercel was chosen for Next.js support) | Backend was parasitic on Next.js; Vercel advantage gone |

### What happened in this simulation

1. **Correct identification of invalidated stages:** Backend (#2) and Deployment (#7) were both correctly identified as invalidated. Backend had been skipped because "Next.js API routes sufficient" — that rationale is void without Next.js. Deployment was Vercel specifically for Next.js native support — that rationale is void without Next.js.

2. **Correct non-invalidation of unaffected stages:** Database (#3, Postgres + Drizzle) and Auth (#4, Clerk) were correctly left alone. Neither depended on the frontend being Next.js.

3. **Table updated correctly:** Invalidated stages were reset to `◆` (pending suggestion) with "?" as their recommendation, clearly showing they need re-evaluation.

4. **Explicit explanation given:** The assistant told the user exactly what was invalidated and why, as the skill requires: "Changing frontend from Next.js to Vite + React invalidates two downstream decisions..."

5. **Sequential walk-through of invalidated stages:** The assistant walked through Backend first, then Deployment, presenting new options appropriate to the changed context (Express/Fastify/Hono for backend instead of "skip"; Railway/Fly.io/Render instead of Vercel for deployment).

6. **New recommendations were contextually appropriate:** With a Vite SPA + separate backend, the deployment options shifted from Vercel (frontend PaaS) to Railway/Fly.io/Render (platforms suited to running Node servers). The backend options were all standalone Node frameworks rather than framework-integrated solutions.

### Key guardrails observed

- No stages *before* the changed stage (#1 Frontend) were invalidated.
- Only stages that *genuinely depended* on Next.js were invalidated — not all stages.
- The table remained the source of truth throughout, with status markers accurately reflecting the state of each decision.
