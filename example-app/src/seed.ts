import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

// Connect to the *same* database file
const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite, { schema });

async function main() {
  console.log('Seeding database...');

  // 1. Clear existing data (to make script re-runnable)
  await db.delete(schema.posts);
  await db.delete(schema.users);
  console.log('Cleared old data.');

  // 2. Insert new users
  await db.insert(schema.users).values([
    { email: 'admin@example.com', name: 'Admin' },
    { email: 'user@example.com', name: 'User' },
  ]);
  console.log('Inserted 2 users.');

  // 3. Insert new posts
  await db.insert(schema.posts).values([
    { title: 'Hello World', content: 'This is the first post!' },
    { title: 'My Second Post', content: 'This is the admin panel.' },
    { title: 'Test Post', content: 'Lorem ipsum...' },
  ]);
  console.log('Inserted 3 posts.');

  console.log('✅ Seed complete!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});