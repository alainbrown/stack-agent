# Generated Project Files

```
./drizzle.config.ts
./.env.example
./.gitignore
./next.config.js
./package.json
./postcss.config.js
./src/app/api/tasks/[id]/route.ts
./src/app/api/tasks/route.ts
./src/app/api/users/route.ts
./src/app/globals.css
./src/app/layout.tsx
./src/app/page.tsx
./src/app/tasks/page.tsx
./src/components/create-task-button.tsx
./src/components/task-card.tsx
./src/components/task-column.tsx
./src/db/index.ts
./src/db/schema.ts
./src/lib/utils.ts
./src/lib/validators.ts
./tailwind.config.ts
./tsconfig.json
./vercel.json
```

## ./drizzle.config.ts

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});

```

## ./.env.example

```example
# Database - Use Vercel Postgres connection string
POSTGRES_URL="postgres://user:password@host:5432/team_task_tracker"

# Vercel Postgres (auto-populated when linked via Vercel dashboard)
# POSTGRES_URL=
# POSTGRES_PRISMA_URL=
# POSTGRES_URL_NON_POOLING=
# POSTGRES_USER=
# POSTGRES_HOST=
# POSTGRES_PASSWORD=
# POSTGRES_DATABASE=

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
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# drizzle
drizzle/meta

```

## ./next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;

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
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "drizzle-orm": "^0.35.0",
    "@vercel/postgres": "^0.10.0",
    "postgres": "^3.4.0",
    "zod": "^3.23.0",
    "lucide-react": "^0.460.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "drizzle-kit": "^0.27.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}

```

## ./postcss.config.js

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

```

## ./src/app/api/tasks/[id]/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { updateTaskSchema } from "@/lib/validators";
import { eq } from "drizzle-orm";

// GET /api/tasks/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, params.id))
    .limit(1);

  if (task.length === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task[0]);
}

// PATCH /api/tasks/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const parsed = updateTaskSchema.parse(body);

    const updated = await db
      .update(tasks)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(tasks.id, params.id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/tasks/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deleted = await db
    .delete(tasks)
    .where(eq(tasks.id, params.id))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

```

## ./src/app/api/tasks/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { createTaskSchema } from "@/lib/validators";
import { eq } from "drizzle-orm";

// GET /api/tasks — list all tasks
export async function GET() {
  const allTasks = await db.select().from(tasks).orderBy(tasks.createdAt);
  return NextResponse.json(allTasks);
}

// POST /api/tasks — create a new task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createTaskSchema.parse(body);

    // For now, use a placeholder user ID. In production, get from auth session.
    const newTask = await db
      .insert(tasks)
      .values({
        ...parsed,
        createdBy: parsed.assigneeId ?? "00000000-0000-0000-0000-000000000000",
      })
      .returning();

    return NextResponse.json(newTask[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

```

## ./src/app/api/users/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createUserSchema } from "@/lib/validators";

// GET /api/users
export async function GET() {
  const allUsers = await db.select().from(users).orderBy(users.name);
  return NextResponse.json(allUsers);
}

// POST /api/users
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createUserSchema.parse(body);

    const newUser = await db.insert(users).values(parsed).returning();
    return NextResponse.json(newUser[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

```

## ./src/app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
}

```

## ./src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Task Tracker",
  description: "Track and manage team tasks collaboratively",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-gray-200 dark:border-gray-800">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <h1 className="text-xl font-bold">Team Task Tracker</h1>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="hover:underline">
                Board
              </a>
              <a href="/tasks" className="hover:underline">
                List
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

```

## ./src/app/page.tsx

```tsx
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TaskColumn } from "@/components/task-column";
import { CreateTaskButton } from "@/components/create-task-button";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const allTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      assigneeName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .orderBy(tasks.createdAt);

  const columns = {
    todo: allTasks.filter((t) => t.status === "todo"),
    in_progress: allTasks.filter((t) => t.status === "in_progress"),
    done: allTasks.filter((t) => t.status === "done"),
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Task Board</h2>
        <CreateTaskButton />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TaskColumn title="To Do" status="todo" tasks={columns.todo} />
        <TaskColumn
          title="In Progress"
          status="in_progress"
          tasks={columns.in_progress}
        />
        <TaskColumn title="Done" status="done" tasks={columns.done} />
      </div>
    </div>
  );
}

```

## ./src/app/tasks/page.tsx

```tsx
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CreateTaskButton } from "@/components/create-task-button";

export const dynamic = "force-dynamic";

const priorityBadge: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusLabel: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export default async function TaskListPage() {
  const allTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeName: users.name,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .orderBy(tasks.createdAt);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">All Tasks</h2>
        <CreateTaskButton />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Assignee</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {allTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3 font-medium">{task.title}</td>
                <td className="px-4 py-3">{statusLabel[task.status]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${priorityBadge[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3">{task.assigneeName ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(task.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {allTasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No tasks yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

```

## ./src/components/create-task-button.tsx

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateTaskButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      priority: formData.get("priority") as string,
      status: formData.get("status") as string,
    };

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setIsOpen(false);
      router.refresh();
    }
    setLoading(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + New Task
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-semibold">Create Task</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              name="title"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              placeholder="Task title"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              placeholder="Optional description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                name="status"
                defaultValue="todo"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Priority
              </label>
              <select
                name="priority"
                defaultValue="medium"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

```

## ./src/components/task-card.tsx

```tsx
"use client";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    assigneeName: string | null;
  };
}

const priorityDot: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-yellow-400",
  high: "bg-red-500",
};

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-start justify-between">
        <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
        <span
          className={`ml-2 mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${priorityDot[task.priority]}`}
          title={task.priority}
        />
      </div>
      {task.description && (
        <p className="mb-2 text-xs text-gray-500 line-clamp-2">
          {task.description}
        </p>
      )}
      {task.assigneeName && (
        <p className="text-xs text-gray-400">{task.assigneeName}</p>
      )}
    </div>
  );
}

```

## ./src/components/task-column.tsx

```tsx
"use client";

import { TaskCard } from "./task-card";

interface TaskColumnProps {
  title: string;
  status: string;
  tasks: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assigneeName: string | null;
  }[];
}

const columnColors: Record<string, string> = {
  todo: "border-t-blue-500",
  in_progress: "border-t-yellow-500",
  done: "border-t-green-500",
};

export function TaskColumn({ title, status, tasks }: TaskColumnProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 border-t-4 dark:border-gray-800 ${columnColors[status]}`}
    >
      <div className="flex items-center justify-between p-4">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium dark:bg-gray-800">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-3 p-4 pt-0">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No tasks</p>
        )}
      </div>
    </div>
  );
}

```

## ./src/db/index.ts

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL!;

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

```

## ./src/db/schema.ts

```ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

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

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  assigneeId: uuid("assignee_id").references(() => users.id),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

```

## ./src/lib/utils.ts

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

```

## ./src/lib/validators.ts

```ts
import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address"),
  avatarUrl: z.string().url().optional().nullable(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

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
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
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

## ./vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}

```

