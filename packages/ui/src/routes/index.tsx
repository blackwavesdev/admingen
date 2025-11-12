import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: AdminIndex,
})

function AdminIndex() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome to AdminGen</h1>
      <p className="text-lg text-gray-700">
        Select a resource from the sidebar to get started.
      </p>
    </div>
  )
}