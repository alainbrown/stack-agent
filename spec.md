Below is a **context / specification document** you can give to OpenAI Codex (or another coding agent). It is written as a **system design brief**: structured, implementation-oriented, and focused on the key decisions needed to build the system.

You can paste this directly into a coding agent as project context.

---

# AI Developer CLI – System Context Document

## Overview

This project is an **AI-assisted developer CLI** designed to help developers scaffold, configure, and evolve full-stack applications through an interactive workflow.

The tool acts as a **developer assistant and architecture planner**, not an autonomous app generator.

Key principle:

> **LLM decides architecture and intent; deterministic systems execute implementation.**

The CLI will guide developers through project setup, choose a recommended stack, scaffold code using templates, configure infrastructure, and assist with ongoing development tasks.

The system must prioritize:

* deterministic outcomes
* predictable scaffolding
* developer control
* extensibility
* minimal hallucination risk

The LLM should **not directly generate most project files**.

Instead:

```
LLM → decision-making
CLI engine → execution
templates/modules → code generation
```

This approach mirrors established scaffolding tools like Yeoman, but augmented with AI planning.

---

# Goals

Primary goals:

1. **Simplify project setup**
2. **Recommend modern, stable stacks**
3. **Generate production-ready scaffolds**
4. **Allow iterative development with AI assistance**
5. **Maintain predictable outcomes**

The tool should behave like a **senior software architect helping the developer set up a project**.

It is NOT intended to be a “prompt → random codebase generator”.

---

# Core User Experience

## Installation

Initial distribution via Node ecosystem:

```
npx create-stack
```

Optional global install:

```
npm install -g create-stack
```

Future distribution may include compiled binaries.

---

## First Run Flow

```
create-stack
```

CLI starts interactive session.

Example:

```
What are you building?
> SaaS analytics platform

Expected scale?
> small startup

Frontend preference?
> React

Need authentication?
> yes
```

After gathering requirements, the system proposes an architecture.

Example output:

```
Recommended stack:

Frontend: Next.js
Database: PostgreSQL
Auth: Supabase
Hosting: Vercel
Payments: Stripe
```

User confirms or edits.

Then the system scaffolds the project.

---

# Design Principles

## 1. Deterministic Execution

The LLM must not directly execute commands or modify files.

Instead it returns **structured decisions**.

Example output from LLM:

```json
{
  "template": "nextjs-saas",
  "modules": [
    "auth-supabase",
    "payments-stripe"
  ]
}
```

The CLI execution engine performs all actions.

---

## 2. Template-Based Scaffolding

Projects are built from **templates and modules**, not free-form LLM generation.

Templates define:

* file structure
* dependency lists
* configs
* build systems
* scripts

Example templates:

```
templates/
  nextjs-basic/
  nextjs-saas/
  node-api/
  react-spa/
```

Templates should be fully working projects.

---

## 3. Module System

Features are implemented as reusable modules.

Example modules:

```
modules/
  auth-supabase
  auth-nextauth
  payments-stripe
  database-postgres
  cache-redis
  analytics-posthog
```

Modules include:

```
module.json
files/
scripts/
```

Example module definition:

```
{
  "name": "auth-supabase",
  "dependencies": ["@supabase/supabase-js"],
  "env": ["SUPABASE_URL", "SUPABASE_KEY"],
  "files": ["auth.ts", "middleware.ts"]
}
```

The execution engine installs and integrates modules.

---

## 4. Structured LLM Outputs

The LLM must return **strict JSON schemas**.

Never parse free text.

Example schema:

```
StackDecision {
  frontend: string
  backend: string
  database: string
  auth: string
  deployment: string
  modules: string[]
}
```

The CLI validates this schema before execution.

---

# System Architecture

High level architecture:

```
CLI Interface
    ↓
Agent Orchestrator
    ↓
Planning (LLM)
    ↓
Stack Graph
    ↓
Execution Engine
    ↓
Templates + Modules
```

---

# Key Components

## CLI Interface

Responsibilities:

* interactive prompts
* command parsing
* session management

Example commands:

```
create-stack
create-stack add auth
create-stack add payments
create-stack doctor
create-stack explain
```

---

## Agent Orchestrator

The orchestrator manages the AI interaction loop.

Responsibilities:

* collect context
* call LLM
* parse outputs
* trigger execution

The agent loop runs **locally**.

---

## Planning Layer

The planning layer uses an LLM to:

* interpret user intent
* choose architecture
* recommend templates
* select modules

Tasks requiring reasoning should use stronger models.

Tasks requiring simple edits can use cheaper models.

---

## Stack Graph

The architecture plan is represented as a graph.

Example:

```
stack:
  frontend: nextjs
  backend: node
  database: postgres

features:
  auth
  payments
  analytics
```

The graph determines which templates and modules apply.

---

## Execution Engine

The execution engine performs deterministic actions:

* scaffold template
* install dependencies
* configure environment variables
* apply modules
* run setup scripts

Example operations:

```
apply_template(template)
install_dependencies()
apply_module(module)
run_hooks()
```

---

# Agent Workflow

The system operates in stages.

Example pipeline:

```
1. Requirement discovery
2. Architecture planning
3. Template selection
4. Scaffold generation
5. Module installation
6. Configuration
7. Verification
```

Each stage:

* has its own prompt
* has limited context
* produces structured output

---

# LLM Role

The LLM acts as a **software architect and advisor**.

Tasks suitable for LLM:

* architecture decisions
* stack recommendations
* interpreting developer intent
* small code generation tasks
* documentation generation

Tasks NOT suitable for LLM:

* dependency installation
* file system operations
* infrastructure configuration
* build setup

Those must be deterministic.

---

# Error Handling

The execution engine must detect failures and optionally request LLM assistance.

Example:

```
dependency conflict
↓
LLM asked for resolution
↓
returns fix suggestion
↓
execution engine applies fix
```

The LLM should not directly execute commands.

---

# Authentication

The CLI supports optional login for AI features.

Example:

```
create-stack login
```

Uses browser OAuth flow.

Local config stored in:

```
~/.create-stack/config.json
```

---

# Extensibility

The system must support adding new stacks and modules easily.

Future modules might include:

```
ai-openai
vector-db
job-queues
event-streaming
microservices
```

The template + module architecture should make the system extensible without modifying the core engine.

---

# Future Capabilities

Potential advanced features:

* project introspection
* dependency health checks
* automated upgrades
* architecture explanation
* performance analysis
* AI-assisted refactoring

Example:

```
create-stack analyze
create-stack optimize
create-stack migrate nextjs14
```

---

# Key Philosophy

The system should follow this principle:

```
AI decides WHAT
System decides HOW
```

This ensures:

* reliability
* developer trust
* reproducibility
* maintainability

---

# Summary

This project is an **AI-native developer CLI** combining:

* interactive architecture planning
* deterministic scaffolding
* modular project generation
* AI-assisted development workflows

The core architecture:

```
LLM planner
↓
stack graph
↓
execution engine
↓
templates + modules
```

The system must always favor **predictable results over generative flexibility**.

---

If you want, I can also write a **second document Codex will love even more:**

* a **technical implementation spec**
* directory structure
* TypeScript interfaces
* agent loop pseudocode

That usually speeds up coding agents **10×** because it removes ambiguity.
