import React from 'react'
import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import type { AdminSchema, AdminField } from '@blackwaves/admingen-types'

// --- Shadcn Components ---
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

// Component for relationship field that can use hooks
function RelationshipField({
  field,
  fieldApi,
  getRelatedItemLabel,
}: {
  field: AdminField
  fieldApi: any
  getRelatedItemLabel: (item: any) => string
}) {
  const { data: relatedData = [], isLoading } = useQuery({
    queryKey: ['relatedResource', field.relatedResource],
    queryFn: async () => {
      if (!field.relatedResource) return []
      const res = await fetch(`/admin/api/${field.relatedResource}`)
      if (!res.ok) throw new Error(`Failed to fetch ${field.relatedResource}`)
      return res.json()
    },
    enabled: !!field.relatedResource,
  })

  return (
    <div className="flex flex-col gap-2 ">
      <Label htmlFor={fieldApi.name} className="capitalize ">
        {field.label}
      </Label>
      <Select
        value={fieldApi.state.value ? String(fieldApi.state.value) : ''}
        onValueChange={(value) => {
          // For manyToOne, store the ID
          const numValue =
            field.relationType === 'manyToOne' ? Number(value) : value
          fieldApi.handleChange(numValue)
        }}
        disabled={isLoading}
      >
        <SelectTrigger id={fieldApi.name} className="w-full">
          <SelectValue
            placeholder={isLoading ? 'Loading...' : `Select ${field.label}`}
          />
        </SelectTrigger>
        <SelectContent>
          {relatedData.map((item: any) => {
            const itemId = item.id
            const itemLabel = getRelatedItemLabel(item)
            return (
              <SelectItem key={itemId} value={String(itemId)}>
                {itemLabel}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}

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
    [schema, resourceName],
  )

  // Filter out the 'id' field, as that's auto-generated
  const fields = React.useMemo(
    () => resource?.fields.filter((f) => !f.isId) ?? [],
    [resource],
  )

  // Fetch related resources for relationship fields
  const relationshipFields = React.useMemo(
    () => fields.filter((f) => f.type === 'relation' && f.relatedResource),
    [fields],
  )

  // Helper to get display value for related items
  const getRelatedItemLabel = (item: any): string => {
    if (!item) return ''
    // Try common fields that might be used for display
    return (
      item.name || item.email || item.title || item.id || JSON.stringify(item)
    )
  }

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
      queryClient.invalidateQueries({
        queryKey: ['resourceData', resourceName],
      })
      // Send the user back to the list page
      navigate({ to: '/$resource', params: { resource: resourceName } })
    },
    onError: (err) => {
      // TODO: Add a real toast notification
      alert(`Error: ${err.message}`)
    },
  })

  // 4. Setup TanStack Form
  const form = useForm({
    // Dynamically create default values from the schema
    defaultValues: React.useMemo(() => {
      const defaults: Record<string, any> = {}
      fields.forEach((field: AdminField) => {
        if (field.type === 'relation') {
          defaults[field.name] = field.foreignKey ? '' : undefined
        } else if (field.type === 'number') {
          defaults[field.name] = 0
        } else {
          defaults[field.name] = ''
        }
      })
      return defaults
    }, [fields]),
    onSubmit: async ({ value }) => {
      // For relationship fields with manyToOne, the field name is the foreign key column
      // So we just send the value as-is. The field name should match the column name.
      mutate(value)
    },
  })

  if (schemaLoading) return <div>Loading form...</div>
  if (!resource) return <div>Resource not found in schema.</div>

  return (
    <div className="w-full py-20 lg:p-0 flex flex-col    mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6  capitalize">
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
            children={(fieldApi) => {
              // Handle relationship fields with select dropdown
              if (field.type === 'relation' && field.relatedResource) {
                return (
                  <RelationshipField
                    field={field}
                    fieldApi={fieldApi}
                    getRelatedItemLabel={getRelatedItemLabel}
                  />
                )
              }

              // Regular fields
              return (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={fieldApi.name} className="capitalize">
                    {field.label}
                  </Label>
                  <Input
                    id={fieldApi.name}
                    name={fieldApi.name}
                    placeholder={`Enter ${field.label}`} // النص اللي جوا الانبوت
                    className="
    bg-[#111827] text-white border border-gray-700 
    rounded-md px-3 py-2 shadow-sm
    placeholder-gray-400 placeholder-opacity-70
    focus:outline-none focus:ring-2 focus:ring-[#00eaff] focus:border-[#00eaff] 
    transition-colors duration-200     selection:bg-[#00eaff] selection:text-black

  "
                    value={fieldApi.state.value ?? ''}
                    onBlur={fieldApi.handleBlur}
                    onChange={(e) => {
                      const val = e.target.value
                      fieldApi.handleChange(
                        field.type === 'number'
                          ? val === ''
                            ? ''
                            : Number(val)
                          : val,
                      )
                    }}
                    type={field.type === 'number' ? 'number' : 'text'}
                  />

                  {/* TODO: Add validation error messages here */}
                </div>
              )
            }}
          />
        ))}

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className={`
    w-full py-2 px-4 rounded-md text-white font-medium 
    bg-[#00eaff]/20 hover:bg-[#00eaff]/40 
    border border-[#00eaff] 
    focus:outline-none focus:ring-2 focus:ring-[#00eaff] focus:ring-offset-1
    transition-all duration-200 cursor-pointer max-w-[100px]
    ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}
  `}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          )}
        />
      </form>
    </div>
  )
}
