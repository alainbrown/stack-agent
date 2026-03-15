# Generated Project Files

```
./.env.example
./.gitignore
./next.config.js
./package.json
./postcss.config.js
./prisma/schema.prisma
./prisma/seed.ts
./src/app/api/auth/[...nextauth]/route.ts
./src/app/api/orders/[id]/route.ts
./src/app/api/orders/route.ts
./src/app/api/webhooks/stripe/route.ts
./src/app/dashboard/layout.tsx
./src/app/dashboard/orders/[id]/page.tsx
./src/app/dashboard/orders/page.tsx
./src/app/dashboard/page.tsx
./src/app/dashboard/payments/page.tsx
./src/app/globals.css
./src/app/layout.tsx
./src/app/login/page.tsx
./src/app/page.tsx
./src/app/unauthorized/page.tsx
./src/components/auth-provider.tsx
./src/components/order-filters.tsx
./src/components/order-status-form.tsx
./src/components/payment-badge.tsx
./src/components/recent-orders.tsx
./src/components/sidebar.tsx
./src/components/stats-card.tsx
./src/components/status-badge.tsx
./src/lib/auth-guard.ts
./src/lib/auth.ts
./src/lib/db.ts
./src/lib/stripe.ts
./src/middleware.ts
./src/types/next-auth.d.ts
./tailwind.config.ts
./tsconfig.json
```

## ./.env.example

```example
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/ops_dashboard"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

```

## ./.gitignore

```gitignore
node_modules/
.next/
.env
.env.local
*.tsbuildinfo
next-env.d.ts

```

## ./next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;

```

## ./package.json

```json
{
  "name": "ops-fulfillment-dashboard",
  "version": "0.1.0",
  "private": true,
  "description": "Internal dashboard for ops team to monitor order fulfillment and payment status",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "stripe:listen": "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.14.0",
    "next-auth": "^4.24.0",
    "@next-auth/prisma-adapter": "^1.0.7",
    "stripe": "^15.0.0",
    "bcryptjs": "^2.4.3",
    "zod": "^3.23.0",
    "date-fns": "^3.6.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.4.0",
    "prisma": "^5.14.0",
    "tsx": "^4.10.0",
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

## ./prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── NextAuth Models ────────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Application Models ─────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String?
  role          UserRole  @default(VIEWER)
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum UserRole {
  ADMIN
  MANAGER
  VIEWER
}

model Order {
  id              String            @id @default(cuid())
  orderNumber     String            @unique
  customerName    String
  customerEmail   String
  status          OrderStatus       @default(PENDING)
  totalAmount     Int               // stored in cents
  currency        String            @default("usd")
  stripePaymentId String?           @unique
  paymentStatus   PaymentStatus     @default(UNPAID)
  items           OrderItem[]
  statusHistory   OrderStatusLog[]
  shippingAddress String?
  notes           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  RETURNED
}

enum PaymentStatus {
  UNPAID
  PAID
  PARTIALLY_REFUNDED
  REFUNDED
  FAILED
  DISPUTED
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  order     Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  name      String
  quantity  Int
  unitPrice Int    // stored in cents
  sku       String?
}

model OrderStatusLog {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fromStatus OrderStatus?
  toStatus  OrderStatus
  note      String?
  changedBy String?
  createdAt DateTime    @default(now())
}

model StripeEvent {
  id            String   @id @default(cuid())
  stripeEventId String   @unique
  type          String
  processed     Boolean  @default(false)
  payload       Json
  createdAt     DateTime @default(now())
}

```

## ./prisma/seed.ts

```ts
import { PrismaClient, OrderStatus, PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create sample orders
  const sampleOrders = [
    {
      orderNumber: "ORD-001",
      customerName: "Alice Johnson",
      customerEmail: "alice@example.com",
      status: OrderStatus.DELIVERED,
      totalAmount: 12999,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { productId: "prod_1", name: "Widget A", quantity: 2, unitPrice: 4999, sku: "WA-100" },
        { productId: "prod_2", name: "Widget B", quantity: 1, unitPrice: 3001, sku: "WB-200" },
      ],
    },
    {
      orderNumber: "ORD-002",
      customerName: "Bob Smith",
      customerEmail: "bob@example.com",
      status: OrderStatus.PROCESSING,
      totalAmount: 5499,
      paymentStatus: PaymentStatus.PAID,
      items: [
        { productId: "prod_3", name: "Gadget X", quantity: 1, unitPrice: 5499, sku: "GX-300" },
      ],
    },
    {
      orderNumber: "ORD-003",
      customerName: "Carol Davis",
      customerEmail: "carol@example.com",
      status: OrderStatus.PENDING,
      totalAmount: 8750,
      paymentStatus: PaymentStatus.UNPAID,
      items: [
        { productId: "prod_1", name: "Widget A", quantity: 1, unitPrice: 4999, sku: "WA-100" },
        { productId: "prod_4", name: "Accessory Z", quantity: 3, unitPrice: 1250, sku: "AZ-400" },
      ],
    },
  ];

  for (const orderData of sampleOrders) {
    const { items, ...order } = orderData;
    await prisma.order.upsert({
      where: { orderNumber: order.orderNumber },
      update: {},
      create: {
        ...order,
        items: {
          create: items,
        },
      },
    });
    console.log(`Created order: ${order.orderNumber}`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

```

## ./src/app/api/auth/[...nextauth]/route.ts

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

```

## ./src/app/api/orders/[id]/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

const updateSchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "RETURNED",
    ])
    .optional(),
  notes: z.string().optional(),
  shippingAddress: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!["ADMIN", "MANAGER"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data = updateSchema.parse(body);

  const existingOrder = await db.order.findUnique({
    where: { id: params.id },
  });

  if (!existingOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updateData: any = {};
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.shippingAddress !== undefined)
    updateData.shippingAddress = data.shippingAddress;

  if (data.status && data.status !== existingOrder.status) {
    updateData.status = data.status;

    await db.orderStatusLog.create({
      data: {
        orderId: params.id,
        fromStatus: existingOrder.status,
        toStatus: data.status,
        note: data.notes ?? null,
        changedBy: session.user.email ?? session.user.name ?? "unknown",
      },
    });
  }

  const updated = await db.order.update({
    where: { id: params.id },
    data: updateData,
    include: {
      items: true,
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return NextResponse.json(updated);
}

```

## ./src/app/api/orders/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(req.nextUrl.searchParams);
  const query = querySchema.parse(searchParams);

  const where: any = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.paymentStatus) {
    where.paymentStatus = query.paymentStatus;
  }

  if (query.search) {
    where.OR = [
      { orderNumber: { contains: query.search, mode: "insensitive" } },
      { customerName: { contains: query.search, mode: "insensitive" } },
      { customerEmail: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        items: true,
        _count: { select: { statusHistory: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    db.order.count({ where }),
  ]);

  return NextResponse.json({
    orders,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

```

## ./src/app/api/webhooks/stripe/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Store the raw event for auditing
  await db.stripeEvent.upsert({
    where: { stripeEventId: event.id },
    update: { processed: false },
    create: {
      stripeEventId: event.id,
      type: event.type,
      payload: event.data as any,
    },
  });

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Mark event as processed
    await db.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { processed: true },
    });
  } catch (err: any) {
    console.error(`Error processing webhook ${event.type}: ${err.message}`);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const order = await db.order.findUnique({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (!order) {
    console.warn(`No order found for payment intent: ${paymentIntent.id}`);
    return;
  }

  const previousStatus = order.status;

  await db.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      status: order.status === "PENDING" ? "CONFIRMED" : order.status,
    },
  });

  await db.orderStatusLog.create({
    data: {
      orderId: order.id,
      fromStatus: previousStatus,
      toStatus: order.status === "PENDING" ? "CONFIRMED" : order.status,
      note: `Payment succeeded (${paymentIntent.id})`,
      changedBy: "stripe-webhook",
    },
  });
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const order = await db.order.findUnique({
    where: { stripePaymentId: paymentIntent.id },
  });

  if (!order) return;

  await db.order.update({
    where: { id: order.id },
    data: { paymentStatus: "FAILED" },
  });

  await db.orderStatusLog.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: `Payment failed (${paymentIntent.id}): ${paymentIntent.last_payment_error?.message ?? "Unknown error"}`,
      changedBy: "stripe-webhook",
    },
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (!charge.payment_intent) return;

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent.id;

  const order = await db.order.findUnique({
    where: { stripePaymentId: paymentIntentId },
  });

  if (!order) return;

  const isFullRefund = charge.amount_refunded === charge.amount;

  await db.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED",
    },
  });

  await db.orderStatusLog.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: `${isFullRefund ? "Full" : "Partial"} refund processed`,
      changedBy: "stripe-webhook",
    },
  });
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  if (!chargeId) return;

  const charge = await stripe.charges.retrieve(chargeId);
  if (!charge.payment_intent) return;

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent.id;

  const order = await db.order.findUnique({
    where: { stripePaymentId: paymentIntentId },
  });

  if (!order) return;

  await db.order.update({
    where: { id: order.id },
    data: { paymentStatus: "DISPUTED" },
  });

  await db.orderStatusLog.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      note: `Payment disputed (reason: ${dispute.reason})`,
      changedBy: "stripe-webhook",
    },
  });
}

```

## ./src/app/dashboard/layout.tsx

```tsx
import { requireAuth } from "@/lib/auth-guard";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}

```

## ./src/app/dashboard/orders/[id]/page.tsx

```tsx
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatAmountForDisplay } from "@/lib/stripe";
import { StatusBadge } from "@/components/status-badge";
import { PaymentBadge } from "@/components/payment-badge";
import { OrderStatusForm } from "@/components/order-status-form";
import { format } from "date-fns";
import Link from "next/link";

interface Props {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: Props) {
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      items: true,
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/orders"
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            &larr; Back to Orders
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">
            {order.orderNumber}
          </h2>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Customer</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{order.customerEmail}</dd>
              </div>
              {order.shippingAddress && (
                <div className="col-span-2">
                  <dt className="text-gray-500">Shipping Address</dt>
                  <dd className="font-medium text-gray-900">{order.shippingAddress}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Line Items */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Items</h3>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit Price</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 font-medium text-gray-900">{item.name}</td>
                    <td className="py-2 text-gray-500">{item.sku ?? "-"}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">
                      {formatAmountForDisplay(item.unitPrice, order.currency)}
                    </td>
                    <td className="py-2 text-right">
                      {formatAmountForDisplay(item.unitPrice * item.quantity, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td colSpan={4} className="py-2 text-right">
                    Total
                  </td>
                  <td className="py-2 text-right">
                    {formatAmountForDisplay(order.totalAmount, order.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Status History */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Status History</h3>
            {order.statusHistory.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No status changes recorded.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {order.statusHistory.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 text-sm">
                    <span className="text-gray-400">
                      {format(new Date(log.createdAt), "MMM d, HH:mm")}
                    </span>
                    <span>
                      {log.fromStatus && (
                        <span className="text-gray-500">
                          {log.fromStatus.toLowerCase()} &rarr;{" "}
                        </span>
                      )}
                      <span className="font-medium text-gray-900">
                        {log.toStatus.toLowerCase()}
                      </span>
                    </span>
                    {log.note && (
                      <span className="text-gray-400">- {log.note}</span>
                    )}
                    {log.changedBy && (
                      <span className="text-gray-400">by {log.changedBy}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-6">
          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
          />

          {order.notes && (
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="text-lg font-medium text-gray-900">Notes</h3>
              <p className="mt-2 text-sm text-gray-600">{order.notes}</p>
            </div>
          )}

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">Details</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Stripe Payment ID</dt>
                <dd className="font-mono text-xs text-gray-900">
                  {order.stripePaymentId ?? "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">
                  {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Last Updated</dt>
                <dd className="text-gray-900">
                  {format(new Date(order.updatedAt), "MMM d, yyyy HH:mm")}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

```

## ./src/app/dashboard/orders/page.tsx

```tsx
import { db } from "@/lib/db";
import { RecentOrders } from "@/components/recent-orders";
import { OrderFilters } from "@/components/order-filters";

interface Props {
  searchParams: {
    status?: string;
    paymentStatus?: string;
    search?: string;
    page?: string;
  };
}

export default async function OrdersPage({ searchParams }: Props) {
  const page = parseInt(searchParams.page ?? "1", 10);
  const limit = 20;

  const where: any = {};

  if (searchParams.status) {
    where.status = searchParams.status;
  }
  if (searchParams.paymentStatus) {
    where.paymentStatus = searchParams.paymentStatus;
  }
  if (searchParams.search) {
    where.OR = [
      { orderNumber: { contains: searchParams.search, mode: "insensitive" } },
      { customerName: { contains: searchParams.search, mode: "insensitive" } },
      { customerEmail: { contains: searchParams.search, mode: "insensitive" } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
      <p className="mt-1 text-sm text-gray-500">
        {total} order{total !== 1 ? "s" : ""} total
      </p>

      <OrderFilters
        currentStatus={searchParams.status}
        currentPaymentStatus={searchParams.paymentStatus}
        currentSearch={searchParams.search}
      />

      <RecentOrders orders={orders} />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/dashboard/orders?page=${page - 1}${searchParams.status ? `&status=${searchParams.status}` : ""}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50"
              >
                Previous
              </a>
            )}
            {page < totalPages && (
              <a
                href={`/dashboard/orders?page=${page + 1}${searchParams.status ? `&status=${searchParams.status}` : ""}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

```

## ./src/app/dashboard/page.tsx

```tsx
import { db } from "@/lib/db";
import { formatAmountForDisplay } from "@/lib/stripe";
import { StatsCard } from "@/components/stats-card";
import { RecentOrders } from "@/components/recent-orders";

export default async function DashboardPage() {
  const [
    totalOrders,
    pendingOrders,
    processingOrders,
    shippedOrders,
    deliveredOrders,
    paidOrders,
    failedPayments,
    revenueResult,
    recentOrders,
  ] = await Promise.all([
    db.order.count(),
    db.order.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: "PROCESSING" } }),
    db.order.count({ where: { status: "SHIPPED" } }),
    db.order.count({ where: { status: "DELIVERED" } }),
    db.order.count({ where: { paymentStatus: "PAID" } }),
    db.order.count({ where: { paymentStatus: "FAILED" } }),
    db.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: "PAID" } }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { items: true },
    }),
  ]);

  const totalRevenue = revenueResult._sum.totalAmount ?? 0;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
      <p className="mt-1 text-sm text-gray-500">
        Order fulfillment and payment status at a glance.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Orders" value={totalOrders.toString()} />
        <StatsCard title="Revenue (Paid)" value={formatAmountForDisplay(totalRevenue, "usd")} />
        <StatsCard
          title="Pending"
          value={pendingOrders.toString()}
          subtitle="Awaiting confirmation"
        />
        <StatsCard
          title="Processing"
          value={processingOrders.toString()}
          subtitle="Being fulfilled"
        />
        <StatsCard
          title="Shipped"
          value={shippedOrders.toString()}
          subtitle="In transit"
        />
        <StatsCard
          title="Delivered"
          value={deliveredOrders.toString()}
          subtitle="Completed"
        />
        <StatsCard
          title="Paid"
          value={paidOrders.toString()}
          subtitle="Payments received"
        />
        <StatsCard
          title="Failed Payments"
          value={failedPayments.toString()}
          subtitle="Needs attention"
          highlight={failedPayments > 0}
        />
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
        <RecentOrders orders={recentOrders} />
      </div>
    </div>
  );
}

```

## ./src/app/dashboard/payments/page.tsx

```tsx
import { db } from "@/lib/db";
import { format } from "date-fns";

export default async function PaymentsPage() {
  const events = await db.stripeEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Stripe Events</h2>
      <p className="mt-1 text-sm text-gray-500">
        Recent webhook events from Stripe.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Event ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Processed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Received
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                  No Stripe events received yet. Set up your webhook endpoint to start receiving events.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-gray-900">
                    {event.stripeEventId}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {event.type}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`badge ${
                        event.processed ? "badge-delivered" : "badge-pending"
                      }`}
                    >
                      {event.processed ? "yes" : "pending"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {format(new Date(event.createdAt), "MMM d, yyyy HH:mm:ss")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

```

## ./src/app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900 antialiased;
  }
}

@layer components {
  .badge {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium;
  }
  .badge-pending {
    @apply bg-yellow-100 text-yellow-800;
  }
  .badge-confirmed {
    @apply bg-blue-100 text-blue-800;
  }
  .badge-processing {
    @apply bg-indigo-100 text-indigo-800;
  }
  .badge-shipped {
    @apply bg-purple-100 text-purple-800;
  }
  .badge-delivered {
    @apply bg-green-100 text-green-800;
  }
  .badge-cancelled {
    @apply bg-red-100 text-red-800;
  }
  .badge-returned {
    @apply bg-gray-100 text-gray-800;
  }
  .badge-paid {
    @apply bg-green-100 text-green-800;
  }
  .badge-unpaid {
    @apply bg-yellow-100 text-yellow-800;
  }
  .badge-failed {
    @apply bg-red-100 text-red-800;
  }
  .badge-refunded {
    @apply bg-gray-100 text-gray-800;
  }
  .badge-disputed {
    @apply bg-orange-100 text-orange-800;
  }
}

```

## ./src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ops Dashboard - Order Fulfillment",
  description: "Internal dashboard for monitoring order fulfillment and payment status",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

```

## ./src/app/login/page.tsx

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Ops Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to monitor order fulfillment
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
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
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}

```

## ./src/app/unauthorized/page.tsx

```tsx
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="mt-2 text-gray-500">
          You do not have permission to access this page.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-brand-600 hover:text-brand-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

```

## ./src/components/auth-provider.tsx

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

```

## ./src/components/order-filters.tsx

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

const PAYMENT_STATUSES = [
  "UNPAID",
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "FAILED",
  "DISPUTED",
];

interface Props {
  currentStatus?: string;
  currentPaymentStatus?: string;
  currentSearch?: string;
}

export function OrderFilters({
  currentStatus,
  currentPaymentStatus,
  currentSearch,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch ?? "");

  function applyFilters(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const values = {
      status: currentStatus,
      paymentStatus: currentPaymentStatus,
      search: currentSearch,
      ...overrides,
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    router.push(`/dashboard/orders?${params.toString()}`);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <div>
        <select
          value={currentStatus ?? ""}
          onChange={(e) =>
            applyFilters({ status: e.target.value || undefined })
          }
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase().replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <select
          value={currentPaymentStatus ?? ""}
          onChange={(e) =>
            applyFilters({ paymentStatus: e.target.value || undefined })
          }
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Payment Statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.toLowerCase().replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters({ search: search || undefined });
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-700"
        >
          Search
        </button>
      </form>
    </div>
  );
}

```

## ./src/components/order-status-form.tsx

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
];

interface Props {
  orderId: string;
  currentStatus: string;
}

export function OrderStatusForm({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === currentStatus && !notes) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(status !== currentStatus && { status }),
          ...(notes && { notes }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update order");
      }

      setNotes("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="text-lg font-medium text-gray-900">Update Status</h3>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Note (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Add a note about this status change..."
          />
        </div>

        <button
          type="submit"
          disabled={loading || (status === currentStatus && !notes)}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update Order"}
        </button>
      </form>
    </div>
  );
}

```

## ./src/components/payment-badge.tsx

```tsx
const paymentStyles: Record<string, string> = {
  UNPAID: "badge-unpaid",
  PAID: "badge-paid",
  PARTIALLY_REFUNDED: "badge-refunded",
  REFUNDED: "badge-refunded",
  FAILED: "badge-failed",
  DISPUTED: "badge-disputed",
};

export function PaymentBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${paymentStyles[status] ?? "badge-unpaid"}`}>
      {status.toLowerCase().replace("_", " ")}
    </span>
  );
}

```

## ./src/components/recent-orders.tsx

```tsx
import Link from "next/link";
import { formatAmountForDisplay } from "@/lib/stripe";
import { StatusBadge } from "@/components/status-badge";
import { PaymentBadge } from "@/components/payment-badge";
import { format } from "date-fns";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  createdAt: Date;
}

export function RecentOrders({ orders }: { orders: Order[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Order
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Payment
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Amount
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4">
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {order.orderNumber}
                </Link>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                {order.customerName}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <StatusBadge status={order.status} />
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <PaymentBadge status={order.paymentStatus} />
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                {formatAmountForDisplay(order.totalAmount, order.currency)}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {format(new Date(order.createdAt), "MMM d, yyyy")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

```

## ./src/components/sidebar.tsx

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navigation = [
  { name: "Overview", href: "/dashboard" },
  { name: "Orders", href: "/dashboard/orders" },
  { name: "Payments", href: "/dashboard/payments" },
];

export function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();

  return (
    <div className="flex w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-lg font-bold text-white">Ops Dashboard</h1>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-800 p-4">
        <div className="text-sm text-gray-400">{user.email}</div>
        <div className="text-xs text-gray-500 capitalize">{user.role?.toLowerCase()}</div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 text-sm text-gray-400 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

```

## ./src/components/stats-card.tsx

```tsx
interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  highlight?: boolean;
}

export function StatsCard({ title, value, subtitle, highlight }: StatsCardProps) {
  return (
    <div
      className={`rounded-lg bg-white p-6 shadow ${
        highlight ? "ring-2 ring-red-500" : ""
      }`}
    >
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}

```

## ./src/components/status-badge.tsx

```tsx
const statusStyles: Record<string, string> = {
  PENDING: "badge-pending",
  CONFIRMED: "badge-confirmed",
  PROCESSING: "badge-processing",
  SHIPPED: "badge-shipped",
  DELIVERED: "badge-delivered",
  CANCELLED: "badge-cancelled",
  RETURNED: "badge-returned",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${statusStyles[status] ?? "badge-pending"}`}>
      {status.toLowerCase().replace("_", " ")}
    </span>
  );
}

```

## ./src/lib/auth-guard.ts

```ts
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  const userRole = (session.user as any).role;
  if (!roles.includes(userRole)) {
    redirect("/unauthorized");
  }
  return session;
}

```

## ./src/lib/auth.ts

```ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid credentials");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

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
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};

```

## ./src/lib/db.ts

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

```

## ./src/lib/stripe.ts

```ts
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  typescript: true,
});

export function formatAmountForDisplay(amount: number, currency: string): string {
  const numberFormat = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  });
  return numberFormat.format(amount / 100);
}

```

## ./src/middleware.ts

```ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/api/orders/:path*"],
};

```

## ./src/types/next-auth.d.ts

```ts
import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
  }
}

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
        brand: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
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
    "target": "es2017",
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
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}

```

