import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ArrowRight, ChevronDown, ChevronUp, Database, Shield, ExternalLink, GitBranch, Network, BarChart, Table, LineChart, GitFork } from 'lucide-react';

// Simple placeholder data to avoid loading actual lineage data that causes white pages
const placeholderModels = [
  {
    id: 'customer',
    name: 'Customer Lineage',
    description: 'End-to-end customer data flow from source to dimension table',
    lastUpdated: 'Jul 20, 2023, 09:15 AM',
    tables: 9,
    relationships: 12,
    sources: 3,
    staging: 3,
    marts: 3
  },
  {
    id: 'order',
    name: 'Order Lineage',
    description: 'Order processing flow including fact tables and calculated metrics',
    lastUpdated: 'Jul 20, 2023, 11:30 AM',
    tables: 11,
    relationships: 15,
    sources: 4,
    staging: 4,
    marts: 3
  }
];

// Sample placeholder tables for each model
const placeholderTables = {
  'customer': [
    { id: 'tpch_customers', name: 'tpch_customers', type: 'source', description: 'Source customers data from TPCH', columns: 9, relationships: 3 },
    { id: 'tpch_nations', name: 'tpch_nations', type: 'source', description: 'Source nations data from TPCH', columns: 4, relationships: 2 },
    { id: 'tpch_regions', name: 'tpch_regions', type: 'source', description: 'Source regions data from TPCH', columns: 3, relationships: 1 },
    { id: 'stg_tpch_customers', name: 'stg_tpch_customers', type: 'staging', description: 'Cleaned and transformed customer data', columns: 10, relationships: 2 },
    { id: 'stg_tpch_nations', name: 'stg_tpch_nations', type: 'staging', description: 'Cleaned and transformed nations data', columns: 5, relationships: 2 },
    { id: 'stg_tpch_regions', name: 'stg_tpch_regions', type: 'staging', description: 'Cleaned and transformed regions data', columns: 4, relationships: 1 },
    { id: 'dim_customers', name: 'dim_customers', type: 'mart', description: 'Customer dimension table', columns: 12, relationships: 3 },
    { id: 'dim_nations', name: 'dim_nations', type: 'mart', description: 'Nation dimension table', columns: 6, relationships: 2 },
    { id: 'dim_regions', name: 'dim_regions', type: 'mart', description: 'Region dimension table', columns: 5, relationships: 1 }
  ],
  'order': [
    { id: 'tpch_orders', name: 'tpch_orders', type: 'source', description: 'Source orders data from TPCH', columns: 9, relationships: 3 },
    { id: 'tpch_line_items', name: 'tpch_line_items', type: 'source', description: 'Source line items data from TPCH', columns: 16, relationships: 3 },
    { id: 'stg_tpch_orders', name: 'stg_tpch_orders', type: 'staging', description: 'Cleaned and transformed orders data', columns: 10, relationships: 3 },
    { id: 'stg_tpch_line_items', name: 'stg_tpch_line_items', type: 'staging', description: 'Cleaned and transformed line items data', columns: 17, relationships: 3 },
    { id: 'fct_orders', name: 'fct_orders', type: 'mart', description: 'Order fact table', columns: 12, relationships: 3 },
    { id: 'fct_order_items', name: 'fct_order_items', type: 'mart', description: 'Order items fact table', columns: 15, relationships: 3 }
  ]
};

// Available lineage view types
const lineageViews = [
  { id: 'table', name: 'Table Lineage', icon: <Table className="h-5 w-5 text-blue-400" />, description: 'View table-level dependencies and lineage' },
  { id: 'column', name: 'Column Lineage', icon: <LineChart className="h-5 w-5 text-green-400" />, description: 'Detailed column-level lineage with transformations' },
  { id: 'impact', name: 'Impact Analysis', icon: <GitFork className="h-5 w-5 text-purple-400" />, description: 'See downstream impact of table and column changes' },
  { id: 'deps', name: 'Dependencies', icon: <BarChart className="h-5 w-5 text-orange-400" />, description: 'Explore upstream and downstream dependencies' }
];

export function DataLineage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModel, setExpandedModel] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState('All');
  
  // Filter tables based on search term and type filter
  const getFilteredTables = (modelId) => {
    if (!placeholderTables[modelId]) return [];
    
    return placeholderTables[modelId].filter(table => {
      const matchesSearch = table.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          table.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'All' || 
                         table.type.toLowerCase() === typeFilter.toLowerCase();
      
      return matchesSearch && matchesType;
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Data Lineage</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tables..." 
              className="pl-9 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <button 
            className="flex items-center px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-300 hover:bg-slate-600"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
            {showFilters ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </button>
        </div>
      </div>
      
      {/* Quick Lineage Views */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {lineageViews.map(view => (
          <div key={view.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:bg-slate-750 transition-colors">
            <Link to={`/dashboard/lineage/views/${view.id}`} className="flex flex-col h-full">
              <div className="flex items-center mb-2">
                {view.icon}
                <h3 className="text-sm font-medium text-white ml-2">{view.name}</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3 flex-grow">
                {view.description}
              </p>
              <div className="flex justify-end">
                <span className="text-xs text-[#2AB7A9] flex items-center">
                  Open View
                  <ArrowRight className="h-3 w-3 ml-1" />
                </span>
              </div>
            </Link>
          </div>
        ))}
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Table Type
              </label>
              <div className="flex flex-wrap gap-2">
                {['All', 'Source', 'Staging', 'Mart'].map(option => (
                  <button 
                    key={option} 
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      typeFilter === option 
                        ? 'bg-[#2AB7A9] text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    onClick={() => setTypeFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Lineage Models Overview - using static placeholder data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {placeholderModels.map(model => (
          <div 
            key={model.id} 
            className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
          >
            <div 
              className="p-4 border-b border-slate-700 flex justify-between items-center cursor-pointer hover:bg-slate-750"
              onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
            >
              <div>
                <h3 className="text-lg font-medium text-white">
                  {model.name}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {model.description}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Last Updated</p>
                  <p className="text-sm text-slate-300">
                    {model.lastUpdated}
                  </p>
                </div>
                {expandedModel === model.id ? 
                  <ChevronUp className="h-5 w-5 text-slate-400" /> : 
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                }
              </div>
            </div>
            
            {expandedModel === model.id && (
              <div className="p-5">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400">Tables</p>
                    <p className="text-xl font-semibold text-white mt-1">
                      {model.tables}
                    </p>
                    <div className="flex justify-center space-x-2 mt-2">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-400/20 text-blue-400">
                        {model.sources} Source
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-400/20 text-green-400">
                        {model.staging} Staging
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-400/20 text-purple-400">
                        {model.marts} Mart
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-400">Relationships</p>
                    <p className="text-xl font-semibold text-white mt-1">
                      {model.relationships}
                    </p>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center flex flex-col items-center justify-center">
                    <div className="flex space-x-2">
                      <Link 
                        to={`/dashboard/lineage/views/table?model=${model.id}`} 
                        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm text-white flex items-center"
                      >
                        <Table className="h-4 w-4 mr-1.5" />
                        Table View
                      </Link>
                      <Link 
                        to={`/dashboard/lineage/views/column?model=${model.id}`} 
                        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm text-white flex items-center"
                      >
                        <LineChart className="h-4 w-4 mr-1.5" />
                        Column View
                      </Link>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">
                    Tables in {model.name}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-700">
                      <thead className="bg-slate-800">
                        <tr>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Table Name
                          </th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Type
                          </th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Columns
                          </th>
                          <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Relations
                          </th>
                          <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {getFilteredTables(model.id).map(table => (
                          <tr key={table.id} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {table.name}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                                  {table.description}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                table.type === 'source' 
                                  ? 'bg-blue-400/20 text-blue-400' 
                                  : table.type === 'staging' 
                                    ? 'bg-green-400/20 text-green-400' 
                                    : 'bg-purple-400/20 text-purple-400'
                              }`}>
                                {table.type.charAt(0).toUpperCase() + table.type.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {table.columns}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {table.relationships}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center space-x-2">
                                <Link 
                                  to={`/dashboard/lineage/views/table?model=${model.id}&focus=${table.id}`}
                                  className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300"
                                  title="View in table lineage"
                                >
                                  <Table className="h-4 w-4" />
                                </Link>
                                <Link 
                                  to={`/dashboard/lineage/views/column?model=${model.id}&table=${table.id}`}
                                  className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300"
                                  title="View column-level lineage"
                                >
                                  <LineChart className="h-4 w-4" />
                                </Link>
                                <Link 
                                  to={`/dashboard/catalog?table=${table.name}`}
                                  className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300"
                                  title="View in data catalog"
                                >
                                  <Database className="h-4 w-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <Link 
                    to={`/dashboard/lineage/views/deps?model=${model.id}`}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm flex items-center"
                  >
                    View Dependencies
                    <GitFork className="h-4 w-4 ml-2" />
                  </Link>
                  <Link 
                    to={`/dashboard/lineage/views/impact?model=${model.id}`}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm flex items-center"
                  >
                    Impact Analysis
                    <BarChart className="h-4 w-4 ml-2" />
                  </Link>
                  <Link 
                    to={`/dashboard/lineage/views/table?model=${model.id}`}
                    className="px-4 py-2 bg-[#2AB7A9] hover:bg-[#2AB7A9]/90 text-white rounded-md text-sm flex items-center"
                  >
                    Full Lineage
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Quick Links with Enhanced Navigation */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-medium text-white mb-4">
          Data Lineage Navigation
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Customer Lineage Views</h4>
            <div className="space-y-2">
              <Link 
                to="/dashboard/lineage/views/table?model=customer"
                className="px-4 py-3 bg-slate-700/50 rounded-lg flex items-center hover:bg-slate-700 transition-colors"
              >
                <div className="mr-3 p-2 bg-blue-500/10 rounded-full">
                  <Table className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Table Lineage View</p>
                  <p className="text-xs text-slate-400">End-to-end customer data flow visualization</p>
                </div>
              </Link>
              <Link 
                to="/dashboard/lineage/views/column?model=customer"
                className="px-4 py-3 bg-slate-700/50 rounded-lg flex items-center hover:bg-slate-700 transition-colors"
              >
                <div className="mr-3 p-2 bg-green-500/10 rounded-full">
                  <LineChart className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Column Lineage View</p>
                  <p className="text-xs text-slate-400">Detailed column transformations and lineage</p>
                </div>
              </Link>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-white mb-3">Order Lineage Views</h4>
            <div className="space-y-2">
              <Link 
                to="/dashboard/lineage/views/table?model=order"
                className="px-4 py-3 bg-slate-700/50 rounded-lg flex items-center hover:bg-slate-700 transition-colors"
              >
                <div className="mr-3 p-2 bg-blue-500/10 rounded-full">
                  <Table className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Table Lineage View</p>
                  <p className="text-xs text-slate-400">Order processing flow visualization</p>
                </div>
              </Link>
              <Link 
                to="/dashboard/lineage/views/column?model=order"
                className="px-4 py-3 bg-slate-700/50 rounded-lg flex items-center hover:bg-slate-700 transition-colors"
              >
                <div className="mr-3 p-2 bg-green-500/10 rounded-full">
                  <LineChart className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Column Lineage View</p>
                  <p className="text-xs text-slate-400">Detailed order data transformations</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
        
        <div className="mt-6 border-t border-slate-700 pt-6">
          <h4 className="text-sm font-medium text-white mb-3">Related Data Resources</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              to="/dashboard/catalog"
              className="px-4 py-3 bg-slate-700/50 rounded-lg flex items-center hover:bg-slate-700 transition-colors"
            >
              <Database className="h-5 w-5 text-[#2AB7A9] mr-2" />
              <span className="text-sm text-white">Data Catalog</span>
            </Link>
            <Link 
              to="/dashboard/alerts"
              className="px-4 py-3 bg-slate-700/50 rounded-lg flex items-center hover:bg-slate-700 transition-colors"
            >
              <GitBranch className="h-5 w-5 text-[#2AB7A9] mr-2" />
              <span className="text-sm text-white">Data Alerts</span>
            </Link>
            <Link 
              to="/dashboard/governance"
              className="px-4 py-3 bg-slate-700/50 rounded-lg flex items-center hover:bg-slate-700 transition-colors"
            >
              <Shield className="h-5 w-5 text-[#2AB7A9] mr-2" />
              <span className="text-sm text-white">Data Governance</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}