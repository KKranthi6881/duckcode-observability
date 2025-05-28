import React, { useState } from 'react';
import { BarChart2, ArrowLeft, Filter, RefreshCw, ChevronDown, AlertTriangle, CheckCircle, Search, Eye, Cpu, Database, AlertCircle, X, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample data for pattern anomalies
const patternData = {
  summary: {
    totalMetrics: 86,
    monitoredMetrics: 74,
    metricsWithIssues: 12,
    criticalIssues: 5,
    detectionAccuracy: 94.5
  },
  anomalies: [
    {
      id: 'pat-001',
      metricName: 'Average Order Value',
      tableName: 'fct_orders',
      expectedPattern: 'stable',
      anomalyType: 'spike',
      deviationPercent: 95,
      status: 'critical',
      detectedAt: '2023-07-20T10:15:00',
      values: [45, 48, 51, 47, 52, 49, 950], // last 7 data points
      normalRange: [40, 60],
      affectedSystems: ['Order Processing', 'Financial Reporting'],
      owner: 'data-engineering',
      description: 'Detected values 95% above normal range in the last 6 hours. This significant spike in average order value may indicate a data quality issue or an unusual high-value order.'
    },
    {
      id: 'pat-002',
      metricName: 'User Registration Rate',
      tableName: 'dim_users',
      expectedPattern: 'daily-cycle',
      anomalyType: 'drop',
      deviationPercent: 68,
      status: 'critical',
      detectedAt: '2023-07-20T08:30:00',
      values: [120, 115, 125, 118, 122, 40, 35], // last 7 data points
      normalRange: [100, 130],
      affectedSystems: ['User Analytics', 'Marketing Dashboard'],
      owner: 'user-analytics',
      description: 'Significant drop in user registration rate. Values are 68% below the expected range for this time period.'
    },
    {
      id: 'pat-003',
      metricName: 'Product View-to-Purchase Ratio',
      tableName: 'fct_user_activity',
      expectedPattern: 'weekly-cycle',
      anomalyType: 'trend-change',
      deviationPercent: 45,
      status: 'warning',
      detectedAt: '2023-07-19T14:20:00',
      values: [0.12, 0.13, 0.14, 0.18, 0.22, 0.25, 0.28], // last 7 data points
      normalRange: [0.10, 0.15],
      affectedSystems: ['Product Analytics', 'Sales Forecasting'],
      owner: 'product-analytics',
      description: 'Unusual upward trend in view-to-purchase ratio. While positive for business, this deviates from historical patterns and may indicate a tracking issue.'
    },
    {
      id: 'pat-004',
      metricName: 'Payment Processing Time',
      tableName: 'fct_payments',
      expectedPattern: 'stable',
      anomalyType: 'variance-increase',
      deviationPercent: 35,
      status: 'warning',
      detectedAt: '2023-07-19T11:45:00',
      values: [1.2, 1.3, 4.5, 0.8, 3.2, 0.9, 5.1], // last 7 data points in seconds
      normalRange: [0.8, 1.5],
      affectedSystems: ['Payment Gateway', 'Checkout Experience'],
      owner: 'payment-systems',
      description: 'Increased variance in payment processing times. Some transactions are taking significantly longer than normal, which may affect user experience.'
    },
    {
      id: 'pat-005',
      metricName: 'Null Values in Customer Email',
      tableName: 'raw_customer',
      expectedPattern: 'stable-low',
      anomalyType: 'gradual-increase',
      deviationPercent: 28,
      status: 'warning',
      detectedAt: '2023-07-18T09:10:00',
      values: [0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05], // last 7 data points as percentages
      normalRange: [0.01, 0.03],
      affectedSystems: ['Marketing Automation', 'Customer Communications'],
      owner: 'data-quality',
      description: 'Gradually increasing percentage of null values in customer email field. This may indicate an issue with data collection or validation.'
    }
  ],
  patternTypes: {
    spike: 3,
    drop: 2,
    trendChange: 4,
    varianceIncrease: 2,
    gradualIncrease: 1
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

const PatternChart = ({ values, normalRange, anomalyType }) => {
  const min = Math.min(...values, normalRange[0]);
  const max = Math.max(...values, normalRange[1]);
  const range = max - min;
  
  // Add padding to the range to make the chart more readable
  const paddedMin = min - (range * 0.1);
  const paddedMax = max + (range * 0.1);
  const paddedRange = paddedMax - paddedMin;
  
  return (
    <div className="h-40 flex items-end space-x-2">
      {values.map((value, index) => {
        const normalizedHeight = ((value - paddedMin) / paddedRange) * 100;
        const isWithinRange = value >= normalRange[0] && value <= normalRange[1];
        const isLastDay = index === values.length - 1;
        
        let barColor = 'bg-green-500';
        if (!isWithinRange) {
          barColor = isLastDay ? 'bg-red-500' : 'bg-orange-400';
        }
        
        return (
          <div key={index} className="flex flex-col items-center flex-1">
            <div className="w-full flex justify-center mb-1">
              <span className="text-xs text-gray-500">{value}</span>
            </div>
            <div 
              className={`w-full rounded-t ${barColor}`}
              style={{ height: `${normalizedHeight}%` }}
            ></div>
            <span className="text-xs text-gray-500 mt-1">Day {index + 1}</span>
          </div>
        );
      })}
    </div>
  );
};

export function AnomalyPattern() {
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
  
  const getAnomalyTypeIcon = (type) => {
    switch (type) {
      case 'spike': return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'drop': return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'trend-change': return <BarChart2 className="h-4 w-4 text-yellow-600" />;
      case 'variance-increase': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'gradual-increase': return <TrendingUp className="h-4 w-4 text-yellow-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };
  
  const filteredAnomalies = patternData.anomalies.filter(anomaly => 
    anomaly.metricName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
              Pattern Anomalies
            </h1>
            <p className="text-gray-600 mt-1">Detect and analyze unusual patterns and distributions in your data</p>
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
          title="Total Metrics" 
          value={patternData.summary.totalMetrics} 
          icon={<Database className="h-6 w-6 text-sky-600" />} 
          color="sky"
        />
        <MetricCard 
          title="Monitored Metrics" 
          value={patternData.summary.monitoredMetrics} 
          icon={<Eye className="h-6 w-6 text-purple-600" />} 
          color="purple"
          subtext={`${Math.round((patternData.summary.monitoredMetrics / patternData.summary.totalMetrics) * 100)}% coverage`}
        />
        <MetricCard 
          title="Metrics with Issues" 
          value={patternData.summary.metricsWithIssues} 
          icon={<AlertTriangle className="h-6 w-6 text-yellow-600" />} 
          color="yellow"
        />
        <MetricCard 
          title="Critical Issues" 
          value={patternData.summary.criticalIssues} 
          icon={<AlertCircle className="h-6 w-6 text-red-600" />} 
          color="red"
        />
        <MetricCard 
          title="Detection Accuracy" 
          value={`${patternData.summary.detectionAccuracy}%`} 
          icon={<Cpu className="h-6 w-6 text-green-600" />} 
          color="green"
        />
      </div>
      
      {/* Main content area */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Anomalies table */}
        <div className={`w-full ${selectedAnomaly ? 'lg:w-2/3' : 'lg:w-full'} transition-all duration-300 ease-in-out`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-medium text-gray-700">Pattern Anomalies</h3>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Search metrics or tables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anomaly Type</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deviation</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detected</th>
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
                          <div className="text-sm font-medium text-gray-900">{anomaly.metricName}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {anomaly.tableName}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="mr-2">{getAnomalyTypeIcon(anomaly.anomalyType)}</div>
                            <span className="text-sm text-gray-700 capitalize">{anomaly.anomalyType.replace('-', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                          {anomaly.deviationPercent}%
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusClass(anomaly.status)}`}>
                            {anomaly.status.charAt(0).toUpperCase() + anomaly.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(anomaly.detectedAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        No pattern anomalies match your search criteria.
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
                <BarChart2 className="h-6 w-6 mr-2 text-purple-600" /> Pattern Details
              </h2>
              <button onClick={() => setSelectedAnomaly(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedAnomaly.metricName}</h3>
              <p className="text-sm text-gray-600 mb-3">{selectedAnomaly.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="block text-gray-500">Table:</strong> 
                <span className="text-gray-700">{selectedAnomaly.tableName}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Expected Pattern:</strong> 
                <span className="text-gray-700 capitalize">{selectedAnomaly.expectedPattern.replace('-', ' ')}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Anomaly Type:</strong> 
                <span className="text-gray-700 capitalize">{selectedAnomaly.anomalyType.replace('-', ' ')}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Deviation:</strong> 
                <span className="text-red-600 font-semibold">{selectedAnomaly.deviationPercent}%</span>
              </div>
              <div>
                <strong className="block text-gray-500">Status:</strong> 
                <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusClass(selectedAnomaly.status)}`}>
                  {selectedAnomaly.status.charAt(0).toUpperCase() + selectedAnomaly.status.slice(1)}
                </span>
              </div>
              <div>
                <strong className="block text-gray-500">Detected:</strong> 
                <span className="text-gray-700">{formatDate(selectedAnomaly.detectedAt)}</span>
              </div>
              <div>
                <strong className="block text-gray-500">Normal Range:</strong> 
                <span className="text-gray-700">{selectedAnomaly.normalRange[0]} - {selectedAnomaly.normalRange[1]}</span>
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
              <strong className="block text-sm text-gray-500 mb-2">Pattern Trend (Last 7 Days):</strong>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <PatternChart 
                  values={selectedAnomaly.values}
                  normalRange={selectedAnomaly.normalRange}
                  anomalyType={selectedAnomaly.anomalyType}
                />
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                  <span>Normal range: {selectedAnomaly.normalRange[0]} - {selectedAnomaly.normalRange[1]}</span>
                  <span>Current value: {selectedAnomaly.values[selectedAnomaly.values.length - 1]}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-sky-50 p-4 rounded-lg border border-sky-100">
              <strong className="block text-sm text-sky-700 mb-2 flex items-center">
                <Cpu className="h-4 w-4 mr-1.5" /> AI Analysis:
              </strong>
              <p className="text-sm text-gray-700 mb-3">
                {selectedAnomaly.anomalyType === 'spike' && 'This sudden spike is significantly outside the normal range and may indicate a data quality issue or an unusual event.'}
                {selectedAnomaly.anomalyType === 'drop' && 'This significant drop is well below the expected values and may indicate a data collection issue or a real-world event affecting the metric.'}
                {selectedAnomaly.anomalyType === 'trend-change' && 'The pattern has shifted from its historical trend. This could represent a fundamental change in the underlying data or business process.'}
                {selectedAnomaly.anomalyType === 'variance-increase' && 'The data points are showing increased variability, which may indicate instability in the system or inconsistent data collection.'}
                {selectedAnomaly.anomalyType === 'gradual-increase' && 'There is a steady upward trend beyond the normal range, which may indicate a developing issue that should be monitored.'}
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
                    {selectedAnomaly.anomalyType === 'spike' && 'Verify if there are any outliers or data entry errors'}
                    {selectedAnomaly.anomalyType === 'drop' && 'Check for data collection gaps or filtering issues'}
                    {selectedAnomaly.anomalyType === 'trend-change' && 'Analyze recent changes to business processes or data collection methods'}
                    {selectedAnomaly.anomalyType === 'variance-increase' && 'Investigate potential sources of instability in the data pipeline'}
                    {selectedAnomaly.anomalyType === 'gradual-increase' && 'Monitor the trend and establish if this is a new normal or an issue'}
                  </span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Review related metrics to identify potential correlations</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-sky-100 rounded-full p-1 text-sky-600 mr-2 mt-0.5">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-gray-700">Consider adjusting thresholds if this represents a new normal pattern</span>
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
