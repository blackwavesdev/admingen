import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import "./styles.css"
// Import the generated route tree
import { routeTree } from './routeTree.gen'

// --- THIS IS THE FIX ---
// 1. Create a new QueryClient
const queryClient = new QueryClient()

// 2. Create the router
const router = createRouter({
  routeTree,
  basepath: '/admin',
  // 3. Pass the query client to the router context
  context: {
    queryClient,
  },
})
// --- END FIX ---

// Register the router instance
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
console.log("fromnpm");

// Render the app
const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      {/* 4. Wrap the RouterProvider in the QueryClientProvider */}
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  )
}