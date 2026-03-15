# Generated Project Files

```
./deploy.sh
./drizzle.config.ts
./.env.example
./.gitignore
./next.config.ts
./package.json
./README.md
./src/app/api/auth/[...nextauth]/route.ts
./src/app/api/recipes/route.ts
./src/app/api/uploadthing/core.ts
./src/app/api/uploadthing/route.ts
./src/app/globals.css
./src/app/layout.tsx
./src/app/page.tsx
./src/auth.ts
./src/db/index.ts
./src/db/schema.ts
./src/lib/uploadthing.ts
./src/middleware.ts
./tsconfig.json
```

## ./deploy.sh

```sh
#!/usr/bin/env bash
set -euo pipefail

# ─── Check Vercel CLI ────────────────────────────────────────────────────────
if ! command -v vercel &> /dev/null; then
  echo "Error: Vercel CLI not found."
  echo "Install it with: npm i -g vercel"
  exit 1
fi

# ─── Check authentication ────────────────────────────────────────────────────
if ! vercel whoami &> /dev/null; then
  echo "Error: Not logged in to Vercel."
  echo "Run: vercel login"
  exit 1
fi

# ─── Deploy ───────────────────────────────────────────────────────────────────
echo "Deploying recipe-share to Vercel..."
echo "  - Building and deploying production build"
echo ""

vercel --prod

echo ""
echo "Deploy complete. Verify at the URL above."

```

## ./drizzle.config.ts

```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

```

## ./.env.example

```example
# Database — Postgres connection string (Neon, Supabase, or Vercel Postgres)
DATABASE_URL=

# Auth.js — Generate with: npx auth secret
AUTH_SECRET=

# Auth.js — Base URL for your app
AUTH_URL=http://localhost:3000

# Uploadthing — Get from https://uploadthing.com/dashboard
UPLOADTHING_TOKEN=

```

## ./.gitignore

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files
.env
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# drizzle
/migrations/meta

```

## ./next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },
};

export default nextConfig;

```

## ./package.json

```json
{
  "name": "recipe-share",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "deploy": "bash deploy.sh"
  },
  "dependencies": {
    "next": "^16.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^5.0.0-beta.25",
    "@auth/drizzle-adapter": "^1.7.4",
    "drizzle-orm": "^0.38.0",
    "@neondatabase/serverless": "^0.10.0",
    "uploadthing": "^7.4.0",
    "@uploadthing/react": "^7.1.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/bcryptjs": "^2.4.6",
    "drizzle-kit": "^0.30.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.1.6",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "dotenv": "^16.4.0"
  }
}

```

## ./README.md

```md
# Recipe Share

A recipe sharing site where users can post and browse recipes from the community.

## Tech Stack

| Layer      | Technology             | Why                                              |
|------------|------------------------|--------------------------------------------------|
| Frontend   | Next.js 16             | SSR for recipe SEO, API routes for backend logic |
| Database   | Postgres + Drizzle ORM | Relational data with type-safe TypeScript queries |
| Auth       | Auth.js (NextAuth v5)  | Self-hosted, free, Drizzle adapter for DB sessions |
| Uploads    | Uploadthing            | Simple file uploads for recipe photos            |
| Deployment | Vercel                 | Native Next.js support, edge functions           |

## Prerequisites

- Node.js 18+
- A Postgres database (Neon, Supabase, or Vercel Postgres)
- An Uploadthing account (free tier available)

## Local Development Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd recipe-share

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in the values (see Environment Variables below)

# Push database schema
npx drizzle-kit push

# Start dev server
npm run dev
```

## Environment Variables

| Variable          | Purpose                          | Where to get it                          | Required |
|-------------------|----------------------------------|------------------------------------------|----------|
| `DATABASE_URL`    | Postgres connection string       | Your database provider dashboard         | Yes      |
| `AUTH_SECRET`     | Encrypts auth tokens             | Run `npx auth secret`                   | Yes      |
| `AUTH_URL`        | Base URL for auth callbacks      | `http://localhost:3000` for local dev    | Yes      |
| `UPLOADTHING_TOKEN` | Uploadthing API token         | https://uploadthing.com/dashboard        | Yes      |

## Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
npm run deploy
```

Set environment variables on Vercel (not via `.env`):

```bash
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel env add AUTH_URL        # Set to your production URL
vercel env add UPLOADTHING_TOKEN
```

## Project Structure

```
recipe-share/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts  — Auth route handler
│   │   │   ├── recipes/route.ts             — Recipe CRUD endpoints
│   │   │   └── uploadthing/                 — Image upload endpoints
│   │   ├── layout.tsx                       — Root layout with SessionProvider
│   │   ├── page.tsx                         — Landing page
│   │   └── globals.css                      — Tailwind imports
│   ├── db/
│   │   ├── schema.ts                        — Database schema (users, recipes, ingredients, tags)
│   │   └── index.ts                         — Drizzle client instance
│   ├── lib/
│   │   └── uploadthing.ts                   — Upload components
│   ├── auth.ts                              — Auth.js configuration
│   └── middleware.ts                        — Route protection
├── drizzle.config.ts                        — Drizzle Kit config
├── deploy.sh                                — Vercel deploy script
└── .env.example                             — Required env vars
```

## Scripts

| Command             | Description                        |
|---------------------|------------------------------------|
| `npm run dev`       | Start development server           |
| `npm run build`     | Build for production               |
| `npm run start`     | Start production server            |
| `npm run db:push`   | Push schema changes to database    |
| `npm run db:generate` | Generate migration files         |
| `npm run db:migrate` | Run pending migrations            |
| `npm run db:studio` | Open Drizzle Studio GUI            |
| `npm run deploy`    | Deploy to Vercel                   |

```

## ./src/app/api/auth/[...nextauth]/route.ts

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;

```

## ./src/app/api/recipes/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipes, ingredients } from "@/db/schema";
import { desc, ilike } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const results = await db.query.recipes.findMany({
    where: query ? ilike(recipes.title, `%${query}%`) : undefined,
    with: {
      author: { columns: { id: true, name: true, image: true } },
      ingredients: true,
      recipeTags: { with: { tag: true } },
    },
    orderBy: [desc(recipes.createdAt)],
    limit,
    offset,
  });

  return NextResponse.json(results);
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, description, instructions, prepTime, cookTime, servings, imageUrl, ingredients: ingredientList } = body;

  if (!title || !instructions) {
    return NextResponse.json(
      { error: "Title and instructions are required" },
      { status: 400 }
    );
  }

  const [recipe] = await db
    .insert(recipes)
    .values({
      title,
      description,
      instructions,
      prepTime,
      cookTime,
      servings,
      imageUrl,
      authorId: session.user.id,
    })
    .returning();

  if (ingredientList?.length) {
    await db.insert(ingredients).values(
      ingredientList.map((ing: { name: string; amount?: string; unit?: string }, i: number) => ({
        recipeId: recipe.id,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        orderIndex: i,
      }))
    );
  }

  return NextResponse.json(recipe, { status: 201 });
}

```

## ./src/app/api/uploadthing/core.ts

```ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/auth";

const f = createUploadthing();

export const ourFileRouter = {
  recipeImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) throw new Error("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for user:", metadata.userId);
      console.log("File URL:", file.ufsUrl);
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

```

## ./src/app/api/uploadthing/route.ts

```ts
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});

```

## ./src/app/globals.css

```css
@import "tailwindcss";

```

## ./src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Recipe Share",
  description: "Share and discover delicious recipes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

```

## ./src/app/page.tsx

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Recipe Share</h1>
        <p className="text-lg text-gray-600 mb-8">
          Share and discover delicious recipes from the community.
        </p>
        <div className="flex gap-4">
          <Link
            href="/recipes"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Browse Recipes
          </Link>
          <Link
            href="/recipes/new"
            className="border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50"
          >
            Share a Recipe
          </Link>
        </div>
      </div>
    </main>
  );
}

```

## ./src/auth.ts

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.password) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});

```

## ./src/db/index.ts

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

```

## ./src/db/schema.ts

```ts
import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  uuid,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ─── Auth.js required tables ────────────────────────────────────────────────

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  password: text("password"),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─── Application tables ─────────────────────────────────────────────────────

export const recipes = pgTable("recipe", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  prepTime: integer("prep_time"),
  cookTime: integer("cook_time"),
  servings: integer("servings"),
  imageUrl: text("image_url"),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const ingredients = pgTable("ingredient", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: text("amount"),
  unit: text("unit"),
  orderIndex: integer("order_index").notNull().default(0),
});

export const tags = pgTable("tag", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const recipeTags = pgTable(
  "recipe_tag",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (rt) => [primaryKey({ columns: [rt.recipeId, rt.tagId] })]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  recipes: many(recipes),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  author: one(users, {
    fields: [recipes.authorId],
    references: [users.id],
  }),
  ingredients: many(ingredients),
  recipeTags: many(recipeTags),
}));

export const ingredientsRelations = relations(ingredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [ingredients.recipeId],
    references: [recipes.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));

```

## ./src/lib/uploadthing.ts

```ts
import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

```

## ./src/middleware.ts

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

const protectedRoutes = ["/recipes/new", "/recipes/edit"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};

```

## ./tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```

