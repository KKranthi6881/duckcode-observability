import React, { useState } from 'react';
import { Clock, ArrowLeft, Filter, RefreshCw, ChevronDown, AlertTriangle, CheckCircle, Search, Calendar, Eye, Cpu, Database, AlertCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample data for freshness anomalies
const freshnessData = {
  summary: {
    totalTables: 128,
    monitoredTables: 112,
    tablesWithIssues: 15,
    criticalIssues: 6,
    avgDelayHours: 18.5
  },
  anomalies: [
    {
      id: 'fresh-001',
      tableName: 'raw_customer',
      expectedFreshness: '24h',
      currentDelay: '48h',
      status: 'critical',
      lastUpdated: '2023-07-20T08:45:00',
      trend: [5, 12, 18, 24, 36, 42, 48], // hours of delay over last 7 days
      affectedSystems: ['Sales Dashboard', 'Marketing Analytics'],
      owner: 'data-engineering',
      description: 'Table raw_customer has not been updated in 48 hours. Expected daily updates. This table is critical for daily sales reporting and downstream marketing analytics.'
    },
    {
      id: 'fresh-002',
      tableName: 'fct_orders',
      expectedFreshness: '12h',
      currentDelay: '18h',
      status: 'warning',
      lastUpdated: '2023-07-20T14:30:00',
      trend: [4, 6, 8, 10, 12, 15, 18], // hours of delay over last 7 days
      affectedSystems: ['Order Processing', 'Financial Reporting'],
      owner: 'data-engineering',
      description: 'Table fct_orders is experiencing increasing delays in updates. Currently 6 hours beyond SLA.'
    },
    {
      id: 'fresh-003',
      tableName: 'dim_products',
      expectedFreshness: '48h',
      currentDelay: '72h',
      status: 'critical',
      lastUpdated: '2023-07-19T09:15:00',
      trend: [12, 24, 36, 48, 54, 66, 72], // hours of delay over last 7 days
      affectedSystems: ['Product Catalog', 'Inventory Management'],
      owner: 'product-data',
      description: 'Product dimension table update is delayed by 24 hours beyond expected freshness threshold.'
    },
    {
      id: 'fresh-004',
      tableName: 'stg_transactions',
      expectedFreshness: '6h',
      currentDelay: '8h',
      status: 'warning',
      lastUpdated: '2023-07-20T16:20:00',
      trend: [2, 3, 4, 5, 6, 7, 8], // hours of delay over last 7 days
      affectedSystems: ['Transaction Processing'],
      owner: 'data-engineering',
      description: 'Staging table for transactions is showing a gradually increasing delay pattern.'
    },
    {
      id: 'fresh-005',
      tableName: 'raw_inventory',
      expectedFreshness: '24h',
      currentDelay: '36h',
      status: 'warning',
      lastUpdated: '2023-07-20T02:10:00',
      trend: [8, 12, 18, 24, 28, 32, 36], // hours of delay over last 7 days
      affectedSystems: ['Inventory Management', 'Supply Chain'],
      owner: 'inventory-team',
      description: 'Raw inventory data is delayed by 12 hours beyond expected update schedule.'
    }
  ],
  historicalTrends: {
    lastWeek: [8, 10, 12, 15, 14, 13, 15],
    lastMonth: [6, 7, 9, 10, 12, 14, 15, 13, 12, 11, 10, 12, 15, 14, 13, 12, 10, 9, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10, 12, 15]
  }
};

// Helper function to get the appropriate background color class
const getColorClass = (color) => {
  switch (color) {
    case 'sky': return 'bg-sky-100';
    case 'red': return 'bg-red-100';
    case 'yellow': return 'bg-yellow-100';
    case 'green': return 'bg-green-100';
    case 'purple': return 'bg-purple-100';
    case 'orange': return 'bg-orange-100';
    default: return 'bg-gray-100';
  }
};

// Helper components
const MetricCard = ({ title, value, subtext, icon, color }) => {
  const bgColorClass = getColorClass(color);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
        </div>
        <div className={`${bgColorClass} p-3 rounded-full`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const TrendIndicator = ({ trend }) => {
  // A simple visual representation of the trend
  const maxValue = Math.max(...trend);
  
  return (
    <div className="flex items-end h-8 space-x-0.5">
      {trend.map((value, index) => (
        <div 
          key={index}
          className={`w-1.5 rounded-t ${
            index === trend.length - 1 
              ? 'bg-red-500' 
              : index > trend.length - 3 
                ? 'bg-yellow-500' 
                : 'bg-gray-300'
          }`}
          style={{ height: `${(value / maxValue) * 100}%` }}
        ></div>
      ))}
    </div>
  );
};

export function AnomalyFreshness() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getStatusClass = (status) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'normal': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };
  
  const filteredAnomalies = freshnessData.anomalies.filter(anomaly => 
    anomaly.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    anomaly.description.toLowerCase().includes(searchTerm.toLowerCase())
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
              <Clock className="h-8 w-8 mr-3 text-sky-600" />
              Data Freshness Anomalies
            </h1>
            <p className="text-gray-600 mt-1">Monitor and resolve data freshness issues across your data assets</p>
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
          value={freshnessData.summary.totalTables} 
          icon={<Database className="h-6 w-6 text-sky-600" />} 
          color="sky"
        />
        <MetricCard 
          title="Monitored Tables" 
          value={freshnessData.summary.monitoredTables} 
          icon={<Eye className="h-6 w-6 text-purple-600" />} 
          color="purple"
          subtext={`${Math.round((freshnessData.summary.monitoredTables / freshnessData.summary.totalTables) * 100)}% coverage`}
        />
        <MetricCard 
          title="Tables with Issues" 
          value={freshnessData.summary.tablesWithIssues} 
          icon={<AlertTriangle className="h-6 w-6 text-yellow-600" />} 
          color="yellow"
        />
        <MetricCard 
          title="Critical Issues" 
          value={freshnessData.summary.criticalIssues} 
          icon={<AlertCircle className="h-6 w-6 text-red-600" />} 
          color="red"
        />
        <MetricCard 
          title="Avg. Delay" 
          value={`${freshnessData.summary.avgDelayHours}h`} 
          icon={<Clock className="h-6 w-6 text-orange-600" />} 
          color="orange"
        />
      </div>
      
      {/* Main content area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Anomalies table */}
        <div className={`w-full ${selectedAnomaly ? 'lg:w-2/3' : 'lg:w-full'} transition-all duration-300 ease-in-out`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700">Freshness Anomalies</h3>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Search tables..."
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
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Delay</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAnomalies.length > 0 ? (
                    filteredAnomalies.map((anomaly) => (
                      <tr 
                        key={anomaly.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${selectedAnomaly?.id === anomaly.id ? 'bg-sky-50' : ''}`}
                        onClick={() => setSelectedAnomaly(anomaly)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-start">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{anomaly.tableName}</div>
                              <div className="text-xs text-gray-500 truncate max-w-xs">{anomaly.description.substring(0, 60)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {anomaly.expectedFreshness}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          {anomaly.currentDelay}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusClass(anomaly.status)}`}>
                            {anomaly.status.charAt(0).toUpperCase() + anomaly.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <TrendIndicator trend={anomaly.trend} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(anomaly.lastUpdated)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        No freshness anomalies match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Selected anomaly detail panel */}
        {selectedAnomaly && (
          <div className="w-full lg:w-1/3 bg-white shadow-md rounded-lg p-6 space-y-6 border border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <Clock className="h-6 w-6 mr-2 text-sky-600" /> Freshness Details
              </h2>
              <button onClick={() => setSelectedAnomaly(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedAnomaly.tableName}</h3>
              <p className="text-sm text-gray-600 mb-3">{selectedAnomaly.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="block text-gray-500">Expected Freshness:</strong> 
                <span className="text-gray-700">{selectedAnomaly.expectedFreshness}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Current Delay:</strong> 
                <span className="text-red-600 font-semibold">{selectedAnomaly.currentDelay}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Status:</strong> 
                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusClass(selectedAnomaly.status)}`}>
                  {selectedAnomaly.status.charAt(0).toUpperCase() + selectedAnomaly.status.slice(1)}
                </span>
              </div>
              <div>
                <strong className="block text-gray-500">Last Updated:</strong> 
                <span className="text-gray-700">{formatDate(selectedAnomaly.lastUpdated)}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Owner:</strong> 
                <span className="text-gray-700">{selectedAnomaly.owner}</span>
              </div>
            </div>
            
            <div>
              <strong className="block text-sm text-gray-500 mb-1">Affected Systems:</strong>
              <div className="flex flex-wrap gap-2">
                {selectedAnomaly.affectedSystems.map(system => (
                  <span key={system} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200">{system}</span>
                ))}
              </div>
            </div>
            
            <div>
              <strong className="block text-sm text-gray-500 mb-2">Delay Trend (Last 7 Days):</strong>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="h-40 flex items-end justify-between">
                  {selectedAnomaly.trend.map((value, index) => {
                    let barColor = 'bg-green-500';
                    if (selectedAnomaly.expectedFreshness) {
                      const expectedHours = parseInt(selectedAnomaly.expectedFreshness);
                      if (value > expectedHours * 1.5) {
                        barColor = 'bg-red-500';
                      } else if (value > expectedHours) {
                        barColor = 'bg-yellow-500';
                      }
                    }
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <div 
                          className={`w-8 rounded-t ${barColor}`}
                          style={{ height: `${(value / Math.max(...selectedAnomaly.trend)) * 160}px` }}
                        ></div>
                        <span className="text-xs text-gray-500 mt-2">Day {index + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 text-center">
                  Hours of delay over the last 7 days
                </div>
              </div>
            </div>
            
            <div className="bg-sky-50 p-4 rounded-lg border border-sky-100">
              <strong className="block text-sm text-sky-700 mb-2 flex items-center">
                <Cpu className="h-4 w-4 mr-1.5" /> AI Recommendations:
              </strong>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Check the ETL pipeline for {selectedAnomaly.tableName}</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Verify source system availability</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Review recent changes to the data pipeline</span>
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
