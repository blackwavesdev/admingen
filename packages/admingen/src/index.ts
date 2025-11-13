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

    // --- CORRECTED ROUTING ORDER ---

    // 1. REGISTER THE API FIRST
    // This is critical. API routes must be defined *before*
    // any static file handlers.
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

    // 2. SERVE THE 'assets' FOLDER
    // This explicitly serves /admin/assets/*
    // It MUST come before the index.html fallback.
    app.use(
        staticPlugin({
            assets: join(uiAssetsPath, 'assets'),
            prefix: '/assets',
            alwaysStatic: true, // Be more aggressive
        })
    );
    
    // 3. SERVE OTHER ROOT STATIC FILES (favicon, etc.)
    app.use(
        staticPlugin({
            assets: uiAssetsPath,
            prefix: '/',
            alwaysStatic: true,
            // Ignore assets folder (already handled) and index.html (our fallback)
            ignorePatterns: [
                join(uiAssetsPath, 'assets', '/*'),
                join(uiAssetsPath, 'index.html')
            ]
        })
    );

    // 4. SERVE THE index.html FALLBACK FOR SPA.
    // This MUST come last.
    // It serves index.html for /admin, /admin/posts, etc.
    app.get('/*', async ({ set }) => {
         const htmlFile = Bun.file(join(uiAssetsPath, 'index.html'));
         if (await htmlFile.exists()) {
             set.headers['Content-Type'] = 'text/html; charset=utf-8';
             return htmlFile;
         }
         return new Response('Admin UI not found', { status: 404 });
    });
    
    // --- END CORRECTED LOGIC ---

    return app;
}