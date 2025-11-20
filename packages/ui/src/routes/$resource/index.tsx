import React from 'react'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  sortingFns,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingFn,
} from '@tanstack/react-table'
import {
  compareItems,
  rankItem,
  type RankingInfo,
} from '@tanstack/match-sorter-utils'
import type { AdminField, AdminSchema } from '@blackwaves/admingen-types'
import { Link } from '@tanstack/react-router' // <-- 1. Make sure Link is imported
import { Button } from '@/components/ui/button' // <-- 2. Import your Shadcn button
// This "augments" the module, telling TypeScript about our 'fuzzy' filter
declare module '@tanstack/react-table' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

// Our custom fuzzy filter function
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta?.({ itemRank })
  return itemRank.passed
}

// Our custom fuzzy sort function
const fuzzySort: SortingFn<any> = (rowA, rowB, columnId) => {
  let dir = 0
  if (rowA.columnFiltersMeta[columnId]) {
    dir = compareItems(
      rowA.columnFiltersMeta[columnId]?.itemRank!,
      rowB.columnFiltersMeta[columnId]?.itemRank!,
    )
  }
  return dir === 0 ? sortingFns.alphanumeric(rowA, rowB, columnId) : dir
}

// --- Data Fetching ---
async function fetchAdminSchema(): Promise<AdminSchema> {
  const res = await fetch('/admin/api/_schema')
  if (!res.ok) throw new Error('Failed to fetch admin schema')
  return res.json()
}

async function fetchResourceData(resourceName: string) {
  const res = await fetch(`/admin/api/${resourceName}`)
  if (!res.ok)
    throw new Error(`Failed to fetch resource data for ${resourceName}`)
  return res.json()
}

// --- Main Page Component ---
export const Route = createFileRoute('/$resource/')({
  component: ResourceListComponent,
})

function ResourceListComponent() {
  const { resource: resourceName } = useParams({ from: '/$resource/' })
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [globalFilter, setGlobalFilter] = React.useState('')

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['adminSchema'],
    queryFn: fetchAdminSchema,
    staleTime: 60000,
  })

  const { data: resourceData, isLoading: dataLoading } = useQuery({
    queryKey: ['resourceData', resourceName],
    queryFn: () => fetchResourceData(resourceName),
    enabled: !!resourceName,
  })

  const resource = React.useMemo(() => {
    if (!schema || !schema.resources || !resourceName) return undefined
    return schema.resources.find((r) => r.name === resourceName)
  }, [schema, resourceName])

  const columns = React.useMemo<ColumnDef<any>[]>(() => {
    if (!resource || !resource.fields) return []
    
    const cols = resource.fields.map((field) => {
      const baseColumn = {
        accessorKey: field.name,
        header: () => <span>{field.label}</span>,
        filterFn: 'fuzzy' as const,
        sortingFn: fuzzySort,
      };

      // Handle relationship fields
      if (field.type === 'relationship') {
        return {
          ...baseColumn,
          cell: (info: any) => {
            const value = info.getValue();
            
            // If the API did its job, 'value' is an OBJECT { id: 1, email: '...' }
            if (value && typeof value === 'object') {
              // Try to find a displayable field
              return value.email || value.name || value.title || value.username || value.id;
            }
            
            // Fallback: it might still be an ID if the join failed
            return value || '-';
          },
        };
      }

      // Regular field
      return {
        ...baseColumn,
        cell: (info: any) => info.getValue(),
      };
    })

    // Add Actions Column
    const actionsColumn: ColumnDef<any> = {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const id = row.original.id;
        return (
          <div className="flex items-center gap-2">
            <Link 
              to="/$resource/$id" 
              params={{ resource: resourceName, id: String(id) }}
              className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 border border-blue-600/50 rounded hover:bg-blue-600/30 transition-colors"
            >
              Edit
            </Link>
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to delete this item?')) {
                  try {
                    const res = await fetch(`/admin/api/${resourceName}/${id}`, {
                      method: 'DELETE',
                    });
                    if (!res.ok) throw new Error('Failed to delete');
                    // Invalidate queries to refresh the list
                    // We need access to queryClient here, but we are inside useMemo.
                    // A better way is to pass a callback or use a component for the cell.
                    // For simplicity in this "headless" setup, we might need a slight refactor
                    // or just force a reload (bad UX).
                    // Let's use a hack for now or refactor to a component.
                    // Actually, let's just reload the window for the MVP or assume the user will refresh.
                    // WAIT, we can use `window.location.reload()` as a crude fallback, 
                    // but better is to use a proper mutation in a component.
                    // Let's make the cell a component below.
                    window.location.reload(); 
                  } catch (e) {
                    alert('Error deleting item');
                  }
                }
              }}
              className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-600/50 rounded hover:bg-red-600/30 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        );
      },
    };

    return [...cols, actionsColumn];
  }, [resource, resourceName])

  // --- INFINITE LOOP FIX ---
  // We must memoize the data and filterFns objects so they aren't
  // recreated on every render, which causes the loop.
  const data = React.useMemo(() => resourceData ?? [], [resourceData])
  const filterFns = React.useMemo(() => ({ fuzzy: fuzzyFilter }), [])
  // --- END FIX ---

  const table = useReactTable({
    data: data, // Use memoized data
    columns,
    filterFns: filterFns, // Use memoized filterFns
    state: {
      columnFilters,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'fuzzy',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    debugTable: import.meta.env.DEV,
  })

  if (schemaLoading) {
    return <div>Loading resource configuration...</div>
  }

  if (!resource) {
    return <div className="text-red-500">Resource configuration not found.</div>
  }

  // ...existing code...
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-900/90 to-gray-900 p-6 selection:bg-[#00eaff]/30 selection:text-white antialiased">
      <div className="max-w-5xl mx-auto">
        <div className="relative rounded-2xl p-8 bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
          <div
            id="middleDiv"
            className="absolute -top-1 left-6 right-6 h-1 rounded-full bg-linear-to-r from-transparent via-[#00eaff] to-transparent blur-sm"
            aria-hidden
          />

          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-tr from-gray-200 to-blue-300">
                {resource.label}
              </h1>
              <p className="mt-1 text-sm text-gray-300 max-w-xl">
                Manage {resource.label.toLowerCase()}. Use the actions to
                create, export, or filter records.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/$resource/create" params={{ resource: resourceName }}>
                <Button className="cursor-pointer transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400">
                  Create
                </Button>
              </Link>

              <button
                type="button"
                className="cursor-pointer px-3 py-2 bg-gray-800 text-sm text-gray-200 rounded-md hover:bg-gray-700/90 active:scale-95 transform transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => {
                  const payload = JSON.stringify(resourceData ?? [], null, 2)
                  const blob = new Blob([payload], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${resourceName}-export.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                aria-label={`Export ${resource.label}`}
              >
                Export
              </button>
            </div>
          </header>

          <div className="mb-4">
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={(value) => setGlobalFilter(String(value))}
              className="w-full md:w-72 p-3 bg-gray-800 text-gray-100 rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-400 outline-none transition"
              placeholder="Search all columns..."
              aria-label={`Search ${resource.label}`}
            />
          </div>

          <div className="rounded-lg overflow-hidden border border-gray-700 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-200">
                <thead className="bg-gray-800 text-gray-100 sticky top-0">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          className="px-4 py-3 text-left align-middle"
                        >
                          {header.isPlaceholder ? null : (
                            <>
                              <div
                                {...{
                                  className: header.column.getCanSort()
                                    ? 'cursor-pointer select-none hover:text-blue-300 transition-colors'
                                    : '',
                                  onClick:
                                    header.column.getToggleSortingHandler(),
                                }}
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                                {{
                                  asc: ' 🔼',
                                  desc: ' 🔽',
                                }[header.column.getIsSorted() as string] ??
                                  null}
                              </div>
                              {header.column.getCanFilter() ? (
                                <div className="mt-2">
                                  <Filter column={header.column} />
                                </div>
                              ) : null}
                            </>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody className="bg-transparent divide-y divide-gray-700">
                  {dataLoading ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="h-28 text-center text-gray-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-800/40 transition-colors cursor-default"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 align-top">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="h-28 text-center text-gray-400"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <svg
                            className="w-12 h-12 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.5"
                              d="M9 12l2 2 4-4m1-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            ></path>
                          </svg>
                          <div className="text-sm">No records found.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-gray-200">
            <div className="flex items-center gap-2">
              <button
                className="cursor-pointer px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700/90 active:scale-95 transform transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label="First page"
              >
                {'<<'}
              </button>
              <button
                className="cursor-pointer px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700/90 active:scale-95 transform transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                {'<'}
              </button>
              <button
                className="cursor-pointer px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700/90 active:scale-95 transform transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                {'>'}
              </button>
              <button
                className="cursor-pointer px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700/90 active:scale-95 transform transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label="Last page"
              >
                {'>>'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm">
                Page{' '}
                <strong>{table.getState().pagination.pageIndex + 1}</strong> of{' '}
                <strong>{table.getPageCount()}</strong>
              </span>

              <label className="flex items-center gap-2 text-sm">
                Go to
                <input
                  type="number"
                  min={1}
                  max={table.getPageCount()}
                  defaultValue={table.getState().pagination.pageIndex + 1}
                  onChange={(e) => {
                    const page = e.target.value ? Number(e.target.value) - 1 : 0
                    table.setPageIndex(page)
                  }}
                  className="w-16 px-2 py-1 bg-gray-800 rounded-md border border-gray-700 outline-none focus:ring-2 focus:ring-blue-400"
                  aria-label="Go to page"
                />
              </label>

              <div className="relative">
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value))
                  }}
                  className="appearance-none px-3 py-1 bg-gray-800 rounded-md border border-gray-700 pr-8 text-sm cursor-pointer focus:ring-2 focus:ring-blue-400 outline-none"
                  aria-label="Rows per page"
                >
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      Show {pageSize}
                    </option>
                  ))}
                </select>

                <svg
                  className="pointer-events-none absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
// ...existing code...
// --- Helper Components ---

function Filter({ column }: { column: Column<any, unknown> }) {
  const columnFilterValue = column.getFilterValue()
  return (
    <DebouncedInput
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={(value) => column.setFilterValue(value)}
      placeholder={`Filter...`}
      className="w-full px-2 py-1 bg-gray-800 text-gray-100 rounded-md border border-gray-700 outline-none"
      aria-label="Column filter"
    />
  )
}

function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  const [value, setValue] = React.useState(initialValue)

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)
    return () => clearTimeout(timeout)
  }, [value, onChange, debounce])

  return (
    <input
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={props.className}
    />
  )
}
