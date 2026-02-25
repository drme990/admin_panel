import { ReactNode } from 'react';
import Loading from '@/components/ui/loading';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T, index?: number) => ReactNode);
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export default function Table<T extends { _id?: string }>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found',
  onRowClick,
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="bg-card-bg border border-stroke rounded-site overflow-hidden">
        <Loading size="md" text="Loading..." className="h-64" />
      </div>
    );
  }

  return (
    <div className="bg-card-bg border border-stroke rounded-site overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background border-b border-stroke">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`text-start px-4 py-3 text-sm font-semibold ${
                    column.className || ''
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  <p className="text-secondary">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row._id || rowIndex}
                  className={`hover:bg-background transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-4 py-3 text-start ${column.className || ''}`}
                    >
                      {typeof column.accessor === 'function'
                        ? column.accessor(row, rowIndex)
                        : String(row[column.accessor] || '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
