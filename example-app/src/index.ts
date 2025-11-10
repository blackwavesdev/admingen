import { Elysia } from 'elysia';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema'; // The user's schema
import { cors } from '@elysiajs/cors';

// 1. Import our framework
import { createDrizzleAdapter } from '@admingen/adapter-drizzle';
import { AdminGen } from 'admingen';

// 2. Standard Drizzle setup
const sqlite = new Database('sqlite.db', { create: true });
const db = drizzle(sqlite, { schema });

// 3. Use the framework!
const adapterResult = createDrizzleAdapter({ schema });

const app = new Elysia()
  .use(cors())
  .decorate('db', db) // Decorate 'db' so our handlers can use it
  .use(
    AdminGen({
      adapterResult, // Pass the adapter's output
      adminPath: '/admin',
      // We are NOT passing 'uiAssetsPath'
    })
  )
  .get('/', () => 'Hello from Example App')
  .listen(3000);

console.log(
  `🦊 Example app running at http://localhost:3000`,
  `🚀 Admin API running at http://localhost:3000/admin/api`
);