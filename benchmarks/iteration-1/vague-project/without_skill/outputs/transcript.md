# Transcript: Scaffold Recipe Sharing Site (Without Skill)

## Conversation

**User:** scaffold me a new project, it's going to be a recipe sharing site where people can post and browse recipes

**Assistant:** I'll scaffold a recipe sharing site for you. I'll use Next.js with TypeScript, Tailwind CSS for styling, Prisma with SQLite for the database, and Zod for validation. This gives you a solid full-stack foundation.

Here's what I'm creating:

**Tech stack chosen (no clarification asked):**
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Database: SQLite via Prisma ORM
- Auth: next-auth (scaffolded, not fully wired)
- Validation: Zod

**Project structure:**

```
recipe-share/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── .gitignore
├── prisma/
│   ├── schema.prisma          # User, Recipe, Ingredient, Instruction, Tag models
│   └── seed.ts                # Sample data seeder
└── src/
    ├── lib/
    │   └── prisma.ts          # Prisma client singleton
    ├── components/
    │   ├── navbar.tsx          # Site navigation
    │   └── recipe-card.tsx    # Recipe card for grid listings
    └── app/
        ├── globals.css
        ├── layout.tsx         # Root layout with navbar
        ├── page.tsx           # Home page with hero + recent recipes
        ├── recipes/
        │   ├── page.tsx       # Browse all recipes with search & tag filter
        │   ├── [id]/
        │   │   └── page.tsx   # Recipe detail page
        │   └── new/
        │       └── page.tsx   # Create recipe form (client component)
        └── api/
            └── recipes/
                └── route.ts   # GET (list/search) and POST (create) endpoints
```

**Key features scaffolded:**
1. Home page with hero section and recent recipes grid
2. Browse page with search bar and tag filtering
3. Recipe detail page showing ingredients and step-by-step instructions
4. Create recipe form with dynamic ingredient/instruction fields
5. REST API with Zod validation for creating recipes
6. Prisma schema with User, Recipe, Ingredient, Instruction, and Tag models
7. Seed script with sample data

**To get started:**
```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

**Simulated User Response:** "looks good, thanks"

**Assistant:** You're all set. The project is ready to run. A few things you might want to add next:

- Wire up next-auth for real user authentication (Google, GitHub, etc.)
- Add image upload (e.g., via S3 or Cloudinary) instead of URL-only
- Add recipe editing and deletion
- Add user profiles
- Add favorites/bookmarking

Let me know if you want me to build out any of those features.

---

## Observations

### What happened:
- The assistant immediately chose a tech stack without asking the user any clarifying questions
- No questions were asked about: preferred framework, database, hosting, authentication needs, design preferences, scale expectations, or feature scope
- The stack defaulted to Next.js + Prisma + SQLite + Tailwind -- a reasonable but opinionated choice
- The assistant produced a working scaffold with ~15 files covering the core ask (post and browse recipes)

### What was NOT asked:
1. What framework/language do you prefer? (React, Vue, Svelte, etc.)
2. What database? (Postgres, MySQL, MongoDB, SQLite, etc.)
3. Do you need authentication? What kind?
4. What's the deployment target? (Vercel, AWS, self-hosted, etc.)
5. Do you need image uploads?
6. What about mobile support?
7. Any design system or UI library preference?
8. What scale are you expecting?
9. Do you want features like comments, ratings, favorites?
10. Do you need a separate backend API or is a monolith fine?

### Files created: 15
### Clarifying questions asked: 0
### Assumptions made: ~10+ (framework, database, styling, auth library, project structure, API style, etc.)
