import React, { useState, useEffect } from 'react';
import { Search, Filter, Database, Table, FileText, Tag, Clock, Check, X, Star, Key, ChevronLeft, ChevronRight, Network, Calendar, RefreshCw, Info, Cpu, ArrowRight, GitBranch, Link } from 'lucide-react';
import { lineageModels, createCustomerLineage, createOrderLineage, TableNode, LineageData } from './components/charts/lineageData';

// Last updated time information
const lastUpdatedInfo = {
  'tpch_customers': '2023-07-15T10:30:00Z',
  'tpch_nations': '2023-07-10T08:15:00Z',
  'tpch_regions': '2023-06-28T14:45:00Z',
  'stg_tpch_customers': '2023-07-16T09:20:00Z',
  'stg_tpch_nations': '2023-07-12T11:30:00Z',
  'stg_tpch_regions': '2023-07-02T16:10:00Z',
  'dim_customers': '2023-07-17T08:45:00Z',
  'tpch_orders': '2023-07-18T07:30:00Z',
  'tpch_line_items': '2023-07-18T07:35:00Z',
  'stg_tpch_orders': '2023-07-19T09:15:00Z',
  'stg_tpch_line_items': '2023-07-19T09:20:00Z',
  'fct_order_items': '2023-07-20T10:30:00Z',
};

// Business context/value information
const businessContext = {
  'tpch_customers': 'Source data for customer information. Critical for customer analytics and personalization.',
  'tpch_nations': 'Reference data for geographic segmentation and regional analysis.',
  'tpch_regions': 'High-level geographic grouping for market analysis.',
  'stg_tpch_customers': 'Standardized and cleaned customer data, ready for analytics consumption.',
  'stg_tpch_nations': 'Transformed nation data with standardized attributes.',
  'stg_tpch_regions': 'Cleaned region data ensuring consistency across the platform.',
  'dim_customers': 'Core customer dimension table used by all customer-related analytics. Supports 360-degree customer view.',
  'tpch_orders': 'Source data for all order transactions. Critical for revenue analysis.',
  'tpch_line_items': 'Detailed order line items. Used for product performance and inventory analytics.',
  'stg_tpch_orders': 'Standardized order data with consistent status values and timestamps.',
  'stg_tpch_line_items': 'Transformed line item data with calculated fields like total price.',
  'fct_order_items': 'Core fact table for order analysis. Powers dashboards, KPIs, and financial reporting.',
};

// Sample data for each table
const sampleData = {
  'tpch_customers': [
    { c_custkey: 1001, c_name: 'Customer ABCDE', c_address: '123 Main St', c_nationkey: 1, c_phone: '123-456-7890', c_acctbal: 2500.75, c_mktsegment: 'RETAIL', c_comment: 'Regular customer' },
    { c_custkey: 1002, c_name: 'Customer FGHIJ', c_address: '456 Oak Ave', c_nationkey: 2, c_phone: '234-567-8901', c_acctbal: 12750.42, c_mktsegment: 'MACHINERY', c_comment: 'High-value customer' }
  ],
  'dim_customers': [
    { customer_id: 1001, customer_name: 'Customer ABCDE', address: '123 Main St', nation_id: 1, nation: 'UNITED STATES', region_id: 1, region: 'NORTH AMERICA', phone_number: '123-456-7890', account_balance: 2500.75, market_segment: 'RETAIL' },
    { customer_id: 1002, customer_name: 'Customer FGHIJ', address: '456 Oak Ave', nation_id: 2, nation: 'CANADA', region_id: 1, region: 'NORTH AMERICA', phone_number: '234-567-8901', account_balance: 12750.42, market_segment: 'MACHINERY' }
  ],
  'fct_order_items': [
    { order_item_id: 10001, order_id: 5001, customer_id: 1001, item_id: 7001, order_date: '2023-06-15', quantity: 2, price: 49.99, total: 99.98, status: 'DELIVERED' },
    { order_item_id: 10002, order_id: 5002, customer_id: 1002, item_id: 7005, order_date: '2023-06-20', quantity: 1, price: 199.99, total: 199.99, status: 'SHIPPED' }
  ]
};

// Usage statistics
const usageStats = {
  'tpch_customers': { queries: 542, users: 28, avgQueryTime: '1.2s' },
  'tpch_nations': { queries: 147, users: 15, avgQueryTime: '0.5s' },
  'tpch_regions': { queries: 102, users: 12, avgQueryTime: '0.4s' },
  'stg_tpch_customers': { queries: 328, users: 22, avgQueryTime: '0.9s' },
  'stg_tpch_nations': { queries: 98, users: 10, avgQueryTime: '0.6s' },
  'stg_tpch_regions': { queries: 64, users: 9, avgQueryTime: '0.5s' },
  'dim_customers': { queries: 682, users: 35, avgQueryTime: '1.5s' },
  'tpch_orders': { queries: 487, users: 26, avgQueryTime: '1.8s' },
  'tpch_line_items': { queries: 398, users: 24, avgQueryTime: '2.1s' },
  'stg_tpch_orders': { queries: 241, users: 18, avgQueryTime: '1.1s' },
  'stg_tpch_line_items': { queries: 187, users: 16, avgQueryTime: '1.3s' },
  'fct_order_items': { queries: 745, users: 42, avgQueryTime: '1.9s' },
};

// Quality metrics 
const qualityMetrics = {
  'tpch_customers': { completeness: 99.8, uniqueness: 100, validity: 98.5, freshness: 100 },
  'tpch_nations': { completeness: 100, uniqueness: 100, validity: 100, freshness: 100 },
  'tpch_regions': { completeness: 100, uniqueness: 100, validity: 100, freshness: 100 },
  'stg_tpch_customers': { completeness: 99.9, uniqueness: 100, validity: 99.5, freshness: 100 },
  'stg_tpch_nations': { completeness: 100, uniqueness: 100, validity: 100, freshness: 100 },
  'stg_tpch_regions': { completeness: 100, uniqueness: 100, validity: 100, freshness: 100 },
  'dim_customers': { completeness: 100, uniqueness: 100, validity: 100, freshness: 99.8 },
  'tpch_orders': { completeness: 98.7, uniqueness: 100, validity: 97.9, freshness: 99.5 },
  'tpch_line_items': { completeness: 99.1, uniqueness: 100, validity: 98.2, freshness: 99.5 },
  'stg_tpch_orders': { completeness: 99.5, uniqueness: 100, validity: 99.3, freshness: 99.5 },
  'stg_tpch_line_items': { completeness: 99.6, uniqueness: 100, validity: 99.4, freshness: 99.5 },
  'fct_order_items': { completeness: 99.8, uniqueness: 100, validity: 99.7, freshness: 99.8 },
};

// Get the data type for the specified table
const getLineageDataForTable = (tableId: string): TableNode | null => {
  // Create all lineage data
  const customerLineage = createCustomerLineage();
  const orderLineage = createOrderLineage();
  
  // Combine all nodes
  const allNodes = [...customerLineage.nodes, ...orderLineage.nodes];
  
  // Find the specified table
  return allNodes.find(node => node.id === tableId) || null;
};

// Component to display the table overview
const TableOverview = ({ table }: { table: TableNode }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Description
        </h3>
        <p className="text-gray-600 text-sm">
          {table.data.description}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Business Context
        </h3>
        <p className="text-gray-600 text-sm">
          {businessContext[table.id] || 'No business context available'}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Last Updated
        </h3>
        <p className="text-gray-600 text-sm">
          {new Date(lastUpdatedInfo[table.id] || Date.now()).toLocaleString()}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Quality Score
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {qualityMetrics[table.id] && Object.entries(qualityMetrics[table.id]).map(([metric, score]) => (
            <div key={metric} className="bg-gray-100 p-3 rounded-lg">
              <p className="text-xs text-gray-500 capitalize">{metric}</p>
              <p className="text-lg font-semibold text-gray-800 mt-1">
                {score}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Component to display usage statistics
const UsageInfo = ({ tableId }: { tableId: string }) => {
  const stats = usageStats[tableId];
  
  if (!stats) {
    return <p className="text-gray-600 text-sm">No usage data available</p>;
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-xs text-gray-500">
            Queries (Last 30 Days)
          </p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">
            {stats.queries}
          </p>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-xs text-gray-500">
            Unique Users
          </p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">
            {stats.users}
          </p>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-xs text-gray-500">
            Avg. Query Time
          </p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">
            {stats.avgQueryTime}
          </p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Top Queries
        </h3>
        <div className="bg-gray-100 rounded-lg p-4">
          <pre className="text-xs text-gray-500 whitespace-pre-wrap">
            {`SELECT * FROM ${tableId} WHERE last_update_date > '2023-01-01'`}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            Run {Math.floor(stats.queries * 0.23)} times by {Math.floor(stats.users * 0.4)} users
          </p>
        </div>
      </div>
    </div>
  );
};

// Component to display sample data
const SampleData = ({ tableId, columns }: { tableId: string, columns: any[] }) => {
  const data = sampleData[tableId];
  
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          No sample data available for this table.
        </p>
      </div>
    );
  }
  
  // Get column keys from the first data item
  const columnKeys = Object.keys(data[0]);
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            {columnKeys.map(key => (
              <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-100">
              {columnKeys.map(key => (
                <td key={`${rowIndex}-${key}`} className="px-4 py-3 text-sm text-gray-600">
                  {row[key]?.toString() || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Modified TableLineage component with enhanced relationship details
const TableLineage = ({ tableId }: { tableId: string }) => {
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Determine which lineage model to use based on the table ID
    const isCustomerData = ['tpch_customers', 'tpch_nations', 'tpch_regions', 
                           'stg_tpch_customers', 'stg_tpch_nations', 'stg_tpch_regions', 
                           'dim_customers'].includes(tableId);
    
    const isOrderData = ['tpch_orders', 'tpch_line_items', 
                         'stg_tpch_orders', 'stg_tpch_line_items', 
                         'fct_order_items'].includes(tableId);
    
    // Load the appropriate lineage data
    if (isCustomerData) {
      setLineageData(createCustomerLineage());
    } else if (isOrderData) {
      setLineageData(createOrderLineage());
    }
    
    setIsLoading(false);
  }, [tableId]);
  
  // Filter lineage data to only show tables connected to the selected table
  const getFilteredLineageData = () => {
    if (!lineageData) return { nodes: [], edges: [] };
    
    // Find all connected tables (upstream and downstream)
    const connectedTableIds = new Set<string>([tableId]);
    let prevSize = 0;
    
    // Keep adding connected tables until no new ones are found
    while (prevSize !== connectedTableIds.size) {
      prevSize = connectedTableIds.size;
      
      // Add upstream and downstream tables
      lineageData.edges.forEach(edge => {
        if (connectedTableIds.has(edge.target) && !connectedTableIds.has(edge.source)) {
          connectedTableIds.add(edge.source);
        }
        if (connectedTableIds.has(edge.source) && !connectedTableIds.has(edge.target)) {
          connectedTableIds.add(edge.target);
        }
      });
    }
    
    // Filter nodes and edges
    const filteredNodes = lineageData.nodes.filter(node => connectedTableIds.has(node.id));
    const filteredEdges = lineageData.edges.filter(edge => 
      connectedTableIds.has(edge.source) && connectedTableIds.has(edge.target)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  };
  
  // Get upstream relationships (sources to current table)
  const getUpstreamRelationships = (filteredData) => {
    return filteredData.edges.filter(edge => edge.target === tableId);
  };
  
  // Get downstream relationships (current table to targets)
  const getDownstreamRelationships = (filteredData) => {
    return filteredData.edges.filter(edge => edge.source === tableId);
  };
  
  // Get node by ID
  const getNodeById = (filteredData, nodeId) => {
    return filteredData.nodes.find(node => node.id === nodeId);
  };
  
  // Get node color based on type
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'source':
        return 'bg-blue-900/40 border-blue-700/50 text-blue-400';
      case 'transformation':
        return 'bg-amber-900/40 border-amber-700/50 text-amber-400';
      case 'view':
        return 'bg-purple-900/40 border-purple-700/50 text-purple-400';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };
  
  // Get relationship color
  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case 'Transforms':
        return 'bg-[#2AB7A9]/20 border-[#2AB7A9]/50 text-[#2AB7A9]';
      case 'Joins':
        return 'bg-amber-900/20 border-amber-700/50 text-amber-400';
      case 'References':
        return 'bg-blue-900/20 border-blue-700/50 text-blue-400';
      default:
        return 'bg-slate-800/50 border-slate-700 text-slate-300';
    }
  };
  
  // Get node icon based on type
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'source':
        return <Database className="h-5 w-5 text-blue-400" />;
      case 'view':
        return <FileText className="h-5 w-5 text-purple-400" />;
      default:
        return <Table className="h-5 w-5 text-amber-400" />;
    }
  };
  
  // Get relationship icon
  const getRelationshipIcon = (relationship: string) => {
    switch (relationship) {
      case 'Transforms':
        return <RefreshCw className="h-5 w-5 text-[#2AB7A9]" />;
      case 'Joins':
        return <GitBranch className="h-5 w-5 text-amber-400" />;
      case 'References':
        return <Link className="h-5 w-5 text-blue-400" />;
      default:
        return <ArrowRight className="h-5 w-5 text-slate-400" />;
    }
  };
  
  if (isLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-slate-700/30 rounded-lg border border-slate-600">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 text-slate-400 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-white">
            Loading Lineage Data...
          </h3>
        </div>
      </div>
    );
  }
  
  if (!lineageData) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-slate-700/30 rounded-lg border border-slate-600">
        <div className="text-center max-w-md p-6">
          <Network className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Lineage Data Available
          </h3>
          <p className="text-sm text-slate-400">
            We couldn't find lineage information for {tableId}.
            This table may not have any upstream or downstream dependencies.
          </p>
        </div>
      </div>
    );
  }
  
  const filteredData = getFilteredLineageData();
  
  if (filteredData.edges.length === 0) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-slate-700/30 rounded-lg border border-slate-600">
        <div className="text-center max-w-md p-6">
          <Network className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Relationships Found
          </h3>
          <p className="text-sm text-slate-400">
            {tableId} doesn't appear to have any relationships with other tables in our lineage data.
          </p>
        </div>
      </div>
    );
  }
  
  const upstreamRelationships = getUpstreamRelationships(filteredData);
  const downstreamRelationships = getDownstreamRelationships(filteredData);
  const currentTable = filteredData.nodes.find(node => node.id === tableId);
  
  return (
    <div className="h-[600px] bg-slate-800 rounded-lg border border-slate-700 overflow-auto p-6">
      <div className="flex flex-col h-full">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-white mb-2">Table Lineage & Relationships</h3>
          <p className="text-sm text-slate-400">
            Showing data flow and relationships for <span className="text-[#2AB7A9] font-medium">{tableId}</span>
          </p>
        </div>
        
        <div className="flex-grow flex flex-col space-y-8">
          {/* Upstream Relationships */}
          {upstreamRelationships.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white mb-3">Upstream Relationships (Data Sources)</h4>
              <div className="space-y-4">
                {upstreamRelationships.map(relationship => {
                  const sourceTable = getNodeById(filteredData, relationship.source);
                  
                  return (
                    <div key={relationship.id} className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className={`p-3 rounded-lg ${getNodeColor(sourceTable.data.type)} mr-4`}>
                          {getNodeIcon(sourceTable.data.type)}
                        </div>
                        
                        <div className="flex-grow">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-white">{sourceTable.data.label}</h5>
                            <span className={`px-2 py-1 rounded text-xs ${getRelationshipColor(relationship.data.relationship)}`}>
                              {relationship.data.relationship}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-400 mt-1">{sourceTable.data.description || 'No description available'}</p>
                          
                          {/* Relationship details */}
                          <div className="mt-3 p-3 rounded bg-slate-800/50 border border-slate-600">
                            <div className="flex items-start">
                              {getRelationshipIcon(relationship.data.relationship)}
                              <div className="ml-3">
                                <p className="text-xs text-slate-300">{relationship.data.description || `${relationship.source} → ${relationship.target}`}</p>
                                
                                {/* Show columns involved in the relationship */}
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">Source Columns:</p>
                                    <div className="space-y-1">
                                      {sourceTable.data.columns
                                        .filter(col => col.isPrimaryKey || col.isForeignKey)
                                        .map(col => (
                                          <div key={col.id} className="flex items-center">
                                            {col.isPrimaryKey ? (
                                              <Key className="h-3 w-3 text-amber-400 mr-1" />
                                            ) : (
                                              <Link className="h-3 w-3 text-blue-400 mr-1" />
                                            )}
                                            <span className="text-xs text-slate-300">{col.name}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">Target Columns:</p>
                                    <div className="space-y-1">
                                      {currentTable.data.columns
                                        .filter(col => col.isPrimaryKey || col.isForeignKey)
                                        .map(col => (
                                          <div key={col.id} className="flex items-center">
                                            {col.isPrimaryKey ? (
                                              <Key className="h-3 w-3 text-amber-400 mr-1" />
                                            ) : (
                                              <Link className="h-3 w-3 text-blue-400 mr-1" />
                                            )}
                                            <span className="text-xs text-slate-300">{col.name}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex justify-center my-4">
                <ArrowRight className="h-8 w-8 text-[#2AB7A9] rotate-90" />
              </div>
            </div>
          )}
          
          {/* Current Table */}
          {currentTable && (
            <div className="flex justify-center">
              <div className="p-5 rounded-lg border-2 border-[#2AB7A9] bg-[#2AB7A9]/20 max-w-lg w-full">
                <div className="flex items-start">
                  <div className="mr-4">
                    {getNodeIcon(currentTable.data.type)}
                  </div>
                  <div className="flex-grow">
                    <h5 className="text-base font-medium text-white">{currentTable.data.label}</h5>
                    <p className="text-sm text-slate-300 mt-1">{currentTable.data.description || 'No description available'}</p>
                    
                    {/* Key columns */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-slate-300 mb-1">Primary Keys:</p>
                        <div className="space-y-1">
                          {currentTable.data.columns
                            .filter(col => col.isPrimaryKey)
                            .map(col => (
                              <div key={col.id} className="flex items-center">
                                <Key className="h-3 w-3 text-amber-400 mr-1" />
                                <span className="text-xs text-slate-300">{col.name}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs text-slate-300 mb-1">Foreign Keys:</p>
                        <div className="space-y-1">
                          {currentTable.data.columns
                            .filter(col => col.isForeignKey)
                            .map(col => (
                              <div key={col.id} className="flex items-center">
                                <Link className="h-3 w-3 text-blue-400 mr-1" />
                                <span className="text-xs text-slate-300">{col.name}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Downstream Relationships */}
          {downstreamRelationships.length > 0 && (
            <div>
              <div className="flex justify-center my-4">
                <ArrowRight className="h-8 w-8 text-[#2AB7A9] rotate-90" />
              </div>
              
              <h4 className="text-sm font-medium text-white mb-3">Downstream Relationships (Dependent Tables)</h4>
              <div className="space-y-4">
                {downstreamRelationships.map(relationship => {
                  const targetTable = getNodeById(filteredData, relationship.target);
                  
                  return (
                    <div key={relationship.id} className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className={`p-3 rounded-lg ${getNodeColor(targetTable.data.type)} mr-4`}>
                          {getNodeIcon(targetTable.data.type)}
                        </div>
                        
                        <div className="flex-grow">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-white">{targetTable.data.label}</h5>
                            <span className={`px-2 py-1 rounded text-xs ${getRelationshipColor(relationship.data.relationship)}`}>
                              {relationship.data.relationship}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-400 mt-1">{targetTable.data.description || 'No description available'}</p>
                          
                          {/* Relationship details */}
                          <div className="mt-3 p-3 rounded bg-slate-800/50 border border-slate-600">
                            <div className="flex items-start">
                              {getRelationshipIcon(relationship.data.relationship)}
                              <div className="ml-3">
                                <p className="text-xs text-slate-300">{relationship.data.description || `${relationship.source} → ${relationship.target}`}</p>
                                
                                {/* Show columns involved in the relationship */}
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">Source Columns:</p>
                                    <div className="space-y-1">
                                      {currentTable.data.columns
                                        .filter(col => col.isPrimaryKey || col.isForeignKey)
                                        .map(col => (
                                          <div key={col.id} className="flex items-center">
                                            {col.isPrimaryKey ? (
                                              <Key className="h-3 w-3 text-amber-400 mr-1" />
                                            ) : (
                                              <Link className="h-3 w-3 text-blue-400 mr-1" />
                                            )}
                                            <span className="text-xs text-slate-300">{col.name}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">Target Columns:</p>
                                    <div className="space-y-1">
                                      {targetTable.data.columns
                                        .filter(col => col.isPrimaryKey || col.isForeignKey)
                                        .map(col => (
                                          <div key={col.id} className="flex items-center">
                                            {col.isPrimaryKey ? (
                                              <Key className="h-3 w-3 text-amber-400 mr-1" />
                                            ) : (
                                              <Link className="h-3 w-3 text-blue-400 mr-1" />
                                            )}
                                            <span className="text-xs text-slate-300">{col.name}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-400"></div>
              <span className="text-xs text-slate-400">Source Tables</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <span className="text-xs text-slate-400">Transformation Tables</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-purple-400"></div>
              <span className="text-xs text-slate-400">Views</span>
            </div>
            <div className="flex items-center space-x-2">
              <Key className="h-3 w-3 text-amber-400" />
              <span className="text-xs text-slate-400">Primary Key</span>
            </div>
            <div className="flex items-center space-x-2">
              <Link className="h-3 w-3 text-blue-400" />
              <span className="text-xs text-slate-400">Foreign Key</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Data Catalog component
export function DataCatalog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLineageModel, setSelectedLineageModel] = useState('customer');
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableNode | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showLineageFilter, setShowLineageFilter] = useState(false);
  
  // Load lineage data when model changes
  useEffect(() => {
    if (selectedLineageModel === 'customer') {
      setLineageData(createCustomerLineage());
    } else if (selectedLineageModel === 'order') {
      setLineageData(createOrderLineage());
    }
  }, [selectedLineageModel]);
  
  // Filter tables based on search term
  const filteredTables = lineageData?.nodes.filter(node => 
    node.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    node.data.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (node.data.description && node.data.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    node.data.columns.some(col => 
      col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (col.description && col.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  ) || [];
  
  // Handle table selection
  const handleTableClick = (table: TableNode) => {
    setSelectedTable(table);
    setActiveTab('overview');
  };
  
  // Get table type badge color
  const getTableTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'source':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'view':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dimension':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'fact':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  // Format last updated time
  const formatLastUpdated = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)} weeks ago`;
    } else {
      return `${Math.floor(diffDays / 30)} months ago`;
    }
  };
  
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Data Catalog</h1>
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search tables, columns, descriptions..." 
                className="pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent shadow-sm" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              className="flex items-center px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 shadow-sm"
              onClick={() => setShowLineageFilter(!showLineageFilter)}
            >
              <Filter className="h-4 w-4 mr-2 text-gray-500" />
              {selectedLineageModel === 'customer' ? 'Customer Data' : 'Order Data'}
            </button>
          </div>
        </div>
        
        {showLineageFilter && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 animate-fade-in shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Select Data Domain
            </h3>
            <div className="flex space-x-4">
              {lineageModels.map(model => (
                <button
                  key={model.id}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    selectedLineageModel === model.id
                      ? 'bg-sky-100 text-sky-700 border border-sky-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                  }`}
                  onClick={() => {
                    setSelectedLineageModel(model.id);
                    setSelectedTable(null);
                    setShowLineageFilter(false);
                  }}
                >
                  {model.icon === 'database' ? (
                    <Database className="h-4 w-4 inline mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 inline mr-2" />
                  )}
                  {model.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 h-full shadow-sm">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-800">Tables & Views</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredTables.length} items in {selectedLineageModel === 'customer' ? 'Customer' : 'Order'} domain
                </p>
              </div>
              <div className="overflow-y-auto max-h-[700px]">
                <ul className="divide-y divide-gray-200">
                  {filteredTables.map(table => (
                    <li 
                      key={table.id} 
                      className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedTable?.id === table.id ? 'bg-sky-50' : ''}`}
                      onClick={() => handleTableClick(table)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <div className="mr-3 mt-1">
                            {table.data.type === 'source' ? (
                              <Database className="h-5 w-5 text-blue-600" />
                            ) : table.data.type === 'view' ? (
                              <FileText className="h-5 w-5 text-purple-600" />
                            ) : (
                              <Table className="h-5 w-5 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">
                              {table.data.label}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {table.data.description?.substring(0, 60)}
                              {table.data.description && table.data.description.length > 60 ? '...' : ''}
                            </p>
                            <div className="flex items-center mt-2 space-x-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full border ${getTableTypeBadgeColor(table.data.type)}`}>
                                {table.data.type.charAt(0).toUpperCase() + table.data.type.slice(1)}
                              </span>
                              <span className="flex items-center text-xs text-gray-500">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatLastUpdated(lastUpdatedInfo[table.id])}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <ChevronRight className={`h-5 w-5 ${selectedTable?.id === table.id ? 'text-sky-600' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            {selectedTable ? (
              <div className="bg-white rounded-lg border border-gray-200 h-full shadow-sm">
                <div className="border-b border-gray-200">
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <div className="mr-3 mt-1">
                          {selectedTable.data.type === 'source' ? (
                            <Database className="h-6 w-6 text-blue-600" />
                          ) : selectedTable.data.type === 'view' ? (
                            <FileText className="h-6 w-6 text-purple-600" />
                          ) : (
                            <Table className="h-6 w-6 text-emerald-600" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900">
                            {selectedTable.data.label}
                          </h2>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedTable.data.description}
                          </p>
                          <div className="flex items-center mt-2 space-x-3">
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${getTableTypeBadgeColor(selectedTable.data.type)}`}>
                              {selectedTable.data.type.charAt(0).toUpperCase() + selectedTable.data.type.slice(1)}
                            </span>
                            <span className="flex items-center text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              Last updated: {new Date(lastUpdatedInfo[selectedTable.id]).toLocaleDateString()}
                            </span>
                            <span className="flex items-center text-xs text-gray-500">
                              <Tag className="h-3 w-3 mr-1" />
                              {selectedTable.data.columns.length} columns
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <button className="flex items-center px-3 py-1.5 bg-sky-100 text-sky-700 rounded-md text-sm hover:bg-sky-200">
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <nav className="flex px-4 space-x-4">
                    {['overview', 'columns', 'lineage', 'sample', 'usage', 'ai-assistant'].map((tab) => (
                      <button
                        key={tab}
                        className={`px-3 py-2 text-sm font-medium border-b-2 ${
                          activeTab === tab
                            ? 'border-sky-500 text-sky-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab === 'overview' && 'Overview'}
                        {tab === 'columns' && 'Columns'}
                        {tab === 'lineage' && 'Lineage'}
                        {tab === 'sample' && 'Sample Data'}
                        {tab === 'usage' && 'Usage Stats'}
                        {tab === 'ai-assistant' && (
                          <span className="flex items-center">
                            <Cpu className="h-3.5 w-3.5 mr-1.5" />
                            AI Assistant
                          </span>
                        )}
                      </button>
                    ))}
                  </nav>
                </div>
                
                {/* Tab Content Section */}
                <div className="p-4">
                  {activeTab === 'overview' && <TableOverview table={selectedTable} />}
                  
                  {activeTab === 'columns' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-800">Columns</h3>
                        <div className="relative w-64">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="Search columns..." 
                            className="pl-9 pr-4 py-1.5 w-full bg-white border border-gray-300 rounded-md text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" 
                          />
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attributes</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {selectedTable.data.columns.map((column, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {column.name}
                                  {column.isPrimaryKey && (
                                    <Key className="h-3.5 w-3.5 inline-block ml-1.5 text-amber-500" />
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{column.type}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{column.description || '-'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  <div className="flex space-x-2">
                                    {column.isPrimaryKey && (
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                        Primary Key
                                      </span>
                                    )}
                                    {column.isNullable === false && (
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800 border border-red-200">
                                        Not Null
                                      </span>
                                    )}
                                    {column.isUnique && (
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                        Unique
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'lineage' && <TableLineage tableId={selectedTable.id} />}
                  
                  {activeTab === 'sample' && <SampleData tableId={selectedTable.id} columns={selectedTable.data.columns} />}
                  
                  {activeTab === 'usage' && <UsageInfo tableId={selectedTable.id} />}
                  
                  {activeTab === 'ai-assistant' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 bg-sky-100 p-2 rounded-lg">
                            <Cpu className="h-6 w-6 text-sky-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-800">AI Data Assistant</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              Ask questions about this table, its data, or how it relates to other tables in your data ecosystem.
                            </p>
                            <div className="mt-4 relative">
                              <input 
                                type="text" 
                                placeholder="Ask a question about this table..." 
                                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" 
                              />
                              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-sky-600 text-white rounded-md text-sm hover:bg-sky-700">
                                Ask
                              </button>
                            </div>
                            <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                              <p className="font-medium mb-2">Example questions:</p>
                              <ul className="list-disc pl-5 space-y-1">
                                <li>What is the business purpose of this table?</li>
                                <li>How does this table relate to the customer dimension?</li>
                                <li>What are the primary data quality issues with this table?</li>
                                <li>How fresh is this data and when was it last updated?</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center p-6 shadow-sm">
                <div className="text-center">
                  <Database className="h-12 w-12 text-gray-400 mx-auto" />
                  <h3 className="mt-4 text-lg font-medium text-gray-800">
                    Select a table or view
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-sm">
                    Choose a table or view from the catalog to see detailed information,
                    columns, lineage, and sample data.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}