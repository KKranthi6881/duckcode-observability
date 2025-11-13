import React, { useCallback, useEffect, useState, Fragment } from 'react';
import { ReactFlow, Background, Controls, Handle, Position, Panel, useNodesState, useEdgesState, MarkerType, useReactFlow } from '@xyflow/react';
import { ChevronDown, ChevronRight, Key, Link as LinkIcon, Database, Maximize, LayoutGrid, MoveHorizontal, MoveVertical } from 'lucide-react';
import '@xyflow/react/dist/style.css';
// Enhanced node data structure with column relationships
const initialNodes = [{
  id: 'regions',
  type: 'tableNode',
  position: {
    x: 50,
    y: 50
  },
  data: {
    label: 'regions',
    schema: 'dbo',
    type: 'source',
    columns: [{
      id: 'region_id',
      name: 'region_id',
      type: 'INT',
      isPrimaryKey: true
    }, {
      id: 'region_name',
      name: 'region_name',
      type: 'VARCHAR(25)'
    }]
  }
}, {
  id: 'countries',
  type: 'tableNode',
  position: {
    x: 400,
    y: 50
  },
  data: {
    label: 'countries',
    schema: 'dbo',
    type: 'source',
    columns: [{
      id: 'country_id',
      name: 'country_id',
      type: 'CHAR(2)',
      isPrimaryKey: true
    }, {
      id: 'country_name',
      name: 'country_name',
      type: 'VARCHAR(40)'
    }, {
      id: 'region_id',
      name: 'region_id',
      type: 'INT',
      isForeignKey: true
    }]
  }
}, {
  id: 'locations',
  type: 'tableNode',
  position: {
    x: 750,
    y: 50
  },
  data: {
    label: 'locations',
    schema: 'dbo',
    type: 'source',
    columns: [{
      id: 'location_id',
      name: 'location_id',
      type: 'INT',
      isPrimaryKey: true
    }, {
      id: 'street_address',
      name: 'street_address',
      type: 'VARCHAR(40)'
    }, {
      id: 'postal_code',
      name: 'postal_code',
      type: 'VARCHAR(12)'
    }, {
      id: 'city',
      name: 'city',
      type: 'VARCHAR(30)'
    }, {
      id: 'state_province',
      name: 'state_province',
      type: 'VARCHAR(25)'
    }, {
      id: 'country_id',
      name: 'country_id',
      type: 'CHAR(2)',
      isForeignKey: true
    }]
  }
}, {
  id: 'departments',
  type: 'tableNode',
  position: {
    x: 400,
    y: 300
  },
  data: {
    label: 'departments',
    schema: 'dbo',
    type: 'source',
    columns: [{
      id: 'department_id',
      name: 'department_id',
      type: 'INT',
      isPrimaryKey: true
    }, {
      id: 'department_name',
      name: 'department_name',
      type: 'VARCHAR(30)'
    }, {
      id: 'manager_id',
      name: 'manager_id',
      type: 'INT',
      isForeignKey: true
    }, {
      id: 'location_id',
      name: 'location_id',
      type: 'INT',
      isForeignKey: true
    }]
  }
}, {
  id: 'jobs',
  type: 'tableNode',
  position: {
    x: 50,
    y: 300
  },
  data: {
    label: 'jobs',
    schema: 'dbo',
    type: 'source',
    columns: [{
      id: 'job_id',
      name: 'job_id',
      type: 'VARCHAR(10)',
      isPrimaryKey: true
    }, {
      id: 'job_title',
      name: 'job_title',
      type: 'VARCHAR(35)'
    }, {
      id: 'min_salary',
      name: 'min_salary',
      type: 'DECIMAL(8,0)'
    }, {
      id: 'max_salary',
      name: 'max_salary',
      type: 'DECIMAL(8,0)'
    }]
  }
}, {
  id: 'employees',
  type: 'tableNode',
  position: {
    x: 400,
    y: 550
  },
  data: {
    label: 'employees',
    schema: 'dbo',
    type: 'source',
    columns: [{
      id: 'employee_id',
      name: 'employee_id',
      type: 'INT',
      isPrimaryKey: true
    }, {
      id: 'first_name',
      name: 'first_name',
      type: 'VARCHAR(20)'
    }, {
      id: 'last_name',
      name: 'last_name',
      type: 'VARCHAR(25)'
    }, {
      id: 'email',
      name: 'email',
      type: 'VARCHAR(25)'
    }, {
      id: 'phone_number',
      name: 'phone_number',
      type: 'VARCHAR(20)'
    }, {
      id: 'hire_date',
      name: 'hire_date',
      type: 'DATE'
    }, {
      id: 'job_id',
      name: 'job_id',
      type: 'VARCHAR(10)',
      isForeignKey: true
    }, {
      id: 'salary',
      name: 'salary',
      type: 'DECIMAL(8,2)'
    }, {
      id: 'commission_pct',
      name: 'commission_pct',
      type: 'DECIMAL(2,2)'
    }, {
      id: 'manager_id',
      name: 'manager_id',
      type: 'INT',
      isForeignKey: true
    }, {
      id: 'department_id',
      name: 'department_id',
      type: 'INT',
      isForeignKey: true
    }]
  }
}, {
  id: 'job_history',
  type: 'tableNode',
  position: {
    x: 750,
    y: 550
  },
  data: {
    label: 'job_history',
    schema: 'dbo',
    type: 'source',
    columns: [{
      id: 'employee_id',
      name: 'employee_id',
      type: 'INT',
      isPrimaryKey: true,
      isForeignKey: true
    }, {
      id: 'start_date',
      name: 'start_date',
      type: 'DATE',
      isPrimaryKey: true
    }, {
      id: 'end_date',
      name: 'end_date',
      type: 'DATE'
    }, {
      id: 'job_id',
      name: 'job_id',
      type: 'VARCHAR(10)',
      isForeignKey: true
    }, {
      id: 'department_id',
      name: 'department_id',
      type: 'INT',
      isForeignKey: true
    }]
  }
}, {
  id: 'emp_details_view',
  type: 'tableNode',
  position: {
    x: 400,
    y: 800
  },
  data: {
    label: 'emp_details_view',
    schema: 'dbo',
    type: 'view',
    columns: [{
      id: 'employee_id',
      name: 'employee_id',
      type: 'INT'
    }, {
      id: 'job_id',
      name: 'job_id',
      type: 'VARCHAR(10)'
    }, {
      id: 'manager_id',
      name: 'manager_id',
      type: 'INT'
    }, {
      id: 'department_id',
      name: 'department_id',
      type: 'INT'
    }, {
      id: 'location_id',
      name: 'location_id',
      type: 'INT'
    }, {
      id: 'country_id',
      name: 'country_id',
      type: 'CHAR(2)'
    }, {
      id: 'first_name',
      name: 'first_name',
      type: 'VARCHAR(20)'
    }, {
      id: 'last_name',
      name: 'last_name',
      type: 'VARCHAR(25)'
    }, {
      id: 'salary',
      name: 'salary',
      type: 'DECIMAL(8,2)'
    }, {
      id: 'commission_pct',
      name: 'commission_pct',
      type: 'DECIMAL(2,2)'
    }, {
      id: 'department_name',
      name: 'department_name',
      type: 'VARCHAR(30)'
    }, {
      id: 'job_title',
      name: 'job_title',
      type: 'VARCHAR(35)'
    }, {
      id: 'city',
      name: 'city',
      type: 'VARCHAR(30)'
    }, {
      id: 'state_province',
      name: 'state_province',
      type: 'VARCHAR(25)'
    }, {
      id: 'country_name',
      name: 'country_name',
      type: 'VARCHAR(40)'
    }, {
      id: 'region_name',
      name: 'region_name',
      type: 'VARCHAR(25)'
    }]
  }
}];
// Enhanced edges with column-level relationships
const initialEdges = [
// Countries -> Regions
{
  id: 'countries-regions',
  source: 'countries',
  target: 'regions',
  sourceHandle: 'region_id',
  targetHandle: 'region_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'region_id'
  }
},
// Locations -> Countries
{
  id: 'locations-countries',
  source: 'locations',
  target: 'countries',
  sourceHandle: 'country_id',
  targetHandle: 'country_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'country_id'
  }
},
// Departments -> Locations
{
  id: 'departments-locations',
  source: 'departments',
  target: 'locations',
  sourceHandle: 'location_id',
  targetHandle: 'location_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'location_id'
  }
},
// Employees -> Departments
{
  id: 'employees-departments',
  source: 'employees',
  target: 'departments',
  sourceHandle: 'department_id',
  targetHandle: 'department_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'department_id'
  }
},
// Employees -> Jobs
{
  id: 'employees-jobs',
  source: 'employees',
  target: 'jobs',
  sourceHandle: 'job_id',
  targetHandle: 'job_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'job_id'
  }
},
// Employees self-reference (manager)
{
  id: 'employees-self',
  source: 'employees',
  target: 'employees',
  sourceHandle: 'manager_id',
  targetHandle: 'employee_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#F5B72F'
  },
  data: {
    relationship: 'manager_id'
  }
},
// Job History -> Employees
{
  id: 'job-history-employees',
  source: 'job_history',
  target: 'employees',
  sourceHandle: 'employee_id',
  targetHandle: 'employee_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'employee_id'
  }
},
// Job History -> Jobs
{
  id: 'job-history-jobs',
  source: 'job_history',
  target: 'jobs',
  sourceHandle: 'job_id',
  targetHandle: 'job_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'job_id'
  }
},
// Job History -> Departments
{
  id: 'job-history-departments',
  source: 'job_history',
  target: 'departments',
  sourceHandle: 'department_id',
  targetHandle: 'department_id',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#2AB7A9'
  },
  data: {
    relationship: 'department_id'
  }
},
// View relationships
{
  id: 'view-employees',
  source: 'emp_details_view',
  target: 'employees',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#9333EA'
  },
  data: {
    relationship: 'view'
  }
}, {
  id: 'view-departments',
  source: 'emp_details_view',
  target: 'departments',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#9333EA'
  },
  data: {
    relationship: 'view'
  }
}, {
  id: 'view-jobs',
  source: 'emp_details_view',
  target: 'jobs',
  type: 'columnEdge',
  animated: true,
  style: {
    stroke: '#9333EA'
  },
  data: {
    relationship: 'view'
  }
}];
// Custom Table Node component
const TableNode = ({
  data,
  isConnectable
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  return <div className={`min-w-[300px] bg-slate-800 rounded-lg border ${data.highlighted ? 'border-[#2AB7A9] shadow-lg shadow-[#2AB7A9]/10' : 'border-slate-700'} overflow-hidden`}>
      {/* Table Header */}
      <div className="px-4 py-2 bg-slate-700 flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center space-x-2">
          <Database className="h-4 w-4 text-slate-400" />
          <div>
            <div className="text-sm font-medium text-white">{data.label}</div>
            <div className="text-xs text-slate-400">{data.schema}</div>
          </div>
        </div>
        <button className="text-slate-400 hover:text-white">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {/* Always show handles for all columns */}
      {data.columns?.map(column => <Fragment key={column.id}>
          <Handle type="source" position={Position.Right} id={column.id} style={{
        opacity: 0
      }} isConnectable={isConnectable} />
          <Handle type="target" position={Position.Left} id={column.id} style={{
        opacity: 0
      }} isConnectable={isConnectable} />
        </Fragment>)}
      {/* Key columns (always visible) */}
      <div className="px-2 py-1 bg-slate-800">
        {data.columns?.filter(column => column.isPrimaryKey || column.isForeignKey).map(column => <div key={column.id} className="flex items-center px-3 py-2 text-xs hover:bg-slate-700/50 rounded">
              <div className="flex-1 flex items-center space-x-2">
                {column.isPrimaryKey && <Key className="h-3 w-3 text-yellow-400" />}
                {column.isForeignKey && <LinkIcon className="h-3 w-3 text-blue-400" />}
                <span className="text-slate-300">{column.name}</span>
              </div>
              <span className="text-slate-500">{column.type}</span>
            </div>)}
      </div>
      {/* Expanded column list */}
      {isExpanded && <div className="px-2 py-1 bg-slate-800 divide-y divide-slate-700">
          {data.columns?.filter(column => !column.isPrimaryKey && !column.isForeignKey).map(column => <div key={column.id} className={`flex items-center px-3 py-2 text-xs hover:bg-slate-700/50 rounded ${selectedColumn === column.id ? 'bg-slate-700' : ''}`} onClick={() => setSelectedColumn(column.id)}>
                <div className="flex-1">
                  <span className="text-slate-300">{column.name}</span>
                </div>
                <span className="text-slate-500">{column.type}</span>
              </div>)}
        </div>}
    </div>;
};
// Manual layout function (replaces dagre)
const applyManualLayout = (nodes, layout = 'horizontal') => {
  const nodeWidth = 300;
  const nodeHeight = 150;
  const horizontalGap = 350;
  const verticalGap = 200;
  const itemsPerRow = 3;
  return nodes.map((node, index) => {
    let x, y;
    if (layout === 'horizontal') {
      // Horizontal layout (left to right, then down)
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;
      x = col * horizontalGap + 50;
      y = row * verticalGap + 50;
    } else {
      // Vertical layout (top to bottom, then right)
      const col = Math.floor(index / itemsPerRow);
      const row = index % itemsPerRow;
      x = col * horizontalGap + 50;
      y = row * verticalGap + 50;
    }
    return {
      ...node,
      position: {
        x,
        y
      }
    };
  });
};
export function LineageGraph({
  focusedColumn = null,
  onNodeClick
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [layoutDirection, setLayoutDirection] = useState('horizontal');
  const {
    fitView
  } = useReactFlow();
  // Apply layout on mount and layout change
  useEffect(() => {
    try {
      const layoutedNodes = applyManualLayout(nodes, layoutDirection);
      setNodes([...layoutedNodes]);
      // Fit view after a short delay
      setTimeout(() => {
        fitView({
          padding: 0.2
        });
      }, 100);
    } catch (error) {
      console.error('Layout error:', error);
    }
  }, [layoutDirection, fitView]);
  // Update highlighting when focused column changes
  useEffect(() => {
    if (focusedColumn) {
      const updatedNodes = nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          highlighted: node.data.columns?.some(col => col.name === focusedColumn)
        }
      }));
      setNodes(updatedNodes);
      const updatedEdges = edges.map(edge => ({
        ...edge,
        style: {
          ...edge.style,
          stroke: edge.data?.relationship === focusedColumn ? '#2AB7A9' : '#475569',
          strokeWidth: edge.data?.relationship === focusedColumn ? 2 : 1
        }
      }));
      setEdges(updatedEdges);
    }
  }, [focusedColumn, setNodes, setEdges]);
  // Handle layout change
  const changeLayout = useCallback(direction => {
    setLayoutDirection(direction);
  }, []);
  return <div className="w-full h-full">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={{
      tableNode: TableNode
    }} fitView className="bg-background" defaultEdgeOptions={{
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: '#475569'
      },
      markerEnd: {
        type: MarkerType.ArrowClosed
      }
    }}>
        <Background color="#475569" gap={16} />
        <Controls />
        {/* Layout Controls */}
        <Panel position="top-right" className="flex space-x-2">
          <button className={`p-2 rounded ${layoutDirection === 'horizontal' ? 'bg-[#2AB7A9] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`} onClick={() => changeLayout('horizontal')} title="Horizontal Layout">
            <MoveHorizontal className="h-4 w-4" />
          </button>
          <button className={`p-2 rounded ${layoutDirection === 'vertical' ? 'bg-[#2AB7A9] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`} onClick={() => changeLayout('vertical')} title="Vertical Layout">
            <MoveVertical className="h-4 w-4" />
          </button>
          <button onClick={() => fitView({
          padding: 0.2
        })} className="p-2 rounded bg-slate-700 text-slate-300 hover:bg-slate-600" title="Fit View">
            <Maximize className="h-4 w-4" />
          </button>
        </Panel>
        {/* Legend */}
        <Panel position="bottom-left" className="bg-slate-800 p-4 rounded-lg border border-slate-700">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Key className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-slate-300">Primary Key</span>
            </div>
            <div className="flex items-center space-x-2">
              <LinkIcon className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-slate-300">Foreign Key</span>
            </div>
          </div>
          {focusedColumn && <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-slate-700">
              <div className="h-2 w-2 rounded-full bg-[#2AB7A9]" />
              <span className="text-xs text-slate-300">
                Column: {focusedColumn}
              </span>
            </div>}
        </Panel>
      </ReactFlow>
    </div>;
}