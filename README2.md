# 🌊 **AdminGen Framework MVP: Backend Complete!**

This repository hosts the monorepo for **AdminGen**, a pluggable, code-first admin panel framework. Its goal is to provide a **headless backend** that can _auto-generate_ a complete admin API by introspecting your existing Drizzle database schema.

---

## 🚀 **Current Status: Backend Pipeline 100% Functional**

As of this commit:
- The backend pipeline, introspection engine, and plugin architecture are **complete and validated**.

**Accomplishments proven by Example App:**
1. Behaves as a user-installed package (`example-app`)
2. **Introspects** a real Drizzle schema (e.g. `posts` and `users` tables)
3. **Generates** a dynamic JSON schema from your tables
4. **Registers** the generated API routes with your Elysia app

---

### 🔎 Verified with this `curl` command

```sh
curl http://localhost:3000/admin/api/_schema
```

---

✅ **Successful Output:**
```json
{
  "resources": [
    {
      "name": "posts",
      "label": "Posts",
      "fields": [
        {
          "name": "id",
          "type": "number",
          "label": "id",
          "isId": true
        },
        {
          "name": "title",
          "type": "text",
          "label": "title",
          "isId": false
        },
        {
          "name": "content",
          "type": "text",
          "label": "content",
          "isId": false
        }
      ]
    },
    {
      "name": "users",
      "label": "Users",
      "fields": [
        {
          "name": "id",
          "type": "number",
          "label": "id",
          "isId": true
        },
        {
          "name": "email",
          "type": "text",
          "label": "email",
          "isId": false
        }
      ]
    }
  ]
}
```

---

## 🏛️ **Monorepo Architecture**

This project is a Bun monorepo with **4 framework packages** and **1 test application**:

**1. `packages/types` — _The Contract_**

- _Purpose:_ The single source of truth. Exports TypeScript interfaces (`AdminSchema`, `AdminResource`, `AdapterResult`, etc.) — all packages use these contracts.

**2. `packages/adapter-drizzle` — _The Brain_**

- _Purpose:_ The introspection engine. Its main export, `createDrizzleAdapter({ schema })`, reads your Drizzle schema, maps DB types to UI types (e.g. `integer`→`number`), and generates the JSON AdminSchema and CRUD API handlers.

**3. `packages/admingen` — _The Core Plugin_**

- _Purpose:_ The main package for users. Its main export, `AdminGen({ adapterResult, ... })`, is an Elysia plugin orchestrating everything—registering generated API routes and serving the frontend UI.

**4. `packages/ui` — _The Frontend_**

- _Purpose:_ A generic Vite/React app built with TanStack Router/Query/Table/Form and Shadcn.
- _Note:_ The frontend is "dumb" (does not know about Drizzle). It reads `/api/_schema` to build the UI dynamically.

> **Status:** 🚧 **PENDING. This is the next phase!**

**5. `example-app` — _The Test Harness_**

- _Purpose:_ A "real-world" user app. Installs `admingen` and `@admingen/adapter-drizzle` to verify things work from an end-user perspective (the example used for backend validation).

---

### ➡️ **Next Steps: Phase 5 – Building the UI**

With the backend now "headless" and ready, the next phase is the `packages/ui` React app.

**Immediate Tasks:**
- **Run the UI dev server** (in its own terminal)
- **Fetch the Schema:** In the UI’s root component, use TanStack Query to fetch from `http://localhost:3000/admin/api/_schema`
- **Build the Sidebar:** Use the `resources` array from the schema to render main navigation links (e.g., "Posts", "Users", etc.)
- **Build the List View:** Create a dynamic route (e.g., `src/routes/admin/$resource.tsx`) using TanStack Table to show data for any resource

