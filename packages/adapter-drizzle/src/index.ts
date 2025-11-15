// packages/adapter-drizzle/src/index.ts
import { getTableColumns, eq, type Table } from 'drizzle-orm';
import type { Elysia, Context } from 'elysia';

import {
  type AdminSchema,
  type AdminHandlers,
  type AdapterResult,
  type AdminField,
  type AdminResource
} from '@blackwaves/admingen-types';

type DrizzleDB = {
  query: Record<string, any>;
};

// Helper to extract table name from a Drizzle table reference
function getTableNameFromReference(ref: any): string | null {
  if (!ref) return null;
  // Try to get table name from various Drizzle internal properties
  if (typeof ref === 'string') return ref;
  if (ref.table) {
    const table = ref.table;
    if (typeof table === 'string') return table;
    if (table.name) return table.name;
    if (table[Symbol.for('drizzle:Name')]) return table[Symbol.for('drizzle:Name')];
    // Try to get from table's _.name
    if (table._?.name) return table._.name;
  }
  if (ref.name) return ref.name;
  if (ref[Symbol.for('drizzle:Name')]) return ref[Symbol.for('drizzle:Name')];
  // Try _ property
  if (ref._?.name) return ref._.name;
  return null;
}

// Helper to find table name by matching table object
function findTableNameByObject(tableObj: any, allTables: Record<string, any>): string | null {
  if (!tableObj) return null;
  
  // Direct object comparison
  for (const [name, table] of Object.entries(allTables)) {
    if (table === tableObj) return name;
  }
  
  // Try to get table name from the object itself
  const tableName = getTableNameFromReference(tableObj);
  if (tableName && allTables[tableName]) {
    return tableName;
  }
  
  // Try comparing internal table references
  for (const [name, table] of Object.entries(allTables)) {
    const tableInternal = (table as any)?._;
    const objInternal = tableObj?._;
    if (tableInternal && objInternal && tableInternal === objInternal) {
      return name;
    }
    // Also check if tableObj is the table's internal structure
    if ((table as any)?._ === tableObj || table === tableObj) {
      return name;
    }
  }
  
  return null;
}

// --- FIX #1: Updated to check for 'string' and 'number' ---
function mapColumnToField(
  column: any, 
  allTables: Record<string, any>, 
  tableName: string,
  tableForeignKeys?: Record<string, any>
): AdminField | null {
  const columnType = column.dataType?.toLowerCase();
  const isId = column.primary;
  const label = column.name;

  // Check if this column is a foreign key
  // Drizzle stores foreign key info in different places depending on version
  let referencedTable: string | null = null;
  
  // Method 1: Check table's foreignKeys (most reliable for Drizzle)
  if (tableForeignKeys) {
    for (const fkName in tableForeignKeys) {
      const fk = tableForeignKeys[fkName];
      // Check if this column is part of the foreign key
      if (fk.columnsFrom && Array.isArray(fk.columnsFrom) && fk.columnsFrom.includes(column.name)) {
        // Get the referenced table name
        if (fk.tableTo) {
          referencedTable = fk.tableTo;
        } else if (fk.foreignTable) {
          referencedTable = getTableNameFromReference(fk.foreignTable);
        }
        break;
      }
    }
  }
  
  // Method 2: Check column.foreignKeys array
  if (!referencedTable && column.foreignKeys && Array.isArray(column.foreignKeys) && column.foreignKeys.length > 0) {
    const fk = column.foreignKeys[0];
    referencedTable = getTableNameFromReference(fk.foreignTable || fk.table);
  }
  
  // Method 3: Check column.references (function that returns table reference)
  if (!referencedTable && column.references) {
    try {
      const refResult = typeof column.references === 'function' ? column.references() : column.references;
      referencedTable = getTableNameFromReference(refResult);
      // If we got a table object, try to find it in allTables
      if (!referencedTable && refResult) {
        referencedTable = findTableNameByObject(refResult, allTables);
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Method 4: Check column._.references
  if (!referencedTable && column._?.references) {
    const ref = column._.references;
    if (typeof ref === 'function') {
      try {
        const refResult = ref();
        referencedTable = getTableNameFromReference(refResult);
        if (!referencedTable && refResult) {
          referencedTable = findTableNameByObject(refResult, allTables);
        }
      } catch (e) {
        // Ignore
      }
    } else {
      referencedTable = getTableNameFromReference(ref);
      if (!referencedTable && ref) {
        referencedTable = findTableNameByObject(ref, allTables);
      }
    }
  }
  
  // Method 5: Check column._.foreignKeys
  if (!referencedTable && column._?.foreignKeys && Array.isArray(column._.foreignKeys) && column._.foreignKeys.length > 0) {
    const fk = column._.foreignKeys[0];
    referencedTable = getTableNameFromReference(fk.foreignTable || fk.table);
  }
  
  if (referencedTable && allTables[referencedTable]) {
    return {
      name: column.name,
      type: 'relation',
      label,
      isId: false,
      relationType: 'manyToOne',
      relatedResource: referencedTable,
      foreignKey: column.name,
    };
  }

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
  
  // Build a map of table names to their relation names
  // This helps us know which relations to include in queries
  const tableRelationsMap: Record<string, string[]> = {};
  
  // Scan for relations objects (e.g., postsRelations, usersRelations)
  for (const key in tables) {
    if (key.includes('Relations') || key.endsWith('Relations')) {
      const relationsObj = tables[key];
      if (relationsObj && typeof relationsObj === 'object') {
        // Extract table name from relations object name
        // e.g., "postsRelations" -> "posts"
        const baseTableName = key.replace(/Relations$/, '').replace(/s$/, '');
        const tableName = baseTableName || key.replace(/Relations$/, '');
        
        // Get relation names from the relations object
        // Don't call the relation functions here - they need proper context
        // Just collect the function names as they are valid relations
        const relationNames: string[] = [];
        for (const relKey in relationsObj) {
          // Skip internal properties and non-function values
          if (relKey === '_' || relKey.startsWith('$')) continue;
          
          const rel = relationsObj[relKey];
          // If it's a function, assume it's a valid relation
          // We'll validate it when we actually use it in queries
          if (rel && typeof rel === 'function') {
            relationNames.push(relKey);
          }
        }
        
        if (relationNames.length > 0) {
          // Try both singular and plural table names
          tableRelationsMap[tableName] = relationNames;
          tableRelationsMap[`${tableName}s`] = relationNames;
          if (tableName.endsWith('s')) {
            tableRelationsMap[tableName.slice(0, -1)] = relationNames;
          }
        }
      }
    }
  }

  // 1. INTROSPECTION: Analyze the user's schema object
  for (const tableName in tables) {
    const table = tables[tableName];
    let columns: ReturnType<typeof getTableColumns>;

    try {
      columns = getTableColumns(table as Table);
    } catch (e) {
      // This wasn't a table, just skip it (e.g., 'default' export or relations)
      continue;
    }
    
    if (!columns) {
      continue;
    }

    const resource: AdminResource = {
      name: tableName,
      label: tableName.charAt(0).toUpperCase() + tableName.slice(1),
      fields: [],
    };

    // Get table's foreign keys if available
    // Drizzle stores foreign keys in table._.foreignKeys or table.foreignKeys
    let tableForeignKeys: Record<string, any> | undefined;
    try {
      if ((table as any).foreignKeys) {
        tableForeignKeys = (table as any).foreignKeys;
      } else if ((table as any)._?.foreignKeys) {
        tableForeignKeys = (table as any)._?.foreignKeys;
      }
    } catch (e) {
      // Ignore
    }

    // Process columns (including foreign keys)
    // First, try to access the original table definition to get column references
    // In Drizzle, columns are defined as properties on the table object
    // e.g., posts.authorId is the column definition with the reference
    const tableDef = table as any;

    // First, build a map of all column definitions from the table object
    // This helps us match columns regardless of how getTableColumns keys them
    const columnDefMap: Map<string, any> = new Map();
    for (const key in tableDef) {
      if (key === '_' || key === 'foreignKeys' || key.startsWith('$')) continue;
      const prop = tableDef[key];
      if (prop && typeof prop === 'object') {
        // Check if this looks like a column definition
        const dbName = prop.name || prop._?.name;
        if (dbName) {
          // Map by database column name
          columnDefMap.set(dbName, prop);
          // Also map by property name (schema name)
          columnDefMap.set(key, prop);
        }
      }
    }
    
    // Build foreign key map from table._.foreignKeys
    const fkMap: Map<string, string> = new Map(); // column name -> referenced table name
    if (tableDef._?.foreignKeys) {
      for (const fk of tableDef._.foreignKeys) {
        if (fk.columnsFrom && fk.tableTo) {
          const fromCol = Array.isArray(fk.columnsFrom) ? fk.columnsFrom[0] : fk.columnsFrom;
          const fromColName = typeof fromCol === 'string' ? fromCol : (fromCol?.name || fromCol?._?.name);
          const toTableName = typeof fk.tableTo === 'string' ? fk.tableTo : getTableNameFromReference(fk.tableTo);
          if (fromColName && toTableName) {
            fkMap.set(fromColName, toTableName);
          }
        }
      }
    }
    
    // Check relations objects in the schema (e.g., postsRelations)
    // These contain relationship definitions that can help us identify foreign keys
    for (const key in tables) {
      if (key.includes('Relations') || key.endsWith('Relations')) {
        const relationsObj = tables[key];
        if (relationsObj && typeof relationsObj === 'object') {
          // Check if this relations object is for our current table
          const baseTableName = key.replace(/Relations$/, '').replace(/s$/, '');
          if (baseTableName === tableName || `${baseTableName}s` === tableName) {
            // Iterate through relations to find foreign key mappings
            // Note: We can't call the relation functions here as they need proper Drizzle context
            // Instead, we'll rely on the naming convention and foreign key detection methods above
            // The relations are already being used to build the tableRelationsMap for querying
          }
        }
      }
    }
    
    // Naming convention heuristic: if column ends with _id and we can infer the table
    // For author_id -> users, we need to check all tables and see which one makes sense
    const inferForeignKeyFromName = (colName: string): string | null => {
      if (!colName.endsWith('_id') && !colName.endsWith('Id')) return null;
      if (colName === 'id') return null; // Skip primary keys
      
      // Remove _id or Id suffix
      const baseName = colName.replace(/_id$|Id$/, '');
      
      // For author_id, try to find users table (common pattern)
      // Try exact match, plural, and common variations
      const possibleNames = [
        baseName,
        `${baseName}s`,
        baseName.slice(0, -1), // Remove last char (author -> autho, but that's not right)
      ];
      
      // Special cases
      if (baseName === 'author') {
        // author_id likely references users
        if (tables['users']) return 'users';
        if (tables['user']) return 'user';
      }
      
      // Try all possible names
      for (const [tableName] of Object.entries(tables)) {
        if (possibleNames.includes(tableName)) {
          return tableName;
        }
        // Also try if table name contains the base name
        if (tableName.includes(baseName) || baseName.includes(tableName)) {
          return tableName;
        }
      }
      
      return null;
    };

    // Process columns - getTableColumns returns columns keyed by their schema property names
    for (const columnKey in columns) {
      const column = columns[columnKey];
      let isForeignKey = false;
      
      // Find the original column definition
      // Try multiple keys: columnKey (from getTableColumns), column.name (database name)
      let originalColumnDef = columnDefMap.get(columnKey) || columnDefMap.get(column.name);
      
      // If still not found, try camelCase/snake_case conversions
      if (!originalColumnDef) {
        if (columnKey.includes('_')) {
          const camelCaseKey = columnKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          originalColumnDef = columnDefMap.get(camelCaseKey);
        } else if (/[A-Z]/.test(columnKey)) {
          const snakeCaseKey = columnKey.replace(/([A-Z])/g, '_$1').toLowerCase();
          originalColumnDef = columnDefMap.get(snakeCaseKey);
        }
      }
      
      // Last resort: iterate through all table properties and match by database column name
      if (!originalColumnDef) {
        for (const key in tableDef) {
          if (key === '_' || key === 'foreignKeys' || key.startsWith('$')) continue;
          const prop = tableDef[key];
          if (prop && typeof prop === 'object') {
            const propDbName = prop.name || prop._?.name;
            if (propDbName === column.name) {
              originalColumnDef = prop;
              break;
            }
          }
        }
      }
      
      if (originalColumnDef && typeof originalColumnDef === 'object') {
        // Check for references in multiple possible locations
        let ref: any = null;
        
        // Try _.references (most common)
        if (originalColumnDef._?.references) {
          ref = originalColumnDef._.references;
        }
        // Try direct references property
        else if (originalColumnDef.references) {
          ref = originalColumnDef.references;
        }
        // Try _.foreignKeys
        else if (originalColumnDef._?.foreignKeys && Array.isArray(originalColumnDef._.foreignKeys) && originalColumnDef._.foreignKeys.length > 0) {
          const fk = originalColumnDef._.foreignKeys[0];
          ref = fk.foreignTable || fk.table;
        }
        
        if (ref) {
          try {
            let refTableObj: any = null;
            
            // If ref is a function, call it to get the column
            if (typeof ref === 'function') {
              try {
                const refColumn = ref();
                // Get the table from the referenced column - try multiple paths
                refTableObj = (refColumn as any)?._?.table 
                  || (refColumn as any)?.table 
                  || (refColumn as any)?._?.relationTable
                  || refColumn;
                
                // If refColumn itself looks like a table, use it
                if (!refTableObj || (typeof refTableObj === 'object' && !refTableObj._ && !refTableObj.name)) {
                  // Try to get from the column's parent
                  const colTable = (refColumn as any)?._?.table;
                  if (colTable) refTableObj = colTable;
                }
              } catch (e) {
                // Function might return the table directly, or might throw
                // Try to get table from the function itself or its closure
                refTableObj = (ref as any)?._?.table || (ref as any)?.table;
              }
            } else {
              // ref is already an object (column or table)
              refTableObj = (ref as any)?._?.table || (ref as any)?.table || (ref as any)?._?.relationTable || ref;
            }
            
            if (refTableObj) {
              const refTable = findTableNameByObject(refTableObj, tables);
              if (refTable) {
                const field = {
                  name: column.name, // Use database column name (e.g., "author_id")
                  type: 'relation' as const,
                  label: columnKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase()).trim(),
                  isId: false,
                  relationType: 'manyToOne' as const,
                  relatedResource: refTable,
                  foreignKey: column.name,
                };
                resource.fields.push(field);
                isForeignKey = true;
              }
            }
          } catch (e) {
            // Ignore errors, fall through to standard detection
          }
        }
      }
      
      // Check foreign key map from table config
      if (!isForeignKey && fkMap.has(column.name)) {
        const refTable = fkMap.get(column.name)!;
        if (refTable && tables[refTable]) {
          const field = {
            name: column.name,
            type: 'relation' as const,
            label: columnKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase()).trim(),
            isId: false,
            relationType: 'manyToOne' as const,
            relatedResource: refTable,
            foreignKey: column.name,
          };
          resource.fields.push(field);
          isForeignKey = true;
        }
      }
      
      // Fall back to naming convention heuristic
      if (!isForeignKey) {
        const inferredTable = inferForeignKeyFromName(column.name);
        if (inferredTable && tables[inferredTable]) {
          const field = {
            name: column.name,
            type: 'relation' as const,
            label: columnKey.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase()).trim(),
            isId: false,
            relationType: 'manyToOne' as const,
            relatedResource: inferredTable,
            foreignKey: column.name,
          };
          resource.fields.push(field);
          isForeignKey = true;
        }
      }
      
      // Final fallback to standard detection
      if (!isForeignKey) {
        const field = mapColumnToField(column, tables, tableName, tableForeignKeys);
        if (field) {
          resource.fields.push(field);
        }
      }
    }
    
    if (resource.fields.length > 0) {
      schemaJson.resources.push(resource);
    }
  }

  // 2. API GENERATION: Create generic CRUD handlers
  const handlers: AdminHandlers = {
    findMany: (resourceName) => async ({ db }: Context & { db: DrizzleDB }) => {
      // Don't use 'with' clause for now - it's causing Drizzle internal errors
      // Relations will be loaded separately by the UI if needed
      // The UI already fetches related resources separately, so this works fine
      return await db.query[resourceName].findMany();
    },

    findOne: (resourceName) => async ({ db, params }: Context & { db: DrizzleDB; params: { id: any } }) => {
      const table = tables[resourceName];
      const columns = getTableColumns(table as Table);
      const pkColumn = Object.values(columns).find(c => c.primary);
      
      if (!pkColumn) {
        throw new Error(`No primary key found for resource: ${resourceName}`);
      }
      
      const id = Number(params.id);
      // Use basic query - relations will be loaded separately if needed
      return await db.query[resourceName].findFirst({ 
        where: eq(pkColumn, id)
      });
    },
    
    // Stubbed handlers
    // --- THIS IS THE NEW CODE ---
create: (resourceName: string) => async ({ db, body }: Context & { db: any, body: any }) => {
  const table = tables[resourceName];
  
  if (!table) {
    throw new Error(`Invalid resource name: ${resourceName}`);
  }
  
  try {
    // Clean up the body: convert empty strings to null for optional fields
    // and ensure foreign keys are numbers or null
    const cleanedBody: Record<string, any> = {};
    const columns = getTableColumns(table as Table);
    
    // Map database column names to schema property names
    // Drizzle expects property names (e.g., authorId) not DB column names (e.g., author_id)
    const columnToPropertyMap: Record<string, string> = {};
    for (const colKey in columns) {
      const col = columns[colKey];
      if (col && col.name) {
        columnToPropertyMap[col.name] = colKey; // Map DB name -> property name
      }
    }
    
    for (const key in body) {
      const value = body[key];
      
      // Check if this is a database column name that needs to be mapped to property name
      const propertyName = columnToPropertyMap[key] || key;
      const column = Object.values(columns).find((col: any) => col.name === key || col.name === propertyName);
      
      if (value === '' || value === undefined) {
        // For optional fields, set to null
        cleanedBody[propertyName] = null;
      } else if (column && (column.dataType?.toLowerCase() === 'number' || column.dataType?.toLowerCase() === 'integer')) {
        // Ensure numbers are actually numbers
        cleanedBody[propertyName] = value === null || value === '' ? null : Number(value);
      } else {
        cleanedBody[propertyName] = value;
      }
    }
    
    // Debug log for posts
    if (resourceName === 'posts') {
      console.log('Create posts - body:', body);
      console.log('Create posts - cleanedBody:', cleanedBody);
      console.log('Column to property map:', columnToPropertyMap);
    }
    
    // Insert with cleaned body
    const result = await db.insert(table).values(cleanedBody).returning();
    
    // Return the newly created item
    // Note: Relations are not loaded here to avoid errors
    // The foreign key ID (e.g., authorId) will be in the result
    return result[0];
  } catch (e: any) {
    // Log the database error and re-throw
    console.error(`AdminGen Create Error: ${e.message}`);
    throw new Error(`Failed to create item in ${resourceName}: ${e.message}`);
  }
},
    update: (resourceName: string) => async () => ({
      message: `${resourceName} update handler not implemented.`,
    }),
    delete: (resourceName: string) => async () => ({
      message: `${resourceName} delete handler not implemented.`,
    }),
  };

  return { schemaJson, handlers };
}