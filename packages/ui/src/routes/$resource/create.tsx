import React from 'react'
import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import type { AdminSchema, AdminField } from '@blackwaves/admingen-types'

// --- Shadcn Components ---
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

// --- Data Fetching ---
// We can move this to a shared file later
async function fetchAdminSchema(): Promise<AdminSchema> {
  const res = await fetch('/admin/api/_schema')
  if (!res.ok) throw new Error('Failed to fetch admin schema')
  return res.json()
}

// --- Route Definition ---
export const Route = createFileRoute('/$resource/create')({
  component: CreateComponent,
})

// --- Main Component ---
function CreateComponent() {
  const { resource: resourceName } = useParams({ from: '/$resource/create' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 1. Fetch the schema to know what fields to build
  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['adminSchema'],
    queryFn: fetchAdminSchema,
    staleTime: 60000,
  })

  // 2. Find the fields for this *specific* resource
  const resource = React.useMemo(
    () => schema?.resources.find((r) => r.name === resourceName),
    [schema, resourceName]
  )
  
  // Filter out the 'id' field, as that's auto-generated
  const fields = React.useMemo(
    () => resource?.fields.filter((f) => !f.isId) ?? [],
    [resource]
  )

  // 3. Setup the API Mutation
  const { mutate, isPending: isMutating } = useMutation({
    mutationFn: async (newData: any) => {
      const res = await fetch(`/admin/api/${resourceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newData),
      })
      if (!res.ok) {
        throw new Error(`Failed to create ${resourceName}`)
      }
      return res.json()
    },
    onSuccess: () => {
      // Invalidate the cache for the resource list so it refetches
      queryClient.invalidateQueries({ queryKey: ['resourceData', resourceName] })
      // Send the user back to the list page
      navigate({ to: '/$resource', params: { resource: resourceName } })
    },
    onError: (err) => {
      // TODO: Add a real toast notification
      alert(`Error: ${err.message}`)
    }
  })

  // 4. Setup TanStack Form
  const form = useForm({
    // Dynamically create default values from the schema
    defaultValues: React.useMemo(() => {
      const defaults: Record<string, any> = {}
      fields.forEach((field: { name: string | number; type: string }) => {
        defaults[field.name] = field.type === 'number' ? 0 : ''
      })
      return defaults
    }, [fields]),
    onSubmit: async ({ value }) => {
      mutate(value)
    },
  })

  if (schemaLoading) return <div>Loading form...</div>
  if (!resource) return <div>Resource not found in schema.</div>

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 capitalize">
        Create New {resource.label}
      </h1>
      
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="space-y-4"
      >
        {/* 5. Dynamically render a form field for each item in the schema */}
        {fields.map((field: AdminField) => (
          <form.Field
            key={field.name}
            name={field.name}
            children={(fieldApi) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor={fieldApi.name} className="capitalize">
                  {field.label}
                </Label>
                <Input
                  id={fieldApi.name}
                  name={fieldApi.name}
                  value={fieldApi.state.value}
                  onBlur={fieldApi.handleBlur}
                  onChange={(e) => fieldApi.handleChange(e.target.value)}
                  type={field.type === 'number' ? 'number' : 'text'}
                />
                {/* TODO: Add validation error messages here */}
              </div>
            )}
          />
        ))}
        
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          )}
        />
      </form>
    </div>
  )
}