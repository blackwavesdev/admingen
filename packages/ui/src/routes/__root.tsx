import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { AdminSchema } from '@blackwaves/admingen-types'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

const fetchAdminSchema = async (): Promise<AdminSchema> => {
  const res = await fetch('/admin/api/_schema')
  if (!res.ok) {
    throw new Error('Failed to fetch admin schema')
  }
  return res.json()
}

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const {
    data: schema,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['adminSchema'],
    queryFn: fetchAdminSchema,
  })

  if (schema) console.log('UI successfully fetched schema:', schema)
  if (isLoading) console.log('Loading schema...')
  if (error) console.error('Schema fetch error:', error.message)

  return (
    <>
      <div className="flex min-h-screen bg-linear-to-br from-[#050505] via-[#0a0a0a] to-[#0f1f3a]">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`fixed top-4 left-4 cursor-pointer z-50 p-2 rounded-md bg-[#1a1a1a] text-white lg:hidden ${
            isSidebarOpen ? 'hidden' : ''
          }`}
          aria-label="Toggle menu"
        >
          {isSidebarOpen ? '' : <Menu size={24} />}
        </button>

        {/* Sidebar */}
        <div
          className={`
            fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out
            bg-linear-to-b from-[#0b0b0b] to-[#1a1a1a] text-white p-4
            lg:relative lg:translate-x-0 lg:z-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="font-bold text-lg">
              Admin Dashboard
            </Link>
            {/* Close button inside sidebar on mobile */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden"
              aria-label="Close menu"
            >
              <X className="cursor-pointer" size={20} />
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            {isLoading && <div className="text-sm">Loading...</div>}
            {schema?.resources.map((resource) => (
              <Link
                key={resource.name}
                to="/$resource"
                params={{ resource: resource.name }}
                onClick={() => setIsSidebarOpen(false)} // Close on click (mobile)
                className="block px-3 py-2 rounded-md transition-all duration-200
                  hover:bg-[#00eaff]/10 hover:text-[#00eaff] 
                  [&.active]:font-bold [&.active]:text-[#00eaff]"
              >
                {resource.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 p-6 pt-0 lg:pt-6 lg:ml-0">
          <Outlet />
        </div>
      </div>
    </>
  )
}
