# Generated Project Files

```
./deploy.sh
./drizzle.config.ts
./.env.example
./next.config.ts
./package.json
./postcss.config.mjs
./README.md
./src/app/api/auth/[...nextauth]/route.ts
./src/app/api/webhooks/stripe/route.ts
./src/app/dashboard/layout.tsx
./src/app/dashboard/page.tsx
./src/app/dashboard/sign-out-button.tsx
./src/app/globals.css
./src/app/layout.tsx
./src/app/login/page.tsx
./src/app/page.tsx
./src/lib/auth.ts
./src/lib/db/index.ts
./src/lib/db/schema.ts
./src/lib/stripe.ts
./src/middleware.ts
./tsconfig.json
```

## ./deploy.sh

```sh
#!/usr/bin/env bash
set -euo pipefail

# Check Railway CLI is installed
if ! command -v railway &> /dev/null; then
  echo "Error: Railway CLI not found."
  echo "Install it: npm install -g @railway/cli"
  exit 1
fi

# Check authentication
if ! railway whoami &> /dev/null; then
  echo "Error: Not logged in to Railway."
  echo "Run: railway login"
  exit 1
fi

echo "Deploying ops-fulfillment-dashboard to Railway..."
echo "  - Building Next.js app"
echo "  - Deploying to linked project"

railway up --detach

echo ""
echo "Deploy triggered. Check status: railway status"
echo "View logs: railway logs"

```

## ./drizzle.config.ts

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

```

## ./.env.example

```example
# Database (Postgres)
DATABASE_URL=postgresql://user:password@localhost:5432/ops_fulfillment

# NextAuth.js
AUTH_SECRET=          # Generate with: npx auth secret
AUTH_URL=http://localhost:3000

# Stripe (webhooks only)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

```

## ./next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stripe webhooks need the raw body for signature verification.
  // Next.js App Router route handlers receive the raw Request object,
  // so no special config is needed — just don't parse the body before
  // passing it to stripe.webhooks.constructEvent().
};

export default nextConfig;

```

## ./package.json

```json
{
  "name": "ops-fulfillment-dashboard",
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
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^5.0.0-beta.25",
    "drizzle-orm": "^0.38.0",
    "postgres": "^3.4.5",
    "stripe": "^17.4.0",
    "@auth/drizzle-adapter": "^1.7.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/bcryptjs": "^2.4.6",
    "drizzle-kit": "^0.30.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.49",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.1.0"
  }
}

```

## ./postcss.config.mjs

```mjs
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;

```

## ./README.md

```md
# Ops Fulfillment Dashboard

Internal dashboard for the ops team to monitor order fulfillment and track payment status via Stripe webhooks.

## Tech Stack

| Layer      | Choice              | Why                                                    |
|------------|--------------------|---------------------------------------------------------|
| Frontend   | Next.js 15         | App Router with server components for fast dashboard    |
| Database   | Postgres + Drizzle | Relational data with type-safe ORM, zero runtime bloat  |
| Auth       | NextAuth.js v5     | Self-hosted JWT auth — free, no vendor lock-in          |
| Payments   | Stripe (webhooks)  | Receives payment events, updates order status in DB     |
| Deployment | Railway            | Managed Postgres + Node hosting in one place            |

## Prerequisites

- Node.js >= 18
- PostgreSQL database (local or hosted)
- Stripe account with webhook endpoint configured
- Railway CLI (for deployment)

## Local Dev Setup

```bash
git clone <repo-url> && cd ops-fulfillment-dashboard
npm install
cp .env.example .env.local   # Fill in values (see table below)
npx drizzle-kit push          # Create database tables
npm run dev                   # http://localhost:3000
```

To test Stripe webhooks locally:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Environment Variables

| Variable               | Purpose                          | Where to get it                  | Required |
|------------------------|----------------------------------|----------------------------------|----------|
| `DATABASE_URL`         | Postgres connection string       | Your DB provider or local setup  | Yes      |
| `AUTH_SECRET`          | Signs JWT tokens                 | `npx auth secret`               | Yes      |
| `AUTH_URL`             | App base URL                     | `http://localhost:3000` locally  | Yes      |
| `STRIPE_SECRET_KEY`    | Stripe API access                | Stripe Dashboard > API keys     | Yes      |
| `STRIPE_WEBHOOK_SECRET`| Verifies webhook signatures      | Stripe Dashboard > Webhooks     | Yes      |

## Deployment

```bash
npm install -g @railway/cli
railway login
railway init                  # Link to a Railway project
railway add --plugin postgresql  # Add Postgres addon
```

Set environment variables on Railway (not via `.env`):
```bash
railway variables set DATABASE_URL=...
railway variables set AUTH_SECRET=...
railway variables set AUTH_URL=https://your-app.railway.app
railway variables set STRIPE_SECRET_KEY=...
railway variables set STRIPE_WEBHOOK_SECRET=...
```

Deploy:
```bash
npm run deploy
```

After deployment, update the Stripe webhook endpoint URL to your Railway domain.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth route handler
│   │   └── webhooks/stripe/route.ts      # Stripe webhook receiver
│   ├── dashboard/
│   │   ├── layout.tsx                    # Auth-protected layout with nav
│   │   ├── page.tsx                      # Orders table + stats
│   │   └── sign-out-button.tsx           # Client-side sign out
│   ├── login/page.tsx                    # Login form
│   ├── layout.tsx                        # Root layout
│   ├── globals.css                       # Tailwind imports
│   └── page.tsx                          # Redirects to /dashboard
├── lib/
│   ├── auth.ts                           # NextAuth config + providers
│   ├── db/
│   │   ├── index.ts                      # Drizzle client (exports `db`)
│   │   └── schema.ts                     # Users, orders, payments tables
│   └── stripe.ts                         # Stripe client instance
├── middleware.ts                          # Auth middleware (protects /dashboard)
drizzle.config.ts                         # Drizzle Kit config
deploy.sh                                 # Railway deploy script
.env.example                              # Required env vars template
```

```

## ./src/app/api/auth/[...nextauth]/route.ts

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

```

## ./src/app/api/webhooks/stripe/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Upsert payment record linked to order
  const existingPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
    .limit(1);

  if (existingPayments.length > 0) {
    await db
      .update(payments)
      .set({
        status: "succeeded",
        updatedAt: new Date(),
        stripeEventTimestamp: new Date(paymentIntent.created * 1000),
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
  } else {
    // Find the order by metadata or external ID
    const orderId = paymentIntent.metadata?.order_id;
    if (orderId) {
      await db.insert(payments).values({
        orderId,
        stripePaymentIntentId: paymentIntent.id,
        status: "succeeded",
        amountCents: paymentIntent.amount,
        currency: paymentIntent.currency,
        stripeEventTimestamp: new Date(paymentIntent.created * 1000),
      });

      // Update order status
      await db
        .update(orders)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(orders.id, orderId));
    }
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  await db
    .update(payments)
    .set({
      status: "failed",
      updatedAt: new Date(),
      stripeEventTimestamp: new Date(paymentIntent.created * 1000),
    })
    .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (charge.payment_intent) {
    const piId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent.id;

    await db
      .update(payments)
      .set({
        status: "refunded",
        stripeChargeId: charge.id,
        updatedAt: new Date(),
      })
      .where(eq(payments.stripePaymentIntentId, piId));
  }
}

```

## ./src/app/dashboard/layout.tsx

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-sm font-semibold text-gray-900">
                Ops Dashboard
              </span>
              <a
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Orders
              </a>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {session.user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

```

## ./src/app/dashboard/page.tsx

```tsx
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { desc, eq, count, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch summary stats
  const [orderStats] = await db
    .select({
      total: count(),
      pending: count(
        sql`CASE WHEN ${orders.status} = 'pending' THEN 1 END`
      ),
      processing: count(
        sql`CASE WHEN ${orders.status} = 'processing' THEN 1 END`
      ),
      shipped: count(
        sql`CASE WHEN ${orders.status} = 'shipped' THEN 1 END`
      ),
      delivered: count(
        sql`CASE WHEN ${orders.status} = 'delivered' THEN 1 END`
      ),
    })
    .from(orders);

  // Fetch recent orders with payment status
  const recentOrders = await db
    .select({
      id: orders.id,
      externalOrderId: orders.externalOrderId,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      status: orders.status,
      totalAmountCents: orders.totalAmountCents,
      currency: orders.currency,
      createdAt: orders.createdAt,
      paymentStatus: payments.status,
    })
    .from(orders)
    .leftJoin(payments, eq(orders.id, payments.orderId))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-900">
        Order Fulfillment
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Orders" value={orderStats.total} />
        <StatCard label="Pending" value={orderStats.pending} />
        <StatCard label="Processing" value={orderStats.processing} />
        <StatCard label="Shipped" value={orderStats.shipped} />
      </div>

      {/* Orders table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Payment
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recentOrders.map((order) => (
              <tr key={order.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-gray-900">
                  {order.externalOrderId ?? order.id.slice(0, 8)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {order.customerName ?? order.customerEmail}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={order.paymentStatus ?? "unknown"} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                  {formatCurrency(order.totalAmountCents, order.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {order.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No orders yet. Payment webhooks will populate this table.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    succeeded: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
    unknown: "bg-gray-100 text-gray-500",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.unknown}`}
    >
      {status}
    </span>
  );
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

```

## ./src/app/dashboard/sign-out-button.tsx

```tsx
"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-gray-500 hover:text-gray-700"
    >
      Sign out
    </button>
  );
}

```

## ./src/app/globals.css

```css
@import "tailwindcss";

```

## ./src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ops Fulfillment Dashboard",
  description: "Internal dashboard for monitoring order fulfillment",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

```

## ./src/app/login/page.tsx

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Ops Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to monitor order fulfillment
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

```

## ./src/app/page.tsx

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}

```

## ./src/lib/auth.ts

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) return null;

        const passwordMatch = await compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});

```

## ./src/lib/db/index.ts

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch for serverless environments (Next.js API routes)
const client = postgres(connectionString, { prepare: false });

export const db = drizzle({ client, schema });

```

## ./src/lib/db/schema.ts

```ts
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

// --- Auth tables (NextAuth.js / Auth.js Drizzle adapter) ---

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("viewer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
});

// --- Domain tables ---

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalOrderId: varchar("external_order_id", { length: 255 }).unique(),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  customerName: text("customer_name"),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmountCents: integer("total_amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", {
    length: 255,
  }).unique(),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
  status: paymentStatusEnum("status").notNull().default("pending"),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("usd"),
  stripeEventTimestamp: timestamp("stripe_event_timestamp"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Type exports ---

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

```

## ./src/lib/stripe.ts

```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

```

## ./src/middleware.ts

```ts
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isOnLogin = req.nextUrl.pathname === "/login";

  if (isOnDashboard && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  if (isOnLogin && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
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

