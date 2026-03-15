# Stack Agent Skill — Conversation Transcript

## User Input

> scaffold me a new project, it's going to be a recipe sharing site where people can post and browse recipes

---

## Phase 1: Pick the Stack

### Step 1 — Project Info

**Project name:** `recipe-share`
**Description:** A recipe sharing site where users can post and browse recipes.

User provided both in their initial message — skipping ahead.

### Step 2 — Initial Stack Recommendation

A recipe sharing site is content-heavy with user-generated data, needs SEO for recipe discovery, and requires user accounts for posting. Image uploads are likely. No payments or AI needed.

| #  | Category   | Recommendation         | Rationale                                    | Status |
|----|------------|------------------------|----------------------------------------------|--------|
| 1  | Frontend   | Next.js                | SSR for recipe SEO, API routes for backend   |   ◆    |
| 2  | Backend    | —                      | Next.js API routes + server actions sufficient |   ⊘    |
| 3  | Database   | Postgres + Drizzle ORM | Relational data (users, recipes, ingredients) with type-safe queries |   ◆    |
| 4  | Auth       | Auth.js (NextAuth v5)  | Self-hosted, free, Drizzle adapter available |   ◆    |
| 5  | Payments   | —                      | Not needed for a recipe sharing site         |   ⊘    |
| 6  | AI/LLM    | —                      | Not needed for this project                  |   ⊘    |
| 7  | Deployment | Vercel                 | Native Next.js support, edge functions       |   ◆    |
| 8  | Extras     | Uploadthing            | Image uploads for recipe photos              |   ◆    |

Pick a number to review, or 'looks good' to confirm all and build.

---

### Step 3 — Simulated User Response

> looks good

---

### Step 4 — Confirm

Final stack:

| #  | Category   | Choice                 | Status |
|----|------------|------------------------|--------|
| 1  | Frontend   | Next.js                |   ✓    |
| 2  | Backend    | —                      |   ⊘    |
| 3  | Database   | Postgres + Drizzle ORM |   ✓    |
| 4  | Auth       | Auth.js (NextAuth v5)  |   ✓    |
| 5  | Payments   | —                      |   ⊘    |
| 6  | AI/LLM    | —                      |   ⊘    |
| 7  | Deployment | Vercel                 |   ✓    |
| 8  | Extras     | Uploadthing            |   ✓    |

Ready to scaffold?

> yes

---

## Phase 2: Scaffold & Wire Up

### Step 1 — Bootstrap

```bash
npx create-next-app@latest recipe-share --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

*(Simulated — not actually run)*

### Step 2 — Wire Up Integrations

Writing boilerplate files to connect all chosen technologies:

- `src/db/index.ts` — Drizzle client instance
- `src/db/schema.ts` — Database schema (users, recipes, ingredients, sessions)
- `drizzle.config.ts` — Drizzle Kit configuration
- `src/auth.ts` — Auth.js config with Drizzle adapter
- `src/app/api/auth/[...nextauth]/route.ts` — Auth route handler
- `src/middleware.ts` — Auth middleware for route protection
- `src/app/api/recipes/route.ts` — Recipe CRUD API routes
- `src/app/api/uploadthing/core.ts` — Uploadthing file router
- `src/app/api/uploadthing/route.ts` — Uploadthing route handler
- `src/lib/uploadthing.ts` — Uploadthing client utilities
- `.env.example` — All required environment variables
- `deploy.sh` — Vercel deploy script
- Updated `package.json` — Dependencies, scripts

### Step 3 — Deploy Script

Created `deploy.sh` with Vercel CLI checks, auth verification, and deploy command.

### Step 4 — README

Generated `README.md` with tech stack overview, setup instructions, env var table, deployment guide, and project structure.

### Step 5 — Install

```bash
cd recipe-share && npm install
```

*(Simulated — not actually run)*

### Step 6 — Summary

**Scaffolded:** `recipe-share/`

**Key files:**
- `src/db/schema.ts` — Users, recipes, ingredients tables with relations
- `src/db/index.ts` — Drizzle client connected to Postgres
- `src/auth.ts` — Auth.js wired to Drizzle adapter
- `src/middleware.ts` — Protects `/recipes/new` and `/recipes/edit` routes
- `src/app/api/recipes/route.ts` — GET (list/search) and POST (create) recipes
- `src/app/api/uploadthing/` — Image upload endpoint for recipe photos
- `deploy.sh` — One-command Vercel deployment

**What's connected:**
- Auth.js uses Drizzle adapter — sessions and accounts stored in Postgres
- API routes import `db` from `src/db` and `auth` from `src/auth`
- Uploadthing configured for recipe image uploads
- Middleware protects recipe creation/editing routes

**Next steps:**
1. Copy `.env.example` to `.env.local` and fill in values
2. Set up a Postgres database (Neon, Supabase, or Vercel Postgres)
3. Run `npx drizzle-kit push` to create tables
4. Run `npm run dev` to start developing
5. Build recipe listing page, recipe detail page, and submission form
