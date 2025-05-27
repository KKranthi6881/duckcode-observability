import React, { useState, useEffect } from 'react';
import { Search, Filter, Database, Table, FileText, Tag, Clock, Check, X, Star, Key, ChevronLeft, ChevronRight, Network, Calendar, RefreshCw, Info } from 'lucide-react';
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
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Description
        </h3>
        <p className="text-slate-400 text-sm">
          {table.data.description}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Business Context
        </h3>
        <p className="text-slate-400 text-sm">
          {businessContext[table.id] || 'No business context available'}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Last Updated
        </h3>
        <p className="text-slate-400 text-sm">
          {new Date(lastUpdatedInfo[table.id] || Date.now()).toLocaleString()}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Quality Score
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {qualityMetrics[table.id] && Object.entries(qualityMetrics[table.id]).map(([metric, score]) => (
            <div key={metric} className="bg-slate-700 p-3 rounded-lg">
              <p className="text-xs text-slate-400 capitalize">{metric}</p>
              <p className="text-lg font-semibold text-white mt-1">
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
    return <p className="text-slate-400 text-sm">No usage data available</p>;
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-700 p-4 rounded-lg">
          <p className="text-xs text-slate-400">
            Queries (Last 30 Days)
          </p>
          <p className="text-2xl font-semibold text-white mt-1">
            {stats.queries}
          </p>
        </div>
        <div className="bg-slate-700 p-4 rounded-lg">
          <p className="text-xs text-slate-400">
            Unique Users
          </p>
          <p className="text-2xl font-semibold text-white mt-1">
            {stats.users}
          </p>
        </div>
        <div className="bg-slate-700 p-4 rounded-lg">
          <p className="text-xs text-slate-400">
            Avg. Query Time
          </p>
          <p className="text-2xl font-semibold text-white mt-1">
            {stats.avgQueryTime}
          </p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Top Queries
        </h3>
        <div className="bg-slate-700 rounded-lg p-4">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap">
            {`SELECT * FROM ${tableId} WHERE last_update_date > '2023-01-01'`}
          </pre>
          <p className="text-xs text-slate-400 mt-2">
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
        <p className="text-slate-400">
          No sample data available for this table.
        </p>
      </div>
    );
  }
  
  // Get column keys from the first data item
  const columnKeys = Object.keys(data[0]);
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead>
          <tr>
            {columnKeys.map(key => (
              <th key={key} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-700/50">
              {columnKeys.map(key => (
                <td key={`${rowIndex}-${key}`} className="px-4 py-3 text-sm text-slate-300">
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

// Modified TableLineage component to show a message instead of using LineageGraph
const TableLineage = ({ tableId }: { tableId: string }) => {
  return (
    <div className="h-[600px] flex items-center justify-center bg-slate-700/30 rounded-lg border border-slate-600">
      <div className="text-center max-w-md p-6">
        <Network className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">
          Lineage Visualization Temporarily Disabled
        </h3>
        <p className="text-sm text-slate-400">
          The lineage visualization for {tableId} is currently being upgraded.
          You can still explore table metadata, columns, and sample data.
        </p>
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
    node.data.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.data.columns.some(col => 
      col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.description?.toLowerCase().includes(searchTerm.toLowerCase())
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
        return 'bg-blue-500/20 text-blue-400';
      case 'transformation':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'view':
        return 'bg-purple-500/20 text-purple-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };
  
  // Format last updated time
  const formatLastUpdated = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Data Catalog</h1>
          <div className="flex space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search tables, columns, descriptions..." 
                className="pl-9 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              className="flex items-center px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-300 hover:bg-slate-600"
              onClick={() => setShowLineageFilter(!showLineageFilter)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {selectedLineageModel === 'customer' ? 'Customer Data' : 'Order Data'}
            </button>
          </div>
        </div>
        
        {showLineageFilter && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 animate-fade-in">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Select Data Domain
            </h3>
            <div className="flex space-x-4">
              {lineageModels.map(model => (
                <button
                  key={model.id}
                  className={`px-4 py-2 rounded-md ${selectedLineageModel === model.id ? 'bg-[#2AB7A9] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  onClick={() => {
                    setSelectedLineageModel(model.id);
                    setSelectedTable(null);
                    setShowLineageFilter(false);
                  }}
                >
                  {model.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-12 gap-6">
          {/* Catalog sidebar */}
          <div className="col-span-12 md:col-span-4 lg:col-span-3">
            <div className="bg-slate-800 rounded-lg border border-slate-700 h-full">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-medium text-white">Tables & Views</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {filteredTables.length} items in {selectedLineageModel === 'customer' ? 'Customer' : 'Order'} domain
                </p>
              </div>
              <div className="overflow-y-auto max-h-[700px]">
                <ul className="divide-y divide-slate-700">
                  {filteredTables.map(table => (
                    <li 
                      key={table.id} 
                      className={`p-4 hover:bg-slate-700 cursor-pointer ${selectedTable?.id === table.id ? 'bg-slate-700' : ''}`}
                      onClick={() => handleTableClick(table)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start">
                          <div className="mr-3 mt-1">
                            {table.data.type === 'source' ? (
                              <Database className="h-5 w-5 text-blue-400" />
                            ) : table.data.type === 'view' ? (
                              <FileText className="h-5 w-5 text-purple-400" />
                            ) : (
                              <Table className="h-5 w-5 text-emerald-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-white">
                              {table.data.label}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              {table.data.schema}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                              {table.data.description}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${getTableTypeBadgeColor(table.data.type)}`}>
                                {table.data.type.charAt(0).toUpperCase() + table.data.type.slice(1)}
                              </span>
                              <span className="flex items-center text-xs text-slate-400">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatLastUpdated(lastUpdatedInfo[table.id])}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                  {filteredTables.length === 0 && (
                    <li className="p-8 text-center text-slate-400">
                      No tables match your search criteria
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
          
          {/* Table details */}
          <div className="col-span-12 md:col-span-8 lg:col-span-9">
            {selectedTable ? (
              <div className="bg-slate-800 rounded-lg border border-slate-700 h-full">
                <div className="p-6 border-b border-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <h2 className="text-xl font-medium text-white">
                          {selectedTable.data.label}
                        </h2>
                        <span className={`ml-3 px-2 py-0.5 rounded-full text-xs ${getTableTypeBadgeColor(selectedTable.data.type)}`}>
                          {selectedTable.data.type.charAt(0).toUpperCase() + selectedTable.data.type.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">
                        {selectedTable.data.schema} • {selectedTable.data.columns.length} columns
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors">
                        <RefreshCw className="h-4 w-4 text-slate-400" />
                      </button>
                      <button className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors">
                        <Star className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="border-b border-slate-700">
                  <nav className="flex -mb-px">
                    {['overview', 'columns', 'lineage', 'sample', 'usage'].map(tab => (
                      <button 
                        key={tab} 
                        className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === tab ? 'border-[#2AB7A9] text-[#2AB7A9]' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </nav>
                </div>
                
                <div className="p-6">
                  {activeTab === 'overview' && <TableOverview table={selectedTable} />}
                  {activeTab === 'columns' && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-700">
                        <thead>
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Key
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                              Description
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {selectedTable.data.columns.map((column, idx) => (
                            <tr key={idx} className="hover:bg-slate-700/50">
                              <td className="px-4 py-3 text-sm text-white">
                                {column.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-300">
                                {column.type}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {column.isPrimaryKey && (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-400/20 text-yellow-400">
                                    Primary
                                  </span>
                                )}
                                {column.isForeignKey && (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-400/20 text-blue-400">
                                    Foreign
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-300">
                                {column.description || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {activeTab === 'lineage' && <TableLineage tableId={selectedTable.id} />}
                  {activeTab === 'sample' && <SampleData tableId={selectedTable.id} columns={selectedTable.data.columns} />}
                  {activeTab === 'usage' && <UsageInfo tableId={selectedTable.id} />}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg border border-slate-700 h-full flex items-center justify-center p-6">
                <div className="text-center">
                  <Database className="h-12 w-12 text-slate-600 mx-auto" />
                  <h3 className="mt-4 text-lg font-medium text-white">
                    Select a table or view
                  </h3>
                  <p className="mt-2 text-sm text-slate-400 max-w-sm">
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