import React, { useState } from 'react';
import { TrendingDown, TrendingUp, ArrowLeft, Filter, RefreshCw, ChevronDown, AlertTriangle, CheckCircle, Search, Calendar, Eye, Cpu, Database, AlertCircle, X, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample data for volume anomalies
const volumeData = {
  summary: {
    totalTables: 128,
    monitoredTables: 112,
    tablesWithIssues: 9,
    criticalIssues: 4,
    avgVolumeChange: -32.5
  },
  anomalies: [
    {
      id: 'vol-001',
      tableName: 'dim_products',
      expectedRecords: '15,000',
      currentRecords: '3,750',
      changePercent: -75,
      status: 'critical',
      lastUpdated: '2023-07-19T09:20:00',
      trend: [14800, 14950, 15100, 14900, 15050, 14800, 3750], // record count over last 7 days
      affectedSystems: ['Product Catalog', 'Inventory Management'],
      owner: 'product-data',
      description: '75% decrease in daily records for dim_products. This significant drop may indicate a data pipeline issue or source system problem.'
    },
    {
      id: 'vol-002',
      tableName: 'fct_orders',
      expectedRecords: '25,000',
      currentRecords: '42,500',
      changePercent: 70,
      status: 'warning',
      lastUpdated: '2023-07-20T10:15:00',
      trend: [24500, 25200, 24800, 25100, 26500, 32000, 42500], // record count over last 7 days
      affectedSystems: ['Order Processing', 'Financial Reporting'],
      owner: 'data-engineering',
      description: 'Unexpected 70% increase in order records. This could indicate a data duplication issue or a genuine spike in business activity.'
    },
    {
      id: 'vol-003',
      tableName: 'raw_customer',
      expectedRecords: '120,000',
      currentRecords: '65,000',
      changePercent: -46,
      status: 'critical',
      lastUpdated: '2023-07-20T08:45:00',
      trend: [118000, 119500, 121000, 120500, 118000, 90000, 65000], // record count over last 7 days
      affectedSystems: ['Sales Dashboard', 'Marketing Analytics'],
      owner: 'data-engineering',
      description: 'Significant drop in customer records. This could indicate a partial data load or source system issue.'
    },
    {
      id: 'vol-004',
      tableName: 'stg_transactions',
      expectedRecords: '50,000',
      currentRecords: '48,500',
      changePercent: -3,
      status: 'info',
      lastUpdated: '2023-07-20T16:20:00',
      trend: [49800, 50200, 49900, 50100, 49700, 49200, 48500], // record count over last 7 days
      affectedSystems: ['Transaction Processing'],
      owner: 'data-engineering',
      description: 'Minor decrease in transaction records, within normal variation range.'
    },
    {
      id: 'vol-005',
      tableName: 'raw_inventory',
      expectedRecords: '8,000',
      currentRecords: '12,800',
      changePercent: 60,
      status: 'warning',
      lastUpdated: '2023-07-20T02:10:00',
      trend: [7900, 8100, 8050, 7950, 8200, 9500, 12800], // record count over last 7 days
      affectedSystems: ['Inventory Management', 'Supply Chain'],
      owner: 'inventory-team',
      description: 'Significant increase in inventory records. Possible new product additions or data duplication.'
    }
  ],
  historicalTrends: {
    lastWeek: [5, 3, 4, 6, 7, 8, 9],
    lastMonth: [3, 4, 5, 4, 3, 5, 6, 7, 6, 5, 4, 5, 6, 7, 8, 7, 6, 5, 6, 7, 8, 9, 8, 7, 6, 5, 6, 7, 8, 9]
  }
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

const TrendIndicator = ({ trend, isPercentage = false }) => {
  // A simple visual representation of the trend
  const maxValue = Math.max(...trend);
  const minValue = Math.min(...trend);
  const range = maxValue - minValue;
  
  return (
    <div className="flex items-end h-8 space-x-0.5">
      {trend.map((value, index) => {
        const normalizedHeight = range === 0 ? 50 : ((value - minValue) / range) * 100;
        const isLastDay = index === trend.length - 1;
        const isSignificantDrop = isLastDay && value < trend[0] * 0.8;
        const isSignificantIncrease = isLastDay && value > trend[0] * 1.2;
        
        return (
          <div 
            key={index}
            className={`w-1.5 rounded-t ${
              isSignificantDrop
                ? 'bg-red-500' 
                : isSignificantIncrease
                  ? 'bg-orange-400' 
                  : 'bg-sky-400'
            }`}
            style={{ height: `${normalizedHeight}%` }}
          />
        );
      })}
    </div>
  );
};

export function AnomalyVolume() {
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
      case 'info': return 'bg-sky-100 text-sky-700 border-sky-300';
      case 'normal': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };
  
  const getChangeIndicator = (changePercent) => {
    if (changePercent > 0) {
      return (
        <span className="flex items-center text-orange-600">
          <TrendingUp className="h-4 w-4 mr-1" /> +{changePercent}%
        </span>
      );
    } else if (changePercent < 0) {
      return (
        <span className="flex items-center text-red-600">
          <TrendingDown className="h-4 w-4 mr-1" /> {changePercent}%
        </span>
      );
    }
    return <span className="text-gray-500">0%</span>;
  };
  
  const filteredAnomalies = volumeData.anomalies.filter(anomaly => 
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
              <BarChart2 className="h-8 w-8 mr-3 text-purple-600" />
              Data Volume Anomalies
            </h1>
            <p className="text-gray-600 mt-1">Monitor and analyze unexpected changes in data volume across your tables</p>
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
          value={volumeData.summary.totalTables} 
          icon={<Database className="h-6 w-6 text-sky-600" />} 
          color="sky"
        />
        <MetricCard 
          title="Monitored Tables" 
          value={volumeData.summary.monitoredTables} 
          icon={<Eye className="h-6 w-6 text-purple-600" />} 
          color="purple"
          subtext={`${Math.round((volumeData.summary.monitoredTables / volumeData.summary.totalTables) * 100)}% coverage`}
        />
        <MetricCard 
          title="Tables with Issues" 
          value={volumeData.summary.tablesWithIssues} 
          icon={<AlertTriangle className="h-6 w-6 text-yellow-600" />} 
          color="yellow"
        />
        <MetricCard 
          title="Critical Issues" 
          value={volumeData.summary.criticalIssues} 
          icon={<AlertCircle className="h-6 w-6 text-red-600" />} 
          color="red"
        />
        <MetricCard 
          title="Avg. Volume Change" 
          value={`${volumeData.summary.avgVolumeChange}%`} 
          icon={<TrendingDown className="h-6 w-6 text-orange-600" />} 
          color="orange"
        />
      </div>
      
      {/* Main content area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Anomalies table */}
        <div className={`w-full ${selectedAnomaly ? 'lg:w-2/3' : 'lg:w-full'} transition-all duration-300 ease-in-out`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700">Volume Anomalies</h3>
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
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
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
                          {anomaly.expectedRecords}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {anomaly.currentRecords}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          {getChangeIndicator(anomaly.changePercent)}
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
                      <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                        No volume anomalies match your search criteria.
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
                <BarChart2 className="h-6 w-6 mr-2 text-purple-600" /> Volume Details
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
                <strong className="block text-gray-500">Expected Records:</strong> 
                <span className="text-gray-700">{selectedAnomaly.expectedRecords}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Current Records:</strong> 
                <span className="text-gray-900 font-semibold">{selectedAnomaly.currentRecords}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Change:</strong> 
                <span className={selectedAnomaly.changePercent > 0 ? 'text-orange-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {selectedAnomaly.changePercent > 0 ? '+' : ''}{selectedAnomaly.changePercent}%
                </span>
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
              <strong className="block text-sm text-gray-500 mb-2">Volume Trend (Last 7 Days):</strong>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="h-40 flex items-end justify-between">
                  {selectedAnomaly.trend.map((value, index) => {
                    const maxValue = Math.max(...selectedAnomaly.trend);
                    const minValue = Math.min(...selectedAnomaly.trend);
                    const range = maxValue - minValue;
                    const normalizedHeight = range === 0 ? 50 : ((value - minValue) / range) * 160;
                    
                    // Determine color based on comparison to expected
                    const expectedValue = parseInt(selectedAnomaly.expectedRecords.replace(/,/g, ''));
                    const deviation = Math.abs((value - expectedValue) / expectedValue) * 100;
                    
                    let barColor = 'bg-green-500';
                    if (deviation > 50) {
                      barColor = 'bg-red-500';
                    } else if (deviation > 20) {
                      barColor = 'bg-yellow-500';
                    } else if (deviation > 10) {
                      barColor = 'bg-orange-400';
                    }
                    
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <div 
                          className={`w-8 rounded-t ${barColor}`}
                          style={{ height: `${normalizedHeight}px` }}
                        ></div>
                        <span className="text-xs text-gray-500 mt-2">Day {index + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 text-center">
                  Record count over the last 7 days
                </div>
              </div>
            </div>
            
            <div className="bg-sky-50 p-4 rounded-lg border border-sky-100">
              <strong className="block text-sm text-sky-700 mb-2 flex items-center">
                <Cpu className="h-4 w-4 mr-1.5" /> AI Analysis:
              </strong>
              <p className="text-sm text-gray-700 mb-3">
                {selectedAnomaly.changePercent > 0 
                  ? `The ${selectedAnomaly.changePercent}% increase in records could indicate data duplication, a change in data collection methods, or a genuine business event.`
                  : `The ${Math.abs(selectedAnomaly.changePercent)}% decrease in records may indicate a partial data load, filtering changes, or data source issues.`
                }
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
                    {selectedAnomaly.changePercent > 0 
                      ? "Check for duplicate records in the dataset"
                      : "Verify the data pipeline for filtering or truncation issues"
                    }
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Review recent changes to ETL processes</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">
                    {selectedAnomaly.changePercent > 0 
                      ? "Confirm if this increase aligns with business expectations"
                      : "Check source system for data availability issues"
                    }
                  </span>
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
