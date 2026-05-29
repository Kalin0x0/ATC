import React from 'react'
import { Spinner } from './Spinner'

export interface Column<T> {
  key: string
  label: string
  render?: (value: unknown, row: T) => React.ReactNode
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-[#ffffff0a] animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available.',
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#ffffff0a]">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-[#ffffff0a] bg-[#16213e]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-[#8888aa] font-medium uppercase tracking-wide text-xs whitespace-nowrap select-none"
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  <svg
                    className="w-3 h-3 opacity-40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"
                    />
                  </svg>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-[#8888aa]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={`border-b border-[#ffffff05] transition-colors hover:bg-[#d4af3708] ${
                  rowIdx % 2 === 0 ? 'bg-[#1a1a2e]' : 'bg-[#16213e80]'
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-[#e8e8f0]">
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as React.ReactNode) ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {loading && (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      )}
    </div>
  )
}
