import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState
} from '@tanstack/react-table';
import { ArrowUpDown, Download, Eye, Search } from 'lucide-react';
import { Node, Edge } from 'reactflow';
import { saveAs } from 'file-saver';

interface LineageTableProps {
  nodes: Node[];
  edges: Edge[];
  columnLineages: any[];
  onFocusNode: (nodeId: string) => void;
  onSwitchToGraph: () => void;
}

interface LineageRow {
  id: string;
  sourceModel: string;
  sourceModelType: string;
  sourceColumn: string;
  targetModel: string;
  targetModelType: string;
  targetColumn: string;
  confidence: number;
  transformationType: string;
}

const columnHelper = createColumnHelper<LineageRow>();

export default function LineageTable({
  nodes,
  edges,
  columnLineages,
  onFocusNode,
  onSwitchToGraph
}: LineageTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Transform data for table
  const tableData = useMemo(() => {
    return columnLineages.map((lineage) => {
      const sourceNode = nodes.find(n => n.id === lineage.source_object_id);
      const targetNode = nodes.find(n => n.id === lineage.target_object_id);

      return {
        id: `${lineage.source_object_id}-${lineage.source_column}-${lineage.target_object_id}-${lineage.target_column}`,
        sourceModel: sourceNode?.data.name || 'Unknown',
        sourceModelType: sourceNode?.data.type || 'unknown',
        sourceColumn: lineage.source_column,
        targetModel: targetNode?.data.name || 'Unknown',
        targetModelType: targetNode?.data.type || 'unknown',
        targetColumn: lineage.target_column,
        confidence: lineage.confidence,
        transformationType: lineage.transformation_type || 'direct'
      };
    });
  }, [columnLineages, nodes]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('sourceModel', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold"
          >
            Source Model
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => (
          <div>
            <div className="font-medium text-gray-900">{info.getValue()}</div>
            <div className="text-xs text-gray-500">{info.row.original.sourceModelType}</div>
          </div>
        )
      }),
      columnHelper.accessor('sourceColumn', {
        header: 'Source Column',
        cell: info => (
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {info.getValue()}
          </code>
        )
      }),
      columnHelper.display({
        id: 'arrow',
        header: '',
        cell: () => (
          <div className="text-gray-400 text-center">→</div>
        )
      }),
      columnHelper.accessor('targetModel', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold"
          >
            Target Model
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => (
          <div>
            <div className="font-medium text-gray-900">{info.getValue()}</div>
            <div className="text-xs text-gray-500">{info.row.original.targetModelType}</div>
          </div>
        )
      }),
      columnHelper.accessor('targetColumn', {
        header: 'Target Column',
        cell: info => (
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
            {info.getValue()}
          </code>
        )
      }),
      columnHelper.accessor('confidence', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 font-semibold"
          >
            Confidence
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: info => {
          const confidence = info.getValue();
          const percentage = Math.round(confidence * 100);
          let colorClass = 'bg-green-500';
          if (confidence < 0.95) colorClass = 'bg-blue-500';
          if (confidence < 0.90) colorClass = 'bg-orange-500';
          if (confidence < 0.85) colorClass = 'bg-red-500';

          return (
            <span className={`${colorClass} text-white text-xs px-2 py-1 rounded font-medium`}>
              {percentage}%
            </span>
          );
        }
      }),
      columnHelper.accessor('transformationType', {
        header: 'Type',
        cell: info => (
          <span className="text-xs text-gray-600 capitalize">
            {info.getValue()}
          </span>
        )
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: info => (
          <button
            onClick={() => {
              onSwitchToGraph();
              // Focus on target node
              const targetNodeId = columnLineages.find(
                l => `${l.source_object_id}-${l.source_column}-${l.target_object_id}-${l.target_column}` === info.row.original.id
              )?.target_object_id;
              if (targetNodeId) {
                setTimeout(() => onFocusNode(targetNodeId), 100);
              }
            }}
            className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            View
          </button>
        )
      })
    ],
    [columnLineages, onFocusNode, onSwitchToGraph]
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50
      }
    }
  });

  const exportToCsv = () => {
    const headers = ['Source Model', 'Source Column', 'Target Model', 'Target Column', 'Confidence', 'Type'];
    const rows = tableData.map(row => [
      row.sourceModel,
      row.sourceColumn,
      row.targetModel,
      row.targetColumn,
      `${Math.round(row.confidence * 100)}%`,
      row.transformationType
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, `column-lineage-${Date.now()}.csv`);
  };

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Column Lineage</h3>
            <p className="text-sm text-gray-600">
              {tableData.length} column relationships
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Export CSV */}
            <button
              onClick={exportToCsv}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No column lineage found
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            tableData.length
          )}{' '}
          of {tableData.length} results
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
