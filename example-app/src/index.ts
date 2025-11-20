import { Elysia } from 'elysia';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { cors } from '@elysiajs/cors';
// Import your tables specifically
import { posts, users, postsRelations, usersRelations, teams } from './schema'; 

import { AdminGen } from '@blackwaves/admingen';
import { createDrizzleAdapter } from '@blackwaves/admingen-adapter-drizzle';

const sqlite = new Database('sqlite.db');
// IMPORTANT: You MUST pass schema to Drizzle so query API works
const db = drizzle(sqlite, { schema: { posts,teams, users, postsRelations, usersRelations } });

// --- THE CONFIGURATION ---
const adapterResult = createDrizzleAdapter({
  config: {
    resources: [
      {
        slug: 'teams',
        table: teams,
        fields: [
          { name: 'id', type: 'number', isId: true },
          { name: 'name', type: 'text' }
        ]
      },
      {
        slug: 'users',
        table: users,
        fields: [
          { name: 'id', type: 'number', isId: true },
          { name: 'email', type: 'text' },
          { name: 'name', type: 'text' },
          {
            name: 'team',
            type: 'relationship',
            relationTo: 'teams',
            foreignKey: 'teamId'
          }
        ]
      },
      {
        slug: 'posts',
        table: posts,
        fields: [
          { name: 'id', type: 'number', isId: true },
          { name: 'title', type: 'text' },
          { name: 'content', type: 'textarea' },
          {
            name: 'author',
            type: 'relationship',
            relationTo: 'users',
            foreignKey: 'authorId'
          }
        ]
      }
    ]
  }
});

const app = new Elysia()
  .use(cors())
  .decorate('db', db)
  .use(AdminGen({ adapterResult }))
  .listen(3000);

console.log(`🚀 Admin Panel live at http://localhost:3000/admin`);