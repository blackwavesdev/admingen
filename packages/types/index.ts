// packages/types/src/index.ts
export interface AdminField {
    name: string;
    type: 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select';
    isId?: boolean;
    label?: string; 
  }
  
  export interface AdminResource {
    name: string; // The API slug (e.g., "posts")
    label: string; // The human-friendly name (e.g., "Posts")
    fields: AdminField[];
  }
  
  export interface AdminSchema {
    resources: AdminResource[];
  }
  
  // Define the interface for the generated API handlers
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