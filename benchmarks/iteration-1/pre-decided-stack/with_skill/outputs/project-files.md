# Generated Project Files

```
./deploy.sh
./drizzle.config.ts
./.env.example
./.gitignore
./next.config.ts
./package.json
./postcss.config.mjs
./README.md
./src/app/api/tasks/route.ts
./src/app/dashboard/page.tsx
./src/app/globals.css
./src/app/layout.tsx
./src/app/page.tsx
./src/app/sign-in/[[...sign-in]]/page.tsx
./src/app/sign-up/[[...sign-up]]/page.tsx
./src/db/index.ts
./src/db/schema.ts
./src/middleware.ts
./tailwind.config.ts
./tsconfig.json
```

## ./deploy.sh

```sh
#!/usr/bin/env bash
set -euo pipefail

# Check that Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo "Error: Vercel CLI is not installed."
  echo "Install it with: npm i -g vercel"
  exit 1
fi

# Check that user is authenticated
if ! vercel whoami &> /dev/null; then
  echo "Error: Not authenticated with Vercel."
  echo "Run: vercel login"
  exit 1
fi

echo "Deploying team-task-tracker to Vercel..."
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
# Database (Postgres)
DATABASE_URL=

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Clerk Routes
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

```

## ./.gitignore

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

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

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

```

## ./next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

```

## ./package.json

```json
{
  "name": "team-task-tracker",
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
    "@clerk/nextjs": "^6.12.0",
    "drizzle-orm": "^0.39.0",
    "next": "^15.1.0",
    "postgres": "^3.4.5",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "drizzle-kit": "^0.30.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.1.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0"
  }
}

```

## ./postcss.config.mjs

```mjs
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
  },
};

export default config;

```

## ./README.md

```md
# Team Task Tracker

Track and manage tasks across your team.

## Tech Stack

| Layer      | Technology         | Why                                              |
|------------|--------------------|--------------------------------------------------|
| Frontend   | Next.js (App Router) | SSR, API routes, file-system routing            |
| Database   | Postgres + Drizzle ORM | Relational data with type-safe queries        |
| Auth       | Clerk              | Drop-in auth with team/org support               |
| Deployment | Vercel             | Native Next.js hosting, zero-config deploys      |

## Prerequisites

- Node.js 18+
- A PostgreSQL database (local or hosted — e.g. Neon, Supabase, Vercel Postgres)
- A [Clerk](https://clerk.com) account
- [Vercel CLI](https://vercel.com/cli) (for deployment)

## Local Dev Setup

```bash
git clone <repo-url>
cd team-task-tracker
npm install
cp .env.example .env.local
# Fill in .env.local with your values (see below)
npx drizzle-kit push    # Create database tables
npm run dev              # Start dev server at http://localhost:3000
```

## Environment Variables

| Variable | Purpose | Where to get it | Required |
|----------|---------|-----------------|----------|
| `DATABASE_URL` | Postgres connection string | Your database provider | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key | Clerk Dashboard > API Keys | Yes |
| `CLERK_SECRET_KEY` | Clerk backend key | Clerk Dashboard > API Keys | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in page path | Set to `/sign-in` | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up page path | Set to `/sign-up` | Yes |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Redirect after sign-in | Set to `/dashboard` | Yes |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Redirect after sign-up | Set to `/dashboard` | Yes |

## Deployment

1. Install the Vercel CLI: `npm i -g vercel`
2. Authenticate: `vercel login`
3. Set environment variables on Vercel (not via `.env`):
   ```bash
   vercel env add DATABASE_URL
   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   vercel env add CLERK_SECRET_KEY
   # ... repeat for all env vars
   ```
4. Deploy: `npm run deploy`
5. Verify the deployment URL works and auth flow completes

## Project Structure

```
team-task-tracker/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with ClerkProvider
│   │   ├── page.tsx                # Landing page (public)
│   │   ├── globals.css             # Tailwind base styles
│   │   ├── sign-in/[[...sign-in]]/ # Clerk sign-in page
│   │   ├── sign-up/[[...sign-up]]/ # Clerk sign-up page
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Protected dashboard (task list)
│   │   └── api/
│   │       └── tasks/
│   │           └── route.ts        # GET/POST tasks API
│   ├── db/
│   │   ├── index.ts                # Drizzle client instance
│   │   └── schema.ts               # Database schema (users, teams, tasks)
│   └── middleware.ts               # Clerk auth middleware
├── migrations/                     # Drizzle migration files
├── drizzle.config.ts               # Drizzle Kit configuration
├── deploy.sh                       # Vercel deploy script
├── .env.example                    # Required environment variables
└── package.json
```

```

## ./src/app/api/tasks/route.ts

```ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userTasks = await db.query.tasks.findMany({
    where: eq(tasks.assigneeId, user.id),
    with: {
      team: true,
      createdBy: true,
    },
    orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
  });

  return NextResponse.json(userTasks);
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title, description, teamId, assigneeId, priority } = body;

  if (!title || !teamId) {
    return NextResponse.json(
      { error: "Title and teamId are required" },
      { status: 400 }
    );
  }

  const [newTask] = await db
    .insert(tasks)
    .values({
      title,
      description: description || null,
      teamId,
      assigneeId: assigneeId || null,
      createdById: user.id,
      priority: priority || "medium",
    })
    .returning();

  return NextResponse.json(newTask, { status: 201 });
}

```

## ./src/app/dashboard/page.tsx

```tsx
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();

  // Find the user in our database
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId!),
  });

  // Get tasks assigned to this user
  const userTasks = user
    ? await db.query.tasks.findMany({
        where: eq(tasks.assigneeId, user.id),
        with: {
          team: true,
          createdBy: true,
        },
        orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team Task Tracker</h1>
        <UserButton />
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">My Tasks</h2>

        {userTasks.length === 0 ? (
          <p className="text-gray-500">No tasks assigned yet.</p>
        ) : (
          <ul className="space-y-3">
            {userTasks.map((task) => (
              <li
                key={task.id}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{task.title}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      task.status === "done"
                        ? "bg-green-100 text-green-800"
                        : task.status === "in_progress"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 mt-1">
                    {task.description}
                  </p>
                )}
                <div className="text-xs text-gray-400 mt-2">
                  {task.team.name} &middot; Priority: {task.priority}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

```

## ./src/app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

```

## ./src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Team Task Tracker",
  description: "Track and manage tasks across your team",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}

```

## ./src/app/page.tsx

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Team Task Tracker</h1>
      <p className="text-lg text-gray-600 mb-8">
        Track and manage tasks across your team.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="rounded-md bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
        >
          Sign Up
        </Link>
      </div>
    </main>
  );
}

```

## ./src/app/sign-in/[[...sign-in]]/page.tsx

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}

```

## ./src/app/sign-up/[[...sign-up]]/page.tsx

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}

```

## ./src/db/index.ts

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });

```

## ./src/db/schema.ts

```ts
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
]);

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").$type<"owner" | "member">().notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  assigneeId: integer("assignee_id").references(() => users.id),
  createdById: integer("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  assignedTasks: many(tasks, { relationName: "assignee" }),
  createdTasks: many(tasks, { relationName: "creator" }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  tasks: many(tasks),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  team: one(teams, { fields: [tasks.teamId], references: [teams.id] }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: "creator",
  }),
}));

```

## ./src/middleware.ts

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

```

## ./tailwind.config.ts

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;

```

## ./tsconfig.json

```json
{
  "compilerOptions": {
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

