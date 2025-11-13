import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import type { AdapterResult } from '@blackwaves/admingen-types';
import { join } from 'path';

export interface AdminGenOptions {
  adapterResult: AdapterResult;
  adminPath?: string;
  beforeHandle?: (context: any) => any;
}

export const AdminGen = ({ 
    adapterResult, 
    adminPath = '/admin', 
    beforeHandle
}: AdminGenOptions) => {

    const uiAssetsPath = join(import.meta.dirname, '..', '..', 'ui-assets');
    const app = new Elysia({ prefix: adminPath });

    if (beforeHandle) {
        app.onBeforeHandle((ctx) => beforeHandle(ctx));
    }

    // --- NEW BUILD ORDER ---

    // 1. Register the API FIRST
    // This is critical. API routes must be defined *before*
    // the static fallback.
    app.group('/api', (api) => {
        const { schemaJson, handlers } = adapterResult;
        api.get('/_schema', () => schemaJson);

        for (const resource of schemaJson.resources) {
            const resourceName = resource.name;
            api.get(`/${resourceName}`, handlers.findMany(resourceName));
            api.get(`/${resourceName}/:id`, handlers.findOne(resourceName));
            api.post(`/${resourceName}`, handlers.create(resourceName));
            api.patch(`/${resourceName}/:id`, handlers.update(resourceName));
            api.delete(`/${resourceName}/:id`, handlers.delete(resourceName));
        }
        return api;
    });

    // 2. REGISTER THE STATIC UI SECOND.
    // This one plugin will now do everything:
    // - Serve static files from /ui-assets (e.g., /admin/assets/index.js)
    // - Serve the index.html as a fallback for all SPA routes (like /admin or /admin/posts)
    app.use(
        staticPlugin({
            assets: uiAssetsPath,
            prefix: '/', // Serve from the root of the /admin prefix
            
            // This is the magic "SPA mode" setting
            indexHTML: true, 
        })
    );
    
    // --- END NEW LOGIC ---

    return app;
}