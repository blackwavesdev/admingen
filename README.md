# 🌊 AdminGen by Black Waves

[![npm version](https://img.shields.io/npm/v/@blackwaves/admingen/beta.svg)](https://www.npmjs.com/package/@blackwaves/admingen)
[![npm downloads](https://img.shields.io/npm/dw/@blackwaves/admingen.svg)](https://www.npmjs.com/package/@blackwaves/admingen)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/blackwavesdev/admingen/publish.yml?branch=main)](https://github.com/blackwavesdev/admingen/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An instant, "headless" admin panel for modern JavaScript backends, built on **ElysiaJS** and **Drizzle ORM**.

This framework introspects your Drizzle schema, auto-generates a secure API, and provides a dynamic, pre-built React UI to manage your data.

> **Note:** A 15-second GIF showing the final, working admin panel is the perfect demo to add here.

---

## ✨ Core Features

- **Zero-Config API:** Automatically generates a full REST API from your existing Drizzle schema.
- **Dynamic UI:** The React frontend (built with TanStack) dynamically renders tables, filters, and sorting based on your API schema.
- **Plug-and-Play:** Add it to your existing Elysia server in just a few lines of code.
- **Modern Stack:** Built on the fastest, most modern tools: Bun, Elysia, and Drizzle.
- **Open Source:** MIT-licensed, built in public by **[@blackwaves](https://github.com/blackwavesdev)**.

---

## ⚡ Tech Stack

- **Runtime:** [Bun](https://bun.sh/)
- **Backend:** [ElysiaJS](https://elysiajs.com/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Frontend:** [Vite](https://vitejs.dev/) + [React](https://react.dev/)
- **UI/State:** [TanStack](https://tanstack.com/) (Router, Query, Table, Form)
- **Styling:** [Shadcn/UI](https://ui.shadcn.com/)

---

## 🚦 Status: Beta

This project is currently in **beta**. The core functionality including Create, Read, Update, and Delete (CRUD) is complete, tested, and published to npm.

We are actively working on Authentication and advanced features.

---

## 🚀 Quick Start

Get your admin panel running in 3 minutes.

### 1. Installation

In your existing Elysia + Drizzle project, install the core framework, the Drizzle adapter, and all required peer dependencies.

````bash
# Install the core framework and the Drizzle adapter
bun add @blackwaves/admingen@beta @blackwaves/admingen-adapter-drizzle@beta

# Install required peer dependencies
bun add elysia drizzle-orm @sinclair/typebox

### 2. Usage

Add the following to your main Elysia server file (e.g., `src/index.ts`):

```ts
import { Elysia } from 'elysia';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './src/schema'; // Your Drizzle schema

import { AdminGen } from '@blackwaves/admingen';
import { createDrizzleAdapter } from '@blackwaves/admingen-adapter-drizzle';

// Set up Drizzle with Bun SQLite
const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

// Create the adapter for AdminGen
const adapterResult = createDrizzleAdapter({ schema });

const app = new Elysia()
  // Make the db instance available in the Elysia context for plugins/adapters
  .decorate('db', db)
  .use(
    AdminGen({
      adapterResult,
      adminPath: '/admin', // Optional: customize your admin URL prefix
    })
  )
  .listen(3000);

console.log('🦊 Admin panel running at http://localhost:3000/admin');
````

### 3. Run It!

Follow these steps to launch your admin panel:

```bash
# (Optional) Prepare your database tables using Drizzle
bunx drizzle-kit generate

# Start the development server
bun run dev
```

## 3. Launch the Admin Panel

Open your browser and navigate to [http://localhost:3000/admin](http://localhost:3000/admin)  
You should now see your full admin panel, displaying all data from your Drizzle database tables.

---

## 🛣️ Roadmap

We are building this in public—follow our progress!

- [x] **Core:** Monorepo Setup (Bun, TSC, Vitest)
- [x] **Adapter:** Drizzle Schema Introspection
- [x] **API:** Auto-generation of API routes in Elysia
- [x] **UI:** Dynamic Sidebar Generation
- [x] **UI:** Dynamic Table View (List/Get)
- [x] **UI:** Filtering & Sorting
- [x] **Build:** Automated publishing pipeline to npm
- [x] **API/UI:** Create Functionality
- [x] **API/UI:** Update Functionality
- [x] **API/UI:** Delete Functionality
- [ ] **Auth:** Simple beforeHandle authentication hooks

---

## 🤝 Contributing

We welcome all contributions!  
Feel free to [open a GitHub issue](https://github.com/blackwaves/admingen/issues) to report a bug, request a feature, or submit a pull request.

---

## 📜 License

This project is licensed under the MIT License.  
Copyright (c) 2025 Black Waves.
