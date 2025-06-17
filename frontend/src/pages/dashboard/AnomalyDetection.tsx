import React, { useState } from 'react';
import { AlertTriangle, Clock, BarChart2, Database, FileText, Calendar, ChevronDown, Filter, RefreshCw, Cpu, ArrowRight, TrendingUp, TrendingDown, Zap, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample anomaly data - in a real application, this would come from an API
const anomalyData = {
  summary: {
    totalAnomalies: 42,
    criticalAnomalies: 8,
    warningAnomalies: 18,
    resolvedAnomalies: 16,
    newLast24h: 5,
    aiResolved: 12
  },
  byType: {
    freshness: 15,
    volume: 9,
    pattern: 12,
    schema: 6
  },
  byDataAsset: [
    { name: 'raw_customer', count: 8, criticalCount: 3 },
    { name: 'fct_orders', count: 7, criticalCount: 2 },
    { name: 'dim_products', count: 6, criticalCount: 1 },
    { name: 'raw_orders', count: 5, criticalCount: 0 },
    { name: 'stg_customers', count: 4, criticalCount: 2 }
  ],
  trend: [
    { date: '2023-07-15', total: 28, critical: 5, warning: 14, resolved: 9 },
    { date: '2023-07-16', total: 31, critical: 6, warning: 15, resolved: 10 },
    { date: '2023-07-17', total: 35, critical: 7, warning: 16, resolved: 12 },
    { date: '2023-07-18', total: 38, critical: 8, warning: 17, resolved: 13 },
    { date: '2023-07-19', total: 40, critical: 8, warning: 18, resolved: 14 },
    { date: '2023-07-20', total: 42, critical: 8, warning: 18, resolved: 16 }
  ],
  recentAnomalies: [
    {
      id: 'anom-001',
      title: 'Data freshness threshold exceeded',
      description: 'Table raw_customer has not been updated in 48 hours. Expected daily updates.',
      type: 'freshness',
      severity: 'critical',
      detectedAt: '2023-07-20T08:45:00',
      asset: 'raw_customer'
    },
    {
      id: 'anom-002',
      title: 'Unusual spike in order values',
      description: 'Detected values 95% above normal range in the last 6 hours.',
      type: 'pattern',
      severity: 'warning',
      detectedAt: '2023-07-20T10:15:00',
      asset: 'fct_orders'
    },
    {
      id: 'anom-003',
      title: 'Schema change detected',
      description: 'New column "discount_code" added to raw_orders table.',
      type: 'schema',
      severity: 'info',
      detectedAt: '2023-07-19T14:30:00',
      asset: 'raw_orders'
    },
    {
      id: 'anom-004',
      title: 'Data volume drop',
      description: '75% decrease in daily records for dim_products.',
      type: 'volume',
      severity: 'critical',
      detectedAt: '2023-07-19T09:20:00',
      asset: 'dim_products'
    },
    {
      id: 'anom-005',
      title: 'Null values threshold exceeded',
      description: 'Column "email" in stg_customers has 15% null values, exceeding the 5% threshold.',
      type: 'quality',
      severity: 'warning',
      detectedAt: '2023-07-18T11:35:00',
      asset: 'stg_customers'
    }
  ]
};

// Helper components
const MetricCard = ({ title, value, icon, color, subtext, trend }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="flex items-baseline mt-1">
            <p className="text-3xl font-semibold text-gray-900">{value}</p>
            {trend && (
              <p className={`ml-2 text-sm font-medium flex items-center ${trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {Math.abs(trend)}%
              </p>
            )}
          </div>
          {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
        </div>
        <div className={`bg-${color}-100 p-3 rounded-full`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const AnomalyTypeCard = ({ title, count, icon, color, path }) => {
  return (
    <Link to={path} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer block">
      <div className="flex justify-between items-center mb-3">
        <div className={`bg-${color}-100 p-2.5 rounded-full`}>
          {icon}
        </div>
        <span className="text-2xl font-semibold text-gray-900">{count}</span>
      </div>
      <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      <div className="mt-3 flex items-center text-sky-600 text-xs font-medium">
        View details <ArrowRight className="ml-1 h-3 w-3" />
      </div>
    </Link>
  );
};

const TrendChart = ({ data }) => {
  // In a real app, you'd use a charting library like recharts or chart.js
  // This is a simplified representation
  const maxValue = Math.max(...data.map(d => d.total));
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Anomaly Trend (Last 7 Days)</h3>
      <div className="h-64 flex items-end justify-between">
        {data.map((day, index) => (
          <div key={index} className="flex flex-col items-center">
            <div className="flex flex-col-reverse">
              <div 
                className="w-10 bg-sky-500 rounded-t"
                style={{ height: `${(day.total / maxValue) * 180}px` }}
              ></div>
              <div 
                className="w-10 bg-red-500 rounded-t"
                style={{ height: `${(day.critical / maxValue) * 180}px` }}
              ></div>
            </div>
            <span className="text-xs text-gray-500 mt-2">
              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-center mt-4 space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
          <span className="text-xs text-gray-600">Critical</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-sky-500 rounded-full mr-1"></div>
          <span className="text-xs text-gray-600">Total</span>
        </div>
      </div>
    </div>
  );
};

const AnomalyTable = ({ anomalies }) => {
  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'info': return 'bg-sky-100 text-sky-700 border-sky-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'freshness': return <Clock className="h-4 w-4 text-sky-600" />;
      case 'pattern': return <BarChart2 className="h-4 w-4 text-purple-600" />;
      case 'schema': return <FileText className="h-4 w-4 text-green-600" />;
      case 'volume': return <TrendingDown className="h-4 w-4 text-orange-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700">Recent Anomalies</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anomaly</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detected</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {anomalies.map((anomaly) => (
              <tr key={anomaly.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{anomaly.title}</div>
                    <div className="text-xs text-gray-500">{anomaly.asset}</div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="mr-2">{getTypeIcon(anomaly.type)}</div>
                    <span className="text-sm text-gray-700 capitalize">{anomaly.type}</span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getSeverityClass(anomaly.severity)}`}>
                    {anomaly.severity.charAt(0).toUpperCase() + anomaly.severity.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(anomaly.detectedAt)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-sky-600 hover:text-sky-800 mr-3">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button className="text-sky-600 hover:text-sky-800">
                    <Cpu className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export function AnomalyDetection() {
  const [timeRange, setTimeRange] = useState('7d');
  
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-6 lg:p-8">
      {/* Header with filters */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <AlertTriangle className="h-8 w-8 mr-3 text-red-600" />
              Anomaly Detection
            </h1>
            <p className="text-gray-600 mt-1">Monitor, analyze, and resolve data anomalies with AI assistance</p>
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
                <option value="90d">Last 90 days</option>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard 
          title="Total Anomalies" 
          value={anomalyData.summary.totalAnomalies} 
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />} 
          color="red"
          trend={5}
        />
        <MetricCard 
          title="Critical Anomalies" 
          value={anomalyData.summary.criticalAnomalies} 
          icon={<Zap className="h-6 w-6 text-orange-600" />} 
          color="orange"
          trend={2}
        />
        <MetricCard 
          title="New (Last 24h)" 
          value={anomalyData.summary.newLast24h} 
          icon={<Clock className="h-6 w-6 text-yellow-600" />} 
          color="yellow"
        />
        <MetricCard 
          title="AI-Resolved" 
          value={anomalyData.summary.aiResolved} 
          icon={<Cpu className="h-6 w-6 text-green-600" />} 
          color="green"
          trend={-15}
          subtext="12 issues auto-resolved by AI"
        />
      </div>
      
      {/* Anomaly Types */}
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Anomaly Categories</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <AnomalyTypeCard 
          title="Freshness Anomalies" 
          count={anomalyData.byType.freshness} 
          icon={<Clock className="h-5 w-5 text-sky-600" />} 
          color="sky"
          path="/dashboard/anomalies/freshness"
        />
        <AnomalyTypeCard 
          title="Volume Anomalies" 
          count={anomalyData.byType.volume} 
          icon={<TrendingDown className="h-5 w-5 text-orange-600" />} 
          color="orange"
          path="/dashboard/anomalies/volume"
        />
        <AnomalyTypeCard 
          title="Pattern Anomalies" 
          count={anomalyData.byType.pattern} 
          icon={<BarChart2 className="h-5 w-5 text-purple-600" />} 
          color="purple"
          path="/dashboard/anomalies/pattern"
        />
        <AnomalyTypeCard 
          title="Schema Changes" 
          count={anomalyData.byType.schema} 
          icon={<FileText className="h-5 w-5 text-green-600" />} 
          color="green"
          path="/dashboard/anomalies/schema"
        />
      </div>
      
      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TrendChart data={anomalyData.trend} />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Top Affected Data Assets</h3>
          <div className="space-y-4">
            {anomalyData.byDataAsset.map((asset, index) => (
              <div key={index} className="flex items-center">
                <div className="w-32 truncate text-sm text-gray-700">{asset.name}</div>
                <div className="flex-1 ml-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-sky-600 h-2.5 rounded-full" 
                      style={{ width: `${(asset.count / Math.max(...anomalyData.byDataAsset.map(a => a.count))) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="ml-2 text-sm font-medium text-gray-700">{asset.count}</div>
                <div className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                  {asset.criticalCount} critical
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Recent Anomalies Table */}
      <AnomalyTable anomalies={anomalyData.recentAnomalies} />
    </div>
  );
}
