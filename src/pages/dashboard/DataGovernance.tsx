import React, { useState, useEffect } from 'react';
import { Shield, FileText, Users, Key, Settings, BarChart, AlertTriangle, CheckCircle, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { lineageModels, createCustomerLineage, createOrderLineage, TableNode } from './components/charts/lineageData';

// Simple error boundary component to catch rendering errors
const SafeComponent = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return fallback || (
      <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-300">
        Something went wrong rendering this component.
      </div>
    );
  }
  
  try {
    return children;
  } catch (error) {
    console.error("Rendering error:", error);
    setHasError(true);
    return null;
  }
};

// Sample governance status data (would come from backend in real app)
const governanceStatus = {
  'tpch_customers': {
    owner: 'Data Engineering',
    compliance: 'High',
    pii: true,
    retention: '7 years',
    quality: 95,
    lastAudit: '2023-06-15'
  },
  'tpch_orders': {
    owner: 'Sales Operations',
    compliance: 'Medium',
    pii: false,
    retention: '5 years',
    quality: 87,
    lastAudit: '2023-05-22'
  },
  'tpch_line_items': {
    owner: 'Sales Operations',
    compliance: 'Medium',
    pii: false,
    retention: '5 years',
    quality: 92,
    lastAudit: '2023-05-22'
  },
  'stg_tpch_customers': {
    owner: 'Data Engineering',
    compliance: 'High',
    pii: true,
    retention: '7 years',
    quality: 98,
    lastAudit: '2023-06-18'
  },
  'stg_tpch_orders': {
    owner: 'Data Engineering',
    compliance: 'Medium',
    pii: false,
    retention: '5 years',
    quality: 89,
    lastAudit: '2023-06-02'
  },
  'stg_tpch_line_items': {
    owner: 'Data Engineering',
    compliance: 'Medium',
    pii: false,
    retention: '5 years',
    quality: 94,
    lastAudit: '2023-06-02'
  },
  'dim_customers': {
    owner: 'Business Intelligence',
    compliance: 'High',
    pii: true,
    retention: '7 years',
    quality: 99,
    lastAudit: '2023-07-01'
  },
  'fct_orders': {
    owner: 'Business Intelligence',
    compliance: 'Medium',
    pii: false,
    retention: '5 years',
    quality: 93,
    lastAudit: '2023-06-25'
  },
  'fct_order_items': {
    owner: 'Business Intelligence',
    compliance: 'Medium',
    pii: false,
    retention: '5 years',
    quality: 96,
    lastAudit: '2023-06-25'
  }
};

export function DataGovernance() {
  // State for active tab and filters
  const [activeTab, setActiveTab] = useState('tables');
  const [selectedModel, setSelectedModel] = useState('customer');
  const [searchTerm, setSearchTerm] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [tableNodes, setTableNodes] = useState<TableNode[]>([]);
  
  // Load table nodes from lineage data
  useEffect(() => {
    try {
      const lineageData = selectedModel === 'customer' 
        ? createCustomerLineage() 
        : createOrderLineage();
      
      setTableNodes(lineageData.nodes as TableNode[]);
    } catch (error) {
      console.error("Error loading lineage data:", error);
      setTableNodes([]);
    }
  }, [selectedModel]);
  
  // Filter tables based on search term and compliance filter
  const filteredTables = tableNodes.filter(node => {
    const matchesSearch = node.data.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (node.data.description && node.data.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCompliance = complianceFilter === 'All' || 
                            (governanceStatus[node.data.label] && 
                             governanceStatus[node.data.label].compliance.toLowerCase() === complianceFilter.toLowerCase());
    return matchesSearch && matchesCompliance;
  });
  
  // Calculate governance metrics
  const tablesWithPii = tableNodes.filter(node => 
    governanceStatus[node.data.label] && governanceStatus[node.data.label].pii
  ).length;
  
  const avgQuality = tableNodes.reduce((sum, node) => {
    return governanceStatus[node.data.label] 
      ? sum + governanceStatus[node.data.label].quality 
      : sum;
  }, 0) / (tableNodes.length || 1);
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Data Governance</h1>
        <div className="flex space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tables..." 
              className="pl-9 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
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
      
      {/* Lineage Model Selector */}
      <div className="flex space-x-4 mb-4">
        {lineageModels.map(model => (
          <button
            key={model.id}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedModel === model.id
                ? 'bg-[#2AB7A9] text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => setSelectedModel(model.id)}
          >
            {model.name}
          </button>
        ))}
      </div>
      
      {/* Tab navigation */}
      <div className="flex border-b border-slate-700 mb-6">
        {['tables', 'policies', 'access', 'compliance'].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'text-[#2AB7A9] border-b-2 border-[#2AB7A9]'
                : 'text-slate-400 hover:text-slate-300'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 animate-fade-in mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Compliance Level
              </label>
              <div className="flex flex-wrap gap-2">
                {['All', 'High', 'Medium', 'Low'].map(option => (
                  <button 
                    key={option} 
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      complianceFilter === option 
                        ? 'bg-[#2AB7A9] text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    onClick={() => setComplianceFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Dashboard Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Tables</p>
              <p className="text-2xl font-semibold text-white mt-1">
                {tableNodes.length}
              </p>
            </div>
            <FileText className="h-8 w-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">PII Data Tables</p>
              <p className="text-2xl font-semibold text-orange-400 mt-1">
                {tablesWithPii}
              </p>
            </div>
            <Shield className="h-8 w-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Avg. Data Quality</p>
              <p className="text-2xl font-semibold text-green-400 mt-1">
                {avgQuality.toFixed(1)}%
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Compliance Issues</p>
              <p className="text-2xl font-semibold text-red-400 mt-1">
                {tableNodes.length - Math.floor(avgQuality * tableNodes.length / 100)}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-slate-600" />
          </div>
        </div>
      </div>
      
      {/* Main content wrapped in SafeComponent */}
      <SafeComponent>
        {activeTab === 'tables' && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-medium text-white">
                Tables Governance
                <span className="ml-2 text-sm text-slate-400">
                  ({filteredTables.length})
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-800">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Table Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Owner
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      PII Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Compliance
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Quality
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Last Audit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredTables.length > 0 ? (
                    filteredTables.map(table => {
                      const governance = governanceStatus[table.data.label] || {
                        owner: 'Unassigned',
                        compliance: 'Low',
                        pii: false,
                        quality: 0,
                        lastAudit: 'Never'
                      };
                      
                      return (
                        <tr key={table.id} className="hover:bg-slate-700/50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {table.data.label}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {table.data.description ? table.data.description.substring(0, 60) + '...' : 'No description'}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {governance.owner}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300 capitalize">
                            {table.data.type || 'Unknown'}
                          </td>
                          <td className="px-6 py-4">
                            {governance.pii ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-400/20 text-orange-400">
                                Yes
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              governance.compliance === 'High' 
                                ? 'bg-green-400/20 text-green-400' 
                                : governance.compliance === 'Medium' 
                                  ? 'bg-yellow-400/20 text-yellow-400' 
                                  : 'bg-red-400/20 text-red-400'
                            }`}>
                              {governance.compliance}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-24 bg-slate-700 rounded-full h-1.5 mr-2">
                                <div 
                                  className={`h-1.5 rounded-full ${
                                    governance.quality >= 90 ? 'bg-green-400' : 
                                    governance.quality >= 70 ? 'bg-yellow-400' : 
                                    'bg-red-400'
                                  }`} 
                                  style={{ width: `${governance.quality}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-300">
                                {governance.quality}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {governance.lastAudit}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                        No tables match your filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab !== 'tables' && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center py-12">
            <h3 className="text-lg font-medium text-white mb-2">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Features Coming Soon
            </h3>
            <p className="text-slate-400 max-w-md mx-auto">
              This section is currently in development. Check back soon for updates on {activeTab} management features.
            </p>
          </div>
        )}
      </SafeComponent>
    </div>
  );
}