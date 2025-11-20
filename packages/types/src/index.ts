// packages/types/src/index.ts

// 1. The Field Definition
export interface AdminField {
  name: string;
  label?: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'relationship';
  isId?: boolean;
  // For relationships
  relationTo?: string; // e.g. "users"
  foreignKey?: string; // e.g. "authorId"
}

// 2. The Resource Definition
export interface AdminResourceConfig {
  slug: string; // e.g. "posts"
  label?: string;
  table: any; // The Drizzle table object
  fields: AdminField[];
}

// 3. The Master Config
export interface AdminConfig {
  resources: AdminResourceConfig[];
}

// ... (Keep your existing AdminSchema, AdminHandlers, AdapterResult interfaces)
export interface AdminSchema {
  resources: {
    name: string;
    label: string;
    fields: AdminField[];
  }[];
}

export interface AdminHandlers {
    findMany: (resource: string) => any;
    findOne: (resource: string) => any;
    create: (resource: string) => any;
    update: (resource: string) => any;
    delete: (resource: string) => any;
}

export interface AdapterResult {
    schemaJson: AdminSchema;
    handlers: AdminHandlers;
}