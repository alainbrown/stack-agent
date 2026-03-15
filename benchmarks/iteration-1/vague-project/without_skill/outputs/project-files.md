# Generated Project Files

```
./.env.example
./.gitignore
./next.config.js
./package.json
./postcss.config.js
./prisma/schema.prisma
./prisma/seed.ts
./src/app/api/recipes/route.ts
./src/app/globals.css
./src/app/layout.tsx
./src/app/page.tsx
./src/app/recipes/[id]/page.tsx
./src/app/recipes/new/page.tsx
./src/app/recipes/page.tsx
./src/components/navbar.tsx
./src/components/recipe-card.tsx
./src/lib/prisma.ts
./tailwind.config.ts
./tsconfig.json
```

## ./.env.example

```example
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me-to-a-random-secret"

```

## ./.gitignore

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.js

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

# prisma
prisma/dev.db
prisma/dev.db-journal

```

## ./next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;

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
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@prisma/client": "^5.14.0",
    "next-auth": "^4.24.0",
    "@next-auth/prisma-adapter": "^1.0.7",
    "zod": "^3.23.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
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
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  recipes       Recipe[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
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

model Recipe {
  id           String       @id @default(cuid())
  title        String
  description  String
  cookTime     Int          // minutes
  prepTime     Int          // minutes
  servings     Int
  imageUrl     String?
  ingredients  Ingredient[]
  instructions Instruction[]
  tags         Tag[]
  author       User         @relation(fields: [authorId], references: [id])
  authorId     String
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

model Ingredient {
  id       String @id @default(cuid())
  name     String
  amount   String
  unit     String
  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  recipeId String
}

model Instruction {
  id       String @id @default(cuid())
  step     Int
  text     String
  recipe   Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  recipeId String
}

model Tag {
  id      String   @id @default(cuid())
  name    String   @unique
  recipes Recipe[]
}

```

## ./prisma/seed.ts

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@recipeshare.com" },
    update: {},
    create: {
      email: "demo@recipeshare.com",
      name: "Demo Chef",
    },
  });

  // Create tags
  const tags = await Promise.all(
    ["breakfast", "lunch", "dinner", "dessert", "vegetarian", "quick"].map(
      (name) =>
        prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        })
    )
  );

  // Create a sample recipe
  await prisma.recipe.create({
    data: {
      title: "Classic Pancakes",
      description:
        "Fluffy homemade pancakes perfect for a weekend breakfast.",
      cookTime: 15,
      prepTime: 10,
      servings: 4,
      authorId: user.id,
      ingredients: {
        create: [
          { name: "all-purpose flour", amount: "1.5", unit: "cups" },
          { name: "milk", amount: "1.25", unit: "cups" },
          { name: "egg", amount: "1", unit: "large" },
          { name: "butter", amount: "3", unit: "tbsp" },
          { name: "sugar", amount: "2", unit: "tbsp" },
          { name: "baking powder", amount: "2", unit: "tsp" },
          { name: "salt", amount: "0.5", unit: "tsp" },
        ],
      },
      instructions: {
        create: [
          { step: 1, text: "Mix flour, sugar, baking powder, and salt in a large bowl." },
          { step: 2, text: "Make a well in the center and pour in milk, egg, and melted butter. Mix until smooth." },
          { step: 3, text: "Heat a griddle or frying pan over medium-high heat. Lightly oil or butter." },
          { step: 4, text: "Pour batter onto the griddle, about 1/4 cup per pancake. Cook until bubbles form on the surface, then flip and cook until golden brown." },
        ],
      },
      tags: {
        connect: [{ name: "breakfast" }, { name: "vegetarian" }],
      },
    },
  });

  console.log("Seed data created successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

```

## ./src/app/api/recipes/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createRecipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  prepTime: z.number().int().min(0),
  cookTime: z.number().int().min(0),
  servings: z.number().int().min(1),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      amount: z.string().min(1),
      unit: z.string().min(1),
    })
  ),
  instructions: z.array(
    z.object({
      step: z.number().int().min(1),
      text: z.string().min(1),
    })
  ),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tag = searchParams.get("tag");
  const q = searchParams.get("q");

  const where: any = {};
  if (tag) where.tags = { some: { name: tag } };
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const recipes = await prisma.recipe.findMany({
    where,
    include: { author: true, tags: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recipes);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createRecipeSchema.parse(body);

    // In production, get the user from the session.
    // For now, use/create a default user.
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { email: "user@recipeshare.com", name: "RecipeShare User" },
      });
    }

    const recipe = await prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description,
        prepTime: data.prepTime,
        cookTime: data.cookTime,
        servings: data.servings,
        imageUrl: data.imageUrl ?? null,
        authorId: user.id,
        ingredients: {
          create: data.ingredients,
        },
        instructions: {
          create: data.instructions,
        },
        tags: {
          connectOrCreate: (data.tags ?? []).map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
    });

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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

```

## ./src/app/layout.tsx

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RecipeShare - Share & Discover Recipes",
  description: "A community-driven recipe sharing platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}

```

## ./src/app/page.tsx

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RecipeCard } from "@/components/recipe-card";

export default async function HomePage() {
  const recipes = await prisma.recipe.findMany({
    include: {
      author: true,
      tags: true,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <div>
      {/* Hero */}
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Share &amp; Discover Recipes
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600">
          Browse community recipes, share your own creations, and find your next
          favorite meal.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/recipes"
            className="rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500"
          >
            Browse Recipes
          </Link>
          <Link
            href="/recipes/new"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Post a Recipe
          </Link>
        </div>
      </section>

      {/* Recent recipes */}
      <section>
        <h2 className="mb-6 text-2xl font-bold text-gray-900">
          Recent Recipes
        </h2>
        {recipes.length === 0 ? (
          <p className="text-gray-500">
            No recipes yet. Be the first to share one!
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

```

## ./src/app/recipes/[id]/page.tsx

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function RecipeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: params.id },
    include: {
      author: true,
      ingredients: true,
      instructions: { orderBy: { step: "asc" } },
      tags: true,
    },
  });

  if (!recipe) return notFound();

  return (
    <article className="mx-auto max-w-3xl">
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="mb-6 h-72 w-full rounded-xl object-cover"
        />
      )}

      <h1 className="mb-2 text-3xl font-bold">{recipe.title}</h1>
      <p className="mb-4 text-gray-600">
        By {recipe.author.name ?? "Anonymous"} &middot;{" "}
        {new Date(recipe.createdAt).toLocaleDateString()}
      </p>

      <div className="mb-6 flex gap-4 text-sm text-gray-500">
        <span>Prep: {recipe.prepTime} min</span>
        <span>Cook: {recipe.cookTime} min</span>
        <span>Servings: {recipe.servings}</span>
      </div>

      {recipe.tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <p className="mb-8 text-lg text-gray-700">{recipe.description}</p>

      {/* Ingredients */}
      <section className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold">Ingredients</h2>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing) => (
            <li key={ing.id} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              <span>
                {ing.amount} {ing.unit} {ing.name}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Instructions */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Instructions</h2>
        <ol className="space-y-4">
          {recipe.instructions.map((inst) => (
            <li key={inst.id} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                {inst.step}
              </span>
              <p className="pt-1 text-gray-700">{inst.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

```

## ./src/app/recipes/new/page.tsx

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface IngredientInput {
  name: string;
  amount: string;
  unit: string;
}

interface InstructionInput {
  step: number;
  text: string;
}

export default function NewRecipePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [ingredients, setIngredients] = useState<IngredientInput[]>([
    { name: "", amount: "", unit: "" },
  ]);
  const [instructions, setInstructions] = useState<InstructionInput[]>([
    { step: 1, text: "" },
  ]);

  function addIngredient() {
    setIngredients([...ingredients, { name: "", amount: "", unit: "" }]);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredient(
    index: number,
    field: keyof IngredientInput,
    value: string
  ) {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  }

  function addInstruction() {
    setInstructions([
      ...instructions,
      { step: instructions.length + 1, text: "" },
    ]);
  }

  function removeInstruction(index: number) {
    const updated = instructions
      .filter((_, i) => i !== index)
      .map((inst, i) => ({ ...inst, step: i + 1 }));
    setInstructions(updated);
  }

  function updateInstruction(index: number, text: string) {
    const updated = [...instructions];
    updated[index].text = text;
    setInstructions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          prepTime: parseInt(prepTime),
          cookTime: parseInt(cookTime),
          servings: parseInt(servings),
          imageUrl: imageUrl || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ingredients: ingredients.filter((i) => i.name),
          instructions: instructions.filter((i) => i.text),
        }),
      });

      if (!res.ok) throw new Error("Failed to create recipe");

      const data = await res.json();
      router.push(`/recipes/${data.id}`);
    } catch (err) {
      alert("Error creating recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold">Post a New Recipe</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Time & servings */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Prep Time (min)
            </label>
            <input
              required
              type="number"
              min="0"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cook Time (min)
            </label>
            <input
              required
              type="number"
              min="0"
              value={cookTime}
              onChange={(e) => setCookTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Servings
            </label>
            <input
              required
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Image URL */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Image URL (optional)
          </label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Tags (comma-separated)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="breakfast, vegetarian, quick"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Ingredients */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Ingredients
          </label>
          {ingredients.map((ing, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input
                placeholder="Amount"
                value={ing.amount}
                onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Unit"
                value={ing.unit}
                onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Ingredient name"
                value={ing.name}
                onChange={(e) => updateIngredient(i, "name", e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredient}
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            + Add ingredient
          </button>
        </div>

        {/* Instructions */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Instructions
          </label>
          {instructions.map((inst, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
                {inst.step}
              </span>
              <textarea
                rows={2}
                placeholder={`Step ${inst.step}...`}
                value={inst.text}
                onChange={(e) => updateInstruction(i, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {instructions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInstruction(i)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addInstruction}
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            + Add step
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Recipe"}
        </button>
      </form>
    </div>
  );
}

```

## ./src/app/recipes/page.tsx

```tsx
import { prisma } from "@/lib/prisma";
import { RecipeCard } from "@/components/recipe-card";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: { tag?: string; q?: string };
}) {
  const where: any = {};

  if (searchParams.tag) {
    where.tags = { some: { name: searchParams.tag } };
  }

  if (searchParams.q) {
    where.OR = [
      { title: { contains: searchParams.q } },
      { description: { contains: searchParams.q } },
    ];
  }

  const [recipes, tags] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include: { author: true, tags: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">All Recipes</h1>

      {/* Search & filter */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <form className="flex-1" action="/recipes" method="GET">
          <input
            name="q"
            type="search"
            placeholder="Search recipes..."
            defaultValue={searchParams.q ?? ""}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </form>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <a
              key={tag.id}
              href={`/recipes?tag=${tag.name}`}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                searchParams.tag === tag.name
                  ? "bg-primary-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {tag.name}
            </a>
          ))}
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="text-gray-500">No recipes found.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}

```

## ./src/components/navbar.tsx

```tsx
import Link from "next/link";

export function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-primary-600">
          RecipeShare
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/recipes"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Browse
          </Link>
          <Link
            href="/recipes/new"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
          >
            New Recipe
          </Link>
        </div>
      </div>
    </nav>
  );
}

```

## ./src/components/recipe-card.tsx

```tsx
import Link from "next/link";

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    description: string;
    cookTime: number;
    prepTime: number;
    servings: number;
    imageUrl: string | null;
    author: { name: string | null };
    tags: { id: string; name: string }[];
  };
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="flex h-48 items-center justify-center bg-gray-100 text-4xl text-gray-300">
          🍽
        </div>
      )}
      <div className="p-4">
        <h3 className="mb-1 text-lg font-semibold text-gray-900 group-hover:text-primary-600">
          {recipe.title}
        </h3>
        <p className="mb-3 line-clamp-2 text-sm text-gray-500">
          {recipe.description}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{totalTime} min total</span>
          <span>{recipe.servings} servings</span>
        </div>
        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

```

## ./src/lib/prisma.ts

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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
        primary: {
          50: "#fef7ee",
          100: "#fdedd3",
          200: "#fad7a5",
          300: "#f6ba6d",
          400: "#f19332",
          500: "#ee7711",
          600: "#df5d07",
          700: "#b94408",
          800: "#93360e",
          900: "#772e0f",
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

