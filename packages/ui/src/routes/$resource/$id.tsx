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
async function fetchAdminSchema(): Promise<AdminSchema> {
  const res = await fetch('/admin/api/_schema')
  if (!res.ok) throw new Error('Failed to fetch admin schema')
  return res.json()
}

async function fetchResourceItem(resourceName: string, id: string) {
  const res = await fetch(`/admin/api/${resourceName}/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch ${resourceName} item ${id}`)
  return res.json()
}

// --- Route Definition ---
export const Route = createFileRoute('/$resource/$id')({
  component: EditComponent,
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
  const targetResource = field.relationTo

  const { data: relatedData = [], isLoading } = useQuery({
    queryKey: ['relatedResource', targetResource],
    queryFn: async () => {
      if (!targetResource) return []
      const res = await fetch(`/admin/api/${targetResource}`)
      if (!res.ok) throw new Error(`Failed to fetch ${targetResource}`)
      return res.json()
    },
    enabled: !!targetResource,
    staleTime: 60000,
  })

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldApi.name} className="capitalize">
        {field.label}
      </Label>
      <Select
        value={fieldApi.state.value ? String(fieldApi.state.value) : ''}
        onValueChange={(value) => {
          const numValue = !isNaN(Number(value)) ? Number(value) : value
          fieldApi.handleChange(numValue)
        }}
        disabled={isLoading}
      >
        <SelectTrigger id={fieldApi.name} className="w-full bg-[#111827] text-white border-gray-700">
          <SelectValue
            placeholder={isLoading ? 'Loading...' : `Select ${field.label}`}
          />
        </SelectTrigger>
        <SelectContent>
          {Array.isArray(relatedData) && relatedData.map((item: any) => {
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
function EditComponent() {
  const { resource: resourceName, id } = useParams({ from: '/$resource/$id' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['adminSchema'],
    queryFn: fetchAdminSchema,
    staleTime: 60000,
  })

  const { data: itemData, isLoading: itemLoading } = useQuery({
    queryKey: ['resourceItem', resourceName, id],
    queryFn: () => fetchResourceItem(resourceName, id),
    enabled: !!resourceName && !!id,
  })

  const resource = React.useMemo(
    () => schema?.resources.find((r) => r.name === resourceName),
    [schema, resourceName],
  )

  const fields = React.useMemo(
    () => resource?.fields.filter((f) => !f.isId) ?? [],
    [resource],
  )

  // Helper to get display value for related items
  const getRelatedItemLabel = (item: any): string => {
    if (!item) return ''
    return (
      item.name || item.email || item.title || item.username || item.id || JSON.stringify(item)
    )
  }

  // 3. Setup the API Mutation
  const { mutate, isPending: isMutating } = useMutation({
    mutationFn: async (newData: any) => {
      const res = await fetch(`/admin/api/${resourceName}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newData),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to update ${resourceName}`)
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['resourceData', resourceName],
      })
      queryClient.invalidateQueries({
        queryKey: ['resourceItem', resourceName, id],
      })
      navigate({ to: '/$resource', params: { resource: resourceName } })
    },
    onError: (err) => {
      alert(`Error: ${err.message}`)
    },
  })

  // 4. Setup TanStack Form
  const form = useForm({
    defaultValues: React.useMemo(() => {
      if (!itemData) return {}
      const defaults: Record<string, any> = {}
      fields.forEach((field: AdminField) => {
        if (itemData[field.name] !== undefined) {
            // Handle relationship objects by extracting ID if needed
            if (field.type === 'relationship' && typeof itemData[field.name] === 'object' && itemData[field.name] !== null) {
                 // Try to find the foreign key value if available, or ID from the object
                 // Ideally the API returns the ID in the foreign key field, but let's be safe
                 // If the API returns { author: { id: 1, name: '...' } }, we want 1.
                 defaults[field.name] = itemData[field.name].id;
            } else {
                defaults[field.name] = itemData[field.name]
            }
        } else {
             if (field.type === 'relationship') {
                defaults[field.name] = undefined
              } else if (field.type === 'number') {
                defaults[field.name] = 0
              } else {
                defaults[field.name] = ''
              }
        }
      })
      return defaults
    }, [fields, itemData]),
    onSubmit: async ({ value }) => {
      mutate(value)
    },
  })

  if (schemaLoading || itemLoading) return <div className="p-6">Loading...</div>
  if (!resource) return <div className="p-6 text-red-500">Resource not found.</div>

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <h1 className="text-3xl font-bold mb-8 capitalize text-white">
        Edit {resource.label}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="space-y-6"
      >
        {fields.map((field: AdminField) => (
          <form.Field
            key={field.name}
            name={field.name}
            children={(fieldApi) => {
              
              if (field.type === 'relationship' && field.relationTo) {
                return (
                  <RelationshipField
                    field={field}
                    fieldApi={fieldApi}
                    getRelatedItemLabel={getRelatedItemLabel}
                  />
                )
              }

              // RENDER REGULAR FIELDS
              return (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={fieldApi.name} className="capitalize">
                    {field.label}
                  </Label>
                  {field.type === 'textarea' ? (
                     <textarea
                        id={fieldApi.name}
                        name={fieldApi.name}
                        placeholder={`Enter ${field.label}`}
                        className="bg-[#111827] text-white border border-gray-700 rounded-md px-3 py-2 min-h-[100px]"
                        value={fieldApi.state.value as string}
                        onBlur={fieldApi.handleBlur}
                        onChange={(e) => fieldApi.handleChange(e.target.value)}
                     />
                  ) : (
                    <Input
                      id={fieldApi.name}
                      name={fieldApi.name}
                      placeholder={`Enter ${field.label}`}
                      className="
                        bg-[#111827] text-white border border-gray-700 
                        rounded-md px-3 py-2 shadow-sm
                        placeholder-gray-400 placeholder-opacity-70
                        focus:outline-none focus:ring-2 focus:ring-[#00eaff] focus:border-[#00eaff] 
                        transition-colors duration-200 selection:bg-[#00eaff] selection:text-black
                      "
                      value={fieldApi.state.value ?? ''}
                      onBlur={fieldApi.handleBlur}
                      onChange={(e) => {
                        const val = e.target.value
                        fieldApi.handleChange(
                          field.type === 'number'
                            ? val === '' ? '' : Number(val)
                            : val,
                        )
                      }}
                      type={field.type === 'number' ? 'number' : 'text'}
                    />
                  )}
                </div>
              )
            }}
          />
        ))}

        <div className="pt-4">
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
                  transition-all duration-200 cursor-pointer
                  ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}
                `}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          />
        </div>
      </form>
    </div>
  )
}
