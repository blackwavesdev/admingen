// packages/adapter-drizzle/src/index.ts
import { getTableColumns, eq, type Table } from 'drizzle-orm';
import type { Elysia, Context } from 'elysia';

import {
  type AdminSchema,
  type AdminHandlers,
  type AdapterResult,
  type AdminField,
  type AdminResource
} from '@admingen/types';

type DrizzleDB = {
  query: Record<string, any>;
};

// --- FIX #1: Updated to check for 'string' and 'number' ---
function mapColumnToField(column: any): AdminField | null {
  const columnType = column.dataType?.toLowerCase();
  const isId = column.primary;
  const label = column.name;

  if (columnType === 'string' || columnType === 'text' || columnType === 'varchar') {
    return { name: column.name, type: 'text', label, isId };
  }
  if (columnType === 'number' || columnType === 'integer') {
    return { name: column.name, type: 'number', label, isId };
  }
  
  return null;
}

// --------------------------------------------------------------------------
// CORE FUNCTION: Creates the Adapter
// --------------------------------------------------------------------------
export function createDrizzleAdapter(options: {
  schema: Record<string, any>;
}): AdapterResult {
  
  // You can remove the console.log now if you want
  // console.log("ADAPTER RECEIVED SCHEMA:", options.schema);

  const schemaJson: AdminSchema = { resources: [] };
  const tables = options.schema;

  // 1. INTROSPECTION: Analyze the user's schema object
  for (const tableName in tables) {
    const table = tables[tableName];
    let columns: ReturnType<typeof getTableColumns>;

    // --- FIX #2: Use a try/catch to see if it's a table ---
    try {
      // getTableColumns will throw an error if 'table' is not a table
      columns = getTableColumns(table as Table);
    } catch (e) {
      // This wasn't a table, just skip it (e.g., 'default' export)
      continue;
    }
    // --- End Fix ---

    const resource: AdminResource = {
      name: tableName,
      label: tableName.charAt(0).toUpperCase() + tableName.slice(1),
      fields: [],
    };

    for (const column of Object.values(columns)) {
      const field = mapColumnToField(column);
      if (field) {
        resource.fields.push(field);
      }
    }
    
    if (resource.fields.length > 0) {
      schemaJson.resources.push(resource);
    }
  }

  // 2. API GENERATION: Create generic CRUD handlers
  const handlers: AdminHandlers = {
    findMany: (resourceName) => async ({ db }: Context & { db: DrizzleDB }) => {
      return db.query[resourceName].findMany();
    },

    findOne: (resourceName) => async ({ db, params }: Context & { db: DrizzleDB; params: { id: any } }) => {
      const table = tables[resourceName];
      const columns = getTableColumns(table as Table);
      const pkColumn = Object.values(columns).find(c => c.primary);
      
      if (!pkColumn) {
        throw new Error(`No primary key found for resource: ${resourceName}`);
      }
      
      const id = Number(params.id);
      return db.query[resourceName].findFirst({ 
        where: eq(pkColumn, id) 
      });
    },
    
    // Stubbed handlers
    create: (resourceName: string) => async () => ({
      message: `${resourceName} create handler not implemented.`,
    }),
    update: (resourceName: string) => async () => ({
      message: `${resourceName} update handler not implemented.`,
    }),
    delete: (resourceName: string) => async () => ({
      message: `${resourceName} delete handler not implemented.`,
    }),
  };

  return { schemaJson, handlers };
}