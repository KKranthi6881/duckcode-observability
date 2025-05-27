import React, { useState } from 'react';
import { Search, Filter, Bell, AlertTriangle, Clock, CheckCircle, ChevronDown, ChevronUp, Calendar, BarChart4, PieChart, RefreshCw } from 'lucide-react';

// Sample alerts data
const alertsData = [{
  id: 1,
  title: 'Data freshness threshold exceeded',
  description: 'Table raw_customer has not been updated in 48 hours. Expected daily updates.',
  severity: 'high',
  status: 'open',
  type: 'freshness',
  source: 'raw_customer',
  created: '2023-07-20T08:45:00',
  assignee: null
}, {
  id: 2,
  title: 'Anomaly detected in order values',
  description: 'Unusual spike in order values detected in the last 6 hours. 95% above normal range.',
  severity: 'medium',
  status: 'investigating',
  type: 'anomaly',
  source: 'fct_orders',
  created: '2023-07-20T10:15:00',
  assignee: 'alex.smith'
}, {
  id: 3,
  title: 'Schema change detected',
  description: 'New column "discount_code" added to raw_orders table.',
  severity: 'low',
  status: 'resolved',
  type: 'schema',
  source: 'raw_orders',
  created: '2023-07-19T14:30:00',
  assignee: 'sarah.johnson',
  resolved: '2023-07-19T16:45:00',
  resolution: 'Column added to downstream models and documented'
}, {
  id: 4,
  title: 'Data quality check failed',
  description: 'Unique constraint violation in customer_id column. 15 duplicate values detected.',
  severity: 'high',
  status: 'open',
  type: 'quality',
  source: 'stg_customers',
  created: '2023-07-19T09:20:00',
  assignee: null
}, {
  id: 5,
  title: 'Missing values threshold exceeded',
  description: 'Column "email" in stg_customers has 15% null values, exceeding the 5% threshold.',
  severity: 'medium',
  status: 'resolved',
  type: 'quality',
  source: 'stg_customers',
  created: '2023-07-18T11:35:00',
  assignee: 'mike.brown',
  resolved: '2023-07-18T17:10:00',
  resolution: 'Added data validation rules in ETL process'
}, {
  id: 6,
  title: 'Pipeline execution failed',
  description: 'ETL job for daily order aggregation failed due to timeout.',
  severity: 'high',
  status: 'resolved',
  type: 'pipeline',
  source: 'daily_order_aggregation',
  created: '2023-07-17T07:15:00',
  assignee: 'alex.smith',
  resolved: '2023-07-17T09:30:00',
  resolution: 'Increased timeout limit and optimized query'
}];

// Filter options
const severityOptions = ['All', 'High', 'Medium', 'Low'];
const statusOptions = ['All', 'Open', 'Investigating', 'Resolved'];
const typeOptions = ['All', 'Freshness', 'Anomaly', 'Schema', 'Quality', 'Pipeline'];

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

// Simplified chart component that won't cause rendering issues
const SimpleChart = ({ type, data }) => {
  if (type === 'pie') {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex space-x-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex flex-col items-center">
              <div 
                className={`h-16 w-16 rounded-full ${
                  key === 'open' ? 'bg-red-400' : 
                  key === 'investigating' ? 'bg-yellow-400' : 
                  'bg-green-400'
                }`}
              />
              <p className="text-sm text-slate-300 mt-2">{key}</p>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (type === 'bar') {
    return (
      <div className="space-y-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300 capitalize">{key}</span>
              <span className="text-slate-400">{value}</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  key === 'freshness' ? 'bg-blue-400' : 
                  key === 'anomaly' ? 'bg-purple-400' : 
                  key === 'schema' ? 'bg-orange-400' : 
                  key === 'quality' ? 'bg-pink-400' : 
                  'bg-indigo-400'
                }`} 
                style={{
                  width: `${(value / Object.values(data).reduce((a, b) => a + b, 0)) * 100}%`
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return null;
};

export function DataAlerts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter alerts based on search term and filters
  const filteredAlerts = alertsData.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        alert.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        alert.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'All' || alert.severity.toLowerCase() === selectedSeverity.toLowerCase();
    const matchesStatus = selectedStatus === 'All' || alert.status.toLowerCase() === selectedStatus.toLowerCase();
    const matchesType = selectedType === 'All' || alert.type.toLowerCase() === selectedType.toLowerCase();
    return matchesSearch && matchesSeverity && matchesStatus && matchesType;
  });

  // Group metrics by type
  const alertMetrics = {
    total: alertsData.length,
    open: alertsData.filter(a => a.status === 'open').length,
    investigating: alertsData.filter(a => a.status === 'investigating').length,
    resolved: alertsData.filter(a => a.status === 'resolved').length,
    byType: {
      freshness: alertsData.filter(a => a.type === 'freshness').length,
      anomaly: alertsData.filter(a => a.type === 'anomaly').length,
      schema: alertsData.filter(a => a.type === 'schema').length,
      quality: alertsData.filter(a => a.type === 'quality').length,
      pipeline: alertsData.filter(a => a.type === 'pipeline').length
    }
  };

  // Simplified date formatting function to avoid potential issues
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return dateString; // Return the raw string if there's an error
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Data Alerts</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search alerts..." 
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
          <button className="flex items-center px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-300 hover:bg-slate-600">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Metrics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Alerts</p>
              <p className="text-2xl font-semibold text-white mt-1">
                {alertMetrics.total}
              </p>
            </div>
            <Bell className="h-8 w-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Open</p>
              <p className="text-2xl font-semibold text-red-400 mt-1">
                {alertMetrics.open}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Investigating</p>
              <p className="text-2xl font-semibold text-yellow-400 mt-1">
                {alertMetrics.investigating}
              </p>
            </div>
            <Clock className="h-8 w-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Resolved</p>
              <p className="text-2xl font-semibold text-green-400 mt-1">
                {alertMetrics.resolved}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-slate-600" />
          </div>
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Severity
              </label>
              <div className="flex flex-wrap gap-2">
                {severityOptions.map(option => (
                  <button 
                    key={option} 
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      selectedSeverity === option 
                        ? 'bg-[#2AB7A9] text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    onClick={() => setSelectedSeverity(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(option => (
                  <button 
                    key={option} 
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      selectedStatus === option 
                        ? 'bg-[#2AB7A9] text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    onClick={() => setSelectedStatus(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map(option => (
                  <button 
                    key={option} 
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      selectedType === option 
                        ? 'bg-[#2AB7A9] text-white' 
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    onClick={() => setSelectedType(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Charts - Wrapped in SafeComponent */}
        <div className="lg:col-span-1">
          <div className="space-y-6">
            <SafeComponent
              fallback={
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 text-center py-12">
                  <p className="text-slate-400">Charts temporarily unavailable</p>
                </div>
              }
            >
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white">
                    Alerts by Status
                  </h3>
                  <PieChart className="h-4 w-4 text-slate-400" />
                </div>
                <SimpleChart
                  type="pie"
                  data={{
                    open: alertMetrics.open,
                    investigating: alertMetrics.investigating,
                    resolved: alertMetrics.resolved
                  }}
                />
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-red-400 mr-2"></div>
                    <span className="text-xs text-slate-300">
                      Open ({alertMetrics.open})
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-yellow-400 mr-2"></div>
                    <span className="text-xs text-slate-300">
                      Investigating ({alertMetrics.investigating})
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="h-3 w-3 rounded-full bg-green-400 mr-2"></div>
                    <span className="text-xs text-slate-300">
                      Resolved ({alertMetrics.resolved})
                    </span>
                  </div>
                </div>
              </div>
            </SafeComponent>
            
            <SafeComponent>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white">
                    Alerts by Type
                  </h3>
                  <BarChart4 className="h-4 w-4 text-slate-400" />
                </div>
                <SimpleChart
                  type="bar"
                  data={alertMetrics.byType}
                />
              </div>
            </SafeComponent>
            
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white">
                  Recent Activity
                </h3>
                <Calendar className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="h-8 w-8 rounded-full bg-green-400/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs text-slate-300">
                      Alert #3 was resolved by sarah.johnson
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">1 day ago</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="h-8 w-8 rounded-full bg-yellow-400/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 text-yellow-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs text-slate-300">
                      Alert #2 is being investigated by alex.smith
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">1 day ago</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="h-8 w-8 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs text-slate-300">
                      New alert created for raw_customer
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">1 day ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Alerts List and Details */}
        <div className="lg:col-span-2">
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden h-full">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-medium text-white">
                {selectedAlert ? 'Alert Details' : 'Alerts'}
                <span className="ml-2 text-sm text-slate-400">
                  ({filteredAlerts.length})
                </span>
              </h3>
            </div>
            
            {selectedAlert ? (
              <div className="p-6">
                <button 
                  className="flex items-center text-sm text-slate-400 hover:text-white mb-6" 
                  onClick={() => setSelectedAlert(null)}
                >
                  <ChevronDown className="h-4 w-4 mr-1 rotate-90" />
                  Back to alerts
                </button>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-medium text-white">
                    {selectedAlert.title}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedAlert.status === 'open' 
                      ? 'bg-red-400/20 text-red-400' 
                      : selectedAlert.status === 'investigating' 
                        ? 'bg-yellow-400/20 text-yellow-400' 
                        : 'bg-green-400/20 text-green-400'
                  }`}>
                    {selectedAlert.status.charAt(0).toUpperCase() + selectedAlert.status.slice(1)}
                  </span>
                </div>
                <p className="mt-4 text-slate-300">
                  {selectedAlert.description}
                </p>
                <div className="grid grid-cols-2 gap-6 mt-8">
                  <div>
                    <p className="text-sm text-slate-400">Source</p>
                    <p className="text-white mt-1">{selectedAlert.source}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Created</p>
                    <p className="text-white mt-1">
                      {formatDate(selectedAlert.created)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Type</p>
                    <p className="text-white mt-1 capitalize">
                      {selectedAlert.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Severity</p>
                    <p className="text-white mt-1 capitalize">
                      {selectedAlert.severity}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Assignee</p>
                    <p className="text-white mt-1">
                      {selectedAlert.assignee || 'Unassigned'}
                    </p>
                  </div>
                  {selectedAlert.resolved && (
                    <div>
                      <p className="text-sm text-slate-400">Resolved</p>
                      <p className="text-white mt-1">
                        {formatDate(selectedAlert.resolved)}
                      </p>
                    </div>
                  )}
                </div>
                
                {selectedAlert.resolution && (
                  <div className="mt-8">
                    <p className="text-sm text-slate-400">Resolution</p>
                    <div className="mt-2 p-4 bg-slate-700 rounded-lg">
                      <p className="text-slate-300">
                        {selectedAlert.resolution}
                      </p>
                    </div>
                  </div>
                )}
                
                {selectedAlert.status !== 'resolved' && (
                  <div className="mt-8 flex space-x-4">
                    <button className="px-4 py-2 bg-[#2AB7A9] text-white rounded-md hover:bg-[#2AB7A9]/90">
                      {selectedAlert.status === 'open' ? 'Investigate' : 'Resolve'}
                    </button>
                    <button className="px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600">
                      Assign
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto h-[600px]">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-800">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Alert
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Source
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredAlerts.length > 0 ? (
                      filteredAlerts.map(alert => (
                        <tr 
                          key={alert.id} 
                          className="hover:bg-slate-700/50 cursor-pointer" 
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-start">
                              {alert.severity === 'high' && (
                                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                              )}
                              {alert.severity === 'medium' && (
                                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
                              )}
                              {alert.severity === 'low' && (
                                <AlertTriangle className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {alert.title}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {alert.description.substring(0, 60)}...
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {alert.source}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              alert.status === 'open' 
                                ? 'bg-red-400/20 text-red-400' 
                                : alert.status === 'investigating' 
                                  ? 'bg-yellow-400/20 text-yellow-400' 
                                  : 'bg-green-400/20 text-green-400'
                            }`}>
                              {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {formatDate(alert.created)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                          No alerts match your filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}