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
  type SortingFn
} from '@tanstack/react-table'
import { compareItems, rankItem, type RankingInfo } from '@tanstack/match-sorter-utils'
import type { AdminField, AdminSchema } from '@admingen/types'

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
      rowB.columnFiltersMeta[columnId]?.itemRank!
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
  if (!res.ok) throw new Error(`Failed to fetch resource data for ${resourceName}`)
  return res.json()
}

// --- Main Page Component ---
export const Route = createFileRoute('/$resource')({
  component: ResourceListComponent,
})

function ResourceListComponent() {
  const { resource: resourceName } = useParams({ from: '/$resource' })
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
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
    if (!resource || !Array.isArray(resource.fields)) return []
    return resource.fields.map((field: AdminField) => ({
      accessorKey: field.name,
      header: () => <span>{field.label}</span>,
      cell: (info) => info.getValue(),
      filterFn: 'fuzzy',
      sortingFn: fuzzySort,
    }))
  }, [resource])

  // --- INFINITE LOOP FIX ---
  // We must memoize the data and filterFns objects so they aren't
  // recreated on every render, which causes the loop.
  const data = React.useMemo(() => resourceData ?? [], [resourceData]);
  const filterFns = React.useMemo(() => ({ fuzzy: fuzzyFilter }), []);
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

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold capitalize text-white">{resource.label}</h1>
        {/* TODO: Add "Create New" button here */}
      </div>

      <div>
        <DebouncedInput
          value={globalFilter ?? ''}
          onChange={(value) => setGlobalFilter(String(value))}
          className="w-full p-3 mb-4 bg-gray-800 text-white rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="Search all columns..."
        />
      </div>
      <div className="h-4" />
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm text-gray-200">
          <thead className="bg-gray-800 text-gray-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="px-4 py-3 text-left"
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          {...{
                            className: header.column.getCanSort()
                              ? 'cursor-pointer select-none hover:text-blue-400 transition-colors'
                              : '',
                            onClick: header.column.getToggleSortingHandler(),
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: ' 🔼',
                            desc: ' 🔽',
                          }[header.column.getIsSorted() as string] ?? null}
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
          <tbody className="divide-y divide-gray-700">
            {dataLoading ? (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-gray-400">
                  Loading data...
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-800 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-gray-400">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="h-4" />
      <div className="flex flex-wrap items-center gap-2 text-gray-200">
        <button
          className="px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          {'<<'}
        </button>
        <button
          className="px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          {'<'}
        </button>
        <button
          className="px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          {'>'}
        </button>
        <button
          className="px-3 py-1 bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
        >
          {'>>'}
        </button>
        <span className="flex items-center gap-1">
          <div>Page</div>
          <strong>
            {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </strong>
        </span>
        <span className="flex items-center gap-1">
          | Go to page:
          <input
            type="number"
            defaultValue={table.getState().pagination.pageIndex + 1}
            onChange={(e) => {
              const page = e.target.value ? Number(e.target.value) - 1 : 0
              table.setPageIndex(page)
            }}
            className="w-16 px-2 py-1 bg-gray-800 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </span>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value))
          }}
          className="px-2 py-1 bg-gray-800 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          {[10, 20, 30, 40, 50].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
      {/* <div className="mt-4 text-gray-400">
        {table.getPrePaginationRowModel().rows.length} Rows
      </div> */}
      {/* <div className="mt-4">
        <pre className="mt-4 p-4 bg-gray-800 rounded-lg text-gray-300 overflow-auto">
          {JSON.stringify(
            {
              columnFilters: table.getState().columnFilters,
              globalFilter: table.getState().globalFilter,
            },
            null,
            2,
          )}
        </pre>
      </div> */}
    </div>
  )
}

// --- Helper Components ---

function Filter({ column }: { column: Column<any, unknown> }) {
  const columnFilterValue = column.getFilterValue()
  return (
    <DebouncedInput
      type="text"
      value={(columnFilterValue ?? '') as string}
      onChange={(value) => column.setFilterValue(value)}
      placeholder={`Search...`}
      className="w-full px-2 py-1 bg-gray-700 text-white rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
    />
  )
}