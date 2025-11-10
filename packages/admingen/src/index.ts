// packages/admingen/src/index.ts
import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import type { AdapterResult } from '@admingen/types';

// This is the correct, decoupled options interface
// This is the OLD interface
// This is the NEW, more flexible interface
export interface AdminGenOptions {
  adapterResult: AdapterResult;
  adminPath?: string;
  uiAssetsPath?: string; // <-- Make this optional (string | undefined)
  beforeHandle?: (context: any) => any;
}

export const AdminGen = ({ 
    adapterResult, 
    adminPath = '/admin', 
    uiAssetsPath,
    beforeHandle
}: AdminGenOptions) => {

    const app = new Elysia({ prefix: adminPath });

    // 1. REGISTER THE AUTH HOOK (if provided)
    // This hook will now *only* run on routes prefixed with '/admin'
    if (beforeHandle) {
        app.onBeforeHandle((ctx) => beforeHandle(ctx));
    }

    // 2. REGISTER THE GENERATED API ROUTES
    app.group('/api', (api) => {
        const { schemaJson, handlers } = adapterResult;
        
        // 2a. Schema Route: Serves the JSON contract to the frontend
        api.get('/_schema', () => schemaJson);

        // 2b. Data Routes: Dynamically register CRUD API endpoints
        for (const resource of schemaJson.resources) {
            const resourceName = resource.name;
            
            // LIST/READ: GET /admin/api/posts
            api.get(`/${resourceName}`, handlers.findMany(resourceName));
            
            // READ ONE: GET /admin/api/posts/:id
            api.get(`/${resourceName}/:id`, handlers.findOne(resourceName));
            
            // CREATE: POST /admin/api/posts
            api.post(`/${resourceName}`, handlers.create(resourceName));

            // UPDATE: PATCH /admin/api/posts/:id
            api.patch(`/${resourceName}/:id`, handlers.update(resourceName));
            
            // DELETE: DELETE /admin/api/posts/:id
            api.delete(`/${resourceName}/:id`, handlers.delete(resourceName));
        }

        return api;
    });

    // 3. SERVE THE UI FRONTEND (The static files)
    if (uiAssetsPath) {
      app.use(
          staticPlugin({
              assets: uiAssetsPath,
              prefix: '/',
              indexHTML: true,
          })
      );
  }
    return app;
}