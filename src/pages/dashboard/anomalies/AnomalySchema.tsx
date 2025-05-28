import React, { useState } from 'react';
import { FileText, ArrowLeft, Filter, RefreshCw, ChevronDown, AlertTriangle, CheckCircle, Search, Eye, Cpu, Database, AlertCircle, X, Plus, Minus, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample data for schema changes
const schemaData = {
  summary: {
    totalTables: 128,
    monitoredTables: 112,
    schemaChanges: 18,
    breakingChanges: 5,
    affectedSystems: 8
  },
  changes: [
    {
      id: 'schema-001',
      tableName: 'raw_orders',
      changeType: 'column-added',
      changeDetails: 'Added column "discount_code" (VARCHAR(50))',
      impact: 'low',
      status: 'info',
      detectedAt: '2023-07-19T14:30:00',
      before: {
        columns: ['order_id', 'customer_id', 'order_date', 'total_amount', 'status']
      },
      after: {
        columns: ['order_id', 'customer_id', 'order_date', 'total_amount', 'status', 'discount_code']
      },
      affectedSystems: ['Order Processing'],
      owner: 'data-engineering',
      description: 'New column "discount_code" added to raw_orders table to track promotional discounts.'
    },
    {
      id: 'schema-002',
      tableName: 'dim_products',
      changeType: 'column-removed',
      changeDetails: 'Removed column "manufacturer_code"',
      impact: 'high',
      status: 'critical',
      detectedAt: '2023-07-19T10:15:00',
      before: {
        columns: ['product_id', 'product_name', 'category', 'price', 'manufacturer_code', 'created_at']
      },
      after: {
        columns: ['product_id', 'product_name', 'category', 'price', 'created_at']
      },
      affectedSystems: ['Product Catalog', 'Inventory Management', 'Supplier Portal'],
      owner: 'product-data',
      description: 'Column "manufacturer_code" was removed from dim_products table. This field was used by several downstream systems.'
    },
    {
      id: 'schema-003',
      tableName: 'fct_user_activity',
      changeType: 'type-changed',
      changeDetails: 'Changed "session_duration" from INT to FLOAT',
      impact: 'medium',
      status: 'warning',
      detectedAt: '2023-07-18T16:45:00',
      before: {
        columns: ['activity_id', 'user_id', 'activity_type', 'session_duration', 'timestamp']
      },
      after: {
        columns: ['activity_id', 'user_id', 'activity_type', 'session_duration', 'timestamp']
      },
      columnChanges: {
        'session_duration': {
          before: 'INT',
          after: 'FLOAT'
        }
      },
      affectedSystems: ['User Analytics', 'Performance Monitoring'],
      owner: 'analytics-team',
      description: 'Data type of "session_duration" changed from INT to FLOAT to capture more precise session timing.'
    },
    {
      id: 'schema-004',
      tableName: 'raw_customer',
      changeType: 'constraint-added',
      changeDetails: 'Added NOT NULL constraint to "email"',
      impact: 'medium',
      status: 'warning',
      detectedAt: '2023-07-18T11:30:00',
      before: {
        columns: ['customer_id', 'first_name', 'last_name', 'email', 'phone', 'created_at']
      },
      after: {
        columns: ['customer_id', 'first_name', 'last_name', 'email', 'phone', 'created_at']
      },
      columnChanges: {
        'email': {
          before: 'VARCHAR(100)',
          after: 'VARCHAR(100) NOT NULL'
        }
      },
      affectedSystems: ['Customer Management', 'Marketing Automation'],
      owner: 'data-engineering',
      description: 'Added NOT NULL constraint to "email" column in raw_customer table. This may cause issues with existing ETL processes if they attempt to insert records with null email values.'
    },
    {
      id: 'schema-005',
      tableName: 'stg_transactions',
      changeType: 'column-added',
      changeDetails: 'Added column "payment_method" (VARCHAR(50))',
      impact: 'low',
      status: 'info',
      detectedAt: '2023-07-17T09:20:00',
      before: {
        columns: ['transaction_id', 'order_id', 'amount', 'status', 'timestamp']
      },
      after: {
        columns: ['transaction_id', 'order_id', 'amount', 'status', 'timestamp', 'payment_method']
      },
      affectedSystems: ['Payment Processing'],
      owner: 'finance-team',
      description: 'New column "payment_method" added to stg_transactions table to track the payment method used for each transaction.'
    }
  ]
};

// Helper components
const MetricCard = ({ title, value, subtext, icon, color }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
        </div>
        <div className={`bg-${color}-100 p-3 rounded-full`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const getChangeTypeIcon = (type) => {
  switch (type) {
    case 'column-added': return <Plus className="h-4 w-4 text-green-600" />;
    case 'column-removed': return <Minus className="h-4 w-4 text-red-600" />;
    case 'type-changed': return <Edit className="h-4 w-4 text-yellow-600" />;
    case 'constraint-added': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'constraint-removed': return <AlertTriangle className="h-4 w-4 text-purple-600" />;
    default: return <FileText className="h-4 w-4 text-gray-600" />;
  }
};

const getImpactClass = (impact) => {
  switch (impact) {
    case 'high': return 'bg-red-100 text-red-700 border-red-300';
    case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'low': return 'bg-green-100 text-green-700 border-green-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

const getStatusClass = (status) => {
  switch (status) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-300';
    case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    case 'info': return 'bg-sky-100 text-sky-700 border-sky-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

export function AnomalySchema() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChange, setSelectedChange] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const filteredChanges = schemaData.changes.filter(change => 
    change.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    change.changeDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
    change.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-6 lg:p-8">
      {/* Header with back button */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <Link to="/dashboard/anomalies" className="inline-flex items-center text-sky-600 hover:text-sky-800 mb-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Anomaly Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FileText className="h-8 w-8 mr-3 text-green-600" />
              Schema Changes
            </h1>
            <p className="text-gray-600 mt-1">Monitor and analyze schema changes across your data assets</p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-2">
            <div className="relative">
              <select
                className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
            <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>
        </div>
      </div>
      
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
        <MetricCard 
          title="Total Tables" 
          value={schemaData.summary.totalTables} 
          icon={<Database className="h-6 w-6 text-sky-600" />} 
          color="sky"
        />
        <MetricCard 
          title="Monitored Tables" 
          value={schemaData.summary.monitoredTables} 
          icon={<Eye className="h-6 w-6 text-purple-600" />} 
          color="purple"
          subtext={`${Math.round((schemaData.summary.monitoredTables / schemaData.summary.totalTables) * 100)}% coverage`}
        />
        <MetricCard 
          title="Schema Changes" 
          value={schemaData.summary.schemaChanges} 
          icon={<FileText className="h-6 w-6 text-green-600" />} 
          color="green"
        />
        <MetricCard 
          title="Breaking Changes" 
          value={schemaData.summary.breakingChanges} 
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />} 
          color="red"
        />
        <MetricCard 
          title="Affected Systems" 
          value={schemaData.summary.affectedSystems} 
          icon={<AlertCircle className="h-6 w-6 text-orange-600" />} 
          color="orange"
        />
      </div>
      
      {/* Main content area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Schema changes table */}
        <div className={`w-full ${selectedChange ? 'lg:w-2/3' : 'lg:w-full'} transition-all duration-300 ease-in-out`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700">Schema Changes</h3>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Search tables or changes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change Type</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impact</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detected</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredChanges.length > 0 ? (
                    filteredChanges.map((change) => (
                      <tr 
                        key={change.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${selectedChange?.id === change.id ? 'bg-sky-50' : ''}`}
                        onClick={() => setSelectedChange(change)}
                      >
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">{change.tableName}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="mr-2">{getChangeTypeIcon(change.changeType)}</div>
                            <span className="text-sm text-gray-700 capitalize">{change.changeType.replace('-', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {change.changeDetails}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getImpactClass(change.impact)}`}>
                            {change.impact.charAt(0).toUpperCase() + change.impact.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusClass(change.status)}`}>
                            {change.status.charAt(0).toUpperCase() + change.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(change.detectedAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        No schema changes match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Selected change detail panel */}
        {selectedChange && (
          <div className="w-full lg:w-1/3 bg-white shadow-md rounded-lg p-6 space-y-6 border border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <FileText className="h-6 w-6 mr-2 text-green-600" /> Schema Change Details
              </h2>
              <button onClick={() => setSelectedChange(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedChange.tableName}</h3>
              <p className="text-sm text-gray-600 mb-3">{selectedChange.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="block text-gray-500">Change Type:</strong> 
                <span className="text-gray-700 capitalize">{selectedChange.changeType.replace('-', ' ')}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Details:</strong> 
                <span className="text-gray-700">{selectedChange.changeDetails}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Impact:</strong> 
                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getImpactClass(selectedChange.impact)}`}>
                  {selectedChange.impact.charAt(0).toUpperCase() + selectedChange.impact.slice(1)}
                </span>
              </div>
              <div>
                <strong className="block text-gray-500">Status:</strong> 
                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusClass(selectedChange.status)}`}>
                  {selectedChange.status.charAt(0).toUpperCase() + selectedChange.status.slice(1)}
                </span>
              </div>
              <div>
                <strong className="block text-gray-500">Detected:</strong> 
                <span className="text-gray-700">{formatDate(selectedChange.detectedAt)}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Owner:</strong> 
                <span className="text-gray-700">{selectedChange.owner}</span>
              </div>
            </div>
            
            <div>
              <strong className="block text-sm text-gray-500 mb-1">Affected Systems:</strong>
              <div className="flex flex-wrap gap-2">
                {selectedChange.affectedSystems.map(system => (
                  <span key={system} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200">{system}</span>
                ))}
              </div>
            </div>
            
            <div>
              <strong className="block text-sm text-gray-500 mb-2">Schema Comparison:</strong>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Before</span>
                  <span className="text-xs font-medium text-gray-500">After</span>
                </div>
                
                <div className="flex">
                  <div className="flex-1 pr-2 border-r border-gray-200">
                    <ul className="space-y-1">
                      {selectedChange.before.columns.map(column => {
                        const isChanged = selectedChange.columnChanges && selectedChange.columnChanges[column];
                        const isRemoved = !selectedChange.after.columns.includes(column);
                        
                        return (
                          <li 
                            key={`before-${column}`} 
                            className={`text-sm py-1 px-2 rounded ${
                              isRemoved ? 'bg-red-50 text-red-700' : 
                              isChanged ? 'bg-yellow-50 text-yellow-700' : 
                              'text-gray-700'
                            }`}
                          >
                            {column}
                            {isChanged && (
                              <span className="text-xs block text-gray-500">
                                {selectedChange.columnChanges[column].before}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  
                  <div className="flex-1 pl-2">
                    <ul className="space-y-1">
                      {selectedChange.after.columns.map(column => {
                        const isChanged = selectedChange.columnChanges && selectedChange.columnChanges[column];
                        const isAdded = !selectedChange.before.columns.includes(column);
                        
                        return (
                          <li 
                            key={`after-${column}`} 
                            className={`text-sm py-1 px-2 rounded ${
                              isAdded ? 'bg-green-50 text-green-700' : 
                              isChanged ? 'bg-yellow-50 text-yellow-700' : 
                              'text-gray-700'
                            }`}
                          >
                            {column}
                            {isChanged && (
                              <span className="text-xs block text-gray-500">
                                {selectedChange.columnChanges[column].after}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-sky-50 p-4 rounded-lg border border-sky-100">
              <strong className="block text-sm text-sky-700 mb-2 flex items-center">
                <Cpu className="h-4 w-4 mr-1.5" /> Impact Analysis:
              </strong>
              <p className="text-sm text-gray-700 mb-3">
                {selectedChange.impact === 'high' && 'This change may break downstream processes that depend on the removed or modified schema elements.'}
                {selectedChange.impact === 'medium' && 'This change could affect some downstream processes, but most systems should be able to adapt.'}
                {selectedChange.impact === 'low' && 'This change is unlikely to cause issues with downstream processes.'}
              </p>
              <strong className="block text-sm text-sky-700 mb-2 flex items-center mt-3">
                <Cpu className="h-4 w-4 mr-1.5" /> Recommendations:
              </strong>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">
                    {selectedChange.changeType === 'column-added' && 'Ensure new column has appropriate default values for existing data'}
                    {selectedChange.changeType === 'column-removed' && 'Check all downstream processes that may reference this column'}
                    {selectedChange.changeType === 'type-changed' && 'Verify data type compatibility in all consuming applications'}
                    {selectedChange.changeType === 'constraint-added' && 'Validate existing data against the new constraint'}
                    {selectedChange.changeType === 'constraint-removed' && 'Review if data quality might be affected by removing this constraint'}
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Update documentation to reflect the schema changes</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Notify teams responsible for affected systems</span>
                </li>
              </ul>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button 
                className="w-full flex items-center justify-center bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold py-3 px-4 rounded-lg text-sm transition-all duration-150 shadow-sm hover:shadow mb-3"
              >
                <Cpu className="h-5 w-5 mr-2" /> Ask AI Assistant for Help
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
