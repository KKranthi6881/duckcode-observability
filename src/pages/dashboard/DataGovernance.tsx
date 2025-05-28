import React, { useState, useEffect } from 'react';
import { Shield, FileText, Users, Key, Settings, BarChart, AlertTriangle, CheckCircle, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { lineageModels, createCustomerLineage, createOrderLineage, TableNode } from './components/charts/lineageData';

// Simple error boundary component to catch rendering errors
const SafeComponent = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return fallback || (
      <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
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
    <div className="p-6 bg-gray-100 min-h-screen text-gray-900">
      <SafeComponent fallback={<p className="text-red-600">Error loading governance data.</p>}>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Data Governance</h1>
            <p className="text-gray-600 mt-1">Manage and monitor data governance policies and compliance.</p>
          </div>
          {/* Placeholder for potential global actions, e.g., Refresh button */}
        </div>

        {/* Tabs for different governance aspects */}
        <div className="mb-6">
          <div className="border-b border-gray-300">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {['tables', 'policies', 'access', 'quality_rules'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    ${activeTab === tab
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  `}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1).replace('_', ' ')}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === 'tables' && (
          <div className="space-y-6">
            {/* Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[ 
                { title: 'Total Tables', value: tableNodes.length, icon: FileText, color: 'sky' },
                { title: 'Tables with PII', value: tablesWithPii, icon: Key, color: 'orange' },
                { title: 'High Compliance', value: tableNodes.filter(node => governanceStatus[node.data.label] && governanceStatus[node.data.label].compliance === 'High').length, icon: CheckCircle, color: 'green' },
                { title: 'Needs Attention', value: tableNodes.length - Math.floor(avgQuality * tableNodes.length / 100), icon: AlertTriangle, color: 'red' },
              ].map(metric => (
                <div key={metric.title} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-500">{metric.title}</p>
                    <div className={`p-2 rounded-lg bg-${metric.color}-100`}>
                      <metric.icon className={`h-5 w-5 text-${metric.color}-600`} />
                    </div>
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-gray-800">{metric.value}</p>
                </div>
              ))}
            </div>

            {/* Filters and Search */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                <div className="relative w-full sm:max-w-xs">
                  <input 
                    type="text"
                    placeholder="Search tables..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-900 placeholder-gray-500 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {showFilters ? <ChevronUp className="h-4 w-4 ml-1.5" /> : <ChevronDown className="h-4 w-4 ml-1.5" />}
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <label htmlFor="complianceFilter" className="block text-sm font-medium text-gray-700 mb-1">Compliance Status</label>
                    <select 
                      id="complianceFilter"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-900 bg-white"
                      value={complianceFilter}
                      onChange={(e) => setComplianceFilter(e.target.value)}
                    >
                      {['All', 'High', 'Medium', 'Low'].map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  {/* Add more filters here if needed, e.g., PII status, Owner */}
                </div>
              )}
            </div>

            {/* Tables List */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Table Name', 'Owner', 'Type', 'PII', 'Compliance', 'Quality Score', 'Last Audit'].map(header => (
                      <th key={header} scope="col" className="px-6 py-3.5 text-left text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTables.length > 0 ? (
                    filteredTables.map(table => {
                      const governance = governanceStatus[table.data.label] || { owner: 'N/A', compliance: 'N/A', pii: false, quality: 0, lastAudit: 'N/A' };
                      return (
                        <tr key={table.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`p-2 rounded-md mr-3 bg-${table.data.type === 'source' ? 'blue' : table.data.type === 'staging' ? 'purple' : 'teal'}-100`}>
                                <FileText className={`h-5 w-5 text-${table.data.type === 'source' ? 'blue' : table.data.type === 'staging' ? 'purple' : 'teal'}-600`} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {table.data.label}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {table.data.description ? table.data.description.substring(0, 60) + (table.data.description.length > 60 ? '...' : '') : 'No description'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {governance.owner}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                            {table.data.type || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {governance.pii ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                Yes
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${ 
                              governance.compliance === 'High' 
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : governance.compliance === 'Medium' 
                                  ? 'bg-yellow-100 text-yellow-700 border-yellow-200' 
                                  : 'bg-red-100 text-red-700 border-red-200'
                            }`}>
                              {governance.compliance}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className={`h-2 rounded-full ${ 
                                    governance.quality >= 90 ? 'bg-green-500' : 
                                    governance.quality >= 70 ? 'bg-yellow-500' : 
                                    'bg-red-500'
                                  }`} 
                                  style={{ width: `${governance.quality}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">
                                {governance.quality}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {governance.lastAudit}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                        No tables match your filters. Try adjusting your search or filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab !== 'tables' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center py-12">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-sky-100 mb-4">
              <Settings className="h-6 w-6 text-sky-600" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('_', ' ')} Features Coming Soon
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              This section is currently under development. Check back soon for updates on {activeTab.replace('_', ' ')} management features.
            </p>
          </div>
        )}
      </SafeComponent>
    </div>
  );
}