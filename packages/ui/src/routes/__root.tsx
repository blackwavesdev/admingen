import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { AdminSchema } from '@blackwaves/admingen-types'; // Import our contract

// This is the function that fetches our schema
const fetchAdminSchema = async (): Promise<AdminSchema> => {
  // We use the relative path. Vite's proxy (in vite.config.ts)
  // will forward this to http://localhost:3000
  const res = await fetch('/admin/api/_schema');
  if (!res.ok) {
    throw new Error('Failed to fetch admin schema');
  }
  return res.json();
};

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  // Use TanStack Query to fetch and cache the schema
  const { data: schema, isLoading, error } = useQuery({
    queryKey: ['adminSchema'],
    queryFn: fetchAdminSchema,
  });

  // Log the result to the browser console
  if (schema) {
    console.log('UI successfully fetched schema:', schema);
  }
  if (isLoading) {
    console.log('Loading schema...');
  }
  if (error) {
    console.error('Schema fetch error:', error.message);
  }

  return (
    <>
      <div className="flex">
        {/* --- DYNAMIC SIDEBAR --- */}
        <div className="p-4 bg-gray-100 min-h-screen w-64">
          <Link to="/" className="font-bold text-lg mb-4 block">
            Admin Dashboard
          </Link>
          <nav className="flex flex-col gap-2">
            {/* This is the magic!
              We are dynamically building the sidebar.
            */}
            {isLoading && <div>Loading...</div>}
            {schema?.resources.map((resource) => (
              <Link
                key={resource.name}
                to="/$resource"
                params={{ resource: resource.name }}
                className="[&.active]:font-bold"
              >
                {resource.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </div>
    </>
  );
}