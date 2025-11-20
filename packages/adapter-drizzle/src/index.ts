import { eq } from 'drizzle-orm';
import type { Context } from 'elysia';
import type {
  AdminConfig,
  AdapterResult,
  AdminHandlers,
  AdminSchema,
  AdminField
} from '@blackwaves/admingen-types';

export function createDrizzleAdapter(options: {
  config: AdminConfig;
}): AdapterResult {

  const schemaJson: AdminSchema = { resources: [] };

  // We will store the logic for each resource here, 
  // so the main 'handlers' object can look it up dynamically.
  const handlerMap: Record<string, any> = {};

  // Loop over the USER CONFIG (not the database schema)
  for (const resourceConfig of options.config.resources) {
    const resourceSlug = resourceConfig.slug;
    const table = resourceConfig.table;

    // 1. Build Schema for UI
    // The UI just needs to know what fields to render
    schemaJson.resources.push({
      name: resourceSlug,
      label: resourceConfig.label || resourceSlug,
      fields: resourceConfig.fields
    });

    // 2. Prepare Relationship Logic
    // We need two maps:
    // 'withRelations': Tells Drizzle which relations to JOIN (fetch)
    // 'foreignKeyMap': Tells the Create handler how to map UI names to DB columns
    const withRelations: Record<string, boolean> = {};
    const foreignKeyMap: Record<string, string> = {};

    for (const field of resourceConfig.fields) {
      if (field.type === 'relationship') {
        // Tell Drizzle to fetch this relation (e.g., "author": true)
        // This assumes the field name in config matches the relation name in Drizzle
        withRelations[field.name] = true;

        // Map UI name -> DB Column (e.g., "author" -> "authorId")
        if (field.foreignKey) {
          foreignKeyMap[field.name] = field.foreignKey;
        }
      }
    }

    // 3. Build Handlers specific to this resource
    handlerMap[resourceSlug] = {

      // FIND MANY
      findMany: async ({ db }: { db: any }) => {
        if (!db.query[resourceSlug]) {
          throw new Error(`Drizzle query not found for '${resourceSlug}'. Did you pass the schema to drizzle()?`);
        }
        // "Smart" fetch: automatically joins relations defined in config
        return db.query[resourceSlug].findMany({
          with: Object.keys(withRelations).length > 0 ? withRelations : undefined
        });
      },

      // FIND ONE
      findOne: async ({ db, params }: { db: any, params: { id: any } }) => {
        // We assume standard auto-increment ID for now
        const id = Number(params.id);

        // Use 'eq' on the table's primary key (assumed to be 'id')
        // We can make this more robust later by inspecting the PK
        return db.query[resourceSlug].findFirst({
          where: eq(table.id, id),
          with: Object.keys(withRelations).length > 0 ? withRelations : undefined
        });
      },

      // CREATE
      create: async ({ db, body }: { db: any, body: any }) => {
        const data = { ...body };

        // MAP RELATIONSHIPS: 
        // The UI sends { "author": 1 }
        // The Database needs { "authorId": 1 }
        for (const [fieldName, dbColumn] of Object.entries(foreignKeyMap)) {
          if (data[fieldName] !== undefined) {
            data[dbColumn] = data[fieldName]; // Move value to DB column key
            delete data[fieldName]; // Remove the relation object key
          }
        }

        const res = await db.insert(table).values(data).returning();
        return res[0];
      },

      // UPDATE
      update: async ({ db, params, body }: { db: any, params: { id: any }, body: any }) => {
        const id = Number(params.id);
        const data = { ...body };

        // MAP RELATIONSHIPS:
        for (const [fieldName, dbColumn] of Object.entries(foreignKeyMap)) {
          if (data[fieldName] !== undefined) {
            data[dbColumn] = data[fieldName];
            delete data[fieldName];
          }
        }

        const res = await db.update(table)
          .set(data)
          .where(eq(table.id, id))
          .returning();

        return res[0];
      },

      // DELETE
      delete: async ({ db, params }: { db: any, params: { id: any } }) => {
        const id = Number(params.id);
        const res = await db.delete(table)
          .where(eq(table.id, id))
          .returning();

        return res[0];
      }
    };
  }

  // 4. Create the Routing Proxy
  // This object is what the AdminGen plugin actually calls.
  // It looks up the correct handler from handlerMap based on the URL resource.
  const handlers: AdminHandlers = {
    findMany: (resource) => (ctx: any) => {
      if (!handlerMap[resource]) throw new Error(`Resource ${resource} not found`);
      return handlerMap[resource].findMany(ctx);
    },
    findOne: (resource) => (ctx: any) => {
      if (!handlerMap[resource]) throw new Error(`Resource ${resource} not found`);
      return handlerMap[resource].findOne(ctx);
    },
    create: (resource) => (ctx: any) => {
      if (!handlerMap[resource]) throw new Error(`Resource ${resource} not found`);
      return handlerMap[resource].create(ctx);
    },
    update: (resource) => (ctx: any) => {
      if (!handlerMap[resource]) throw new Error(`Resource ${resource} not found`);
      return handlerMap[resource].update(ctx);
    },
    delete: (resource) => (ctx: any) => {
      if (!handlerMap[resource]) throw new Error(`Resource ${resource} not found`);
      return handlerMap[resource].delete(ctx);
    },
  };

  return { schemaJson, handlers };
}