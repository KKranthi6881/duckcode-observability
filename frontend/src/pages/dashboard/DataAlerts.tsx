import React, { useState, useMemo, useCallback } from 'react';
import { Search, Filter, Bell, AlertTriangle, Clock, CheckCircle, ChevronDown, ChevronUp, Calendar, BarChart4, PieChart, RefreshCw, MessageSquare, X, Send, Copy, ThumbsUp, ThumbsDown, Edit3, Trash2, Archive, Database } from 'lucide-react';

// Sample alerts data (assuming this structure remains)
const alertsData = [
  {
    id: 1,
    title: 'Data freshness threshold exceeded',
    description: 'Table raw_customer has not been updated in 48 hours. Expected daily updates. This table is critical for daily sales reporting and downstream marketing analytics. Delay impacts revenue dashboards and campaign performance tracking.',
    severity: 'high',
    status: 'open',
    type: 'freshness',
    source: 'raw_customer',
    created: '2023-07-20T08:45:00',
    assignee: null,
    tags: ['critical', 'sales_data'],
    last_occurrence: '2023-07-20T08:45:00',
    affected_systems: ['Sales Dashboard', 'Marketing Analytics Platform'],
    suggested_actions: ['Check upstream ETL job for raw_customer.', 'Verify source system data availability.', 'Escalate to data engineering team if issue persists beyond 1 hour.']
  }, 
  {
    id: 2,
    title: 'Anomaly detected in order values',
    description: 'Unusual spike in order values detected in the last 6 hours. 95% above normal range. Potential fraud or data entry error. Average order value is $50, current spike shows multiple orders above $5000.',
    severity: 'medium',
    status: 'investigating',
    type: 'anomaly',
    source: 'fct_orders',
    created: '2023-07-20T10:15:00',
    assignee: 'alex.smith',
    tags: ['finance', 'fraud_detection'],
    last_occurrence: '2023-07-20T10:00:00',
    affected_systems: ['Order Processing', 'Financial Reporting'],
    suggested_actions: ['Investigate recent high-value orders.', 'Cross-reference with payment gateway logs.', 'Alert fraud prevention team.']
  }, 
  {
    id: 3,
    title: 'Schema change detected',
    description: 'New column "discount_code" added to raw_orders table. This was an unplanned change and might affect downstream processes that are not expecting this column.',
    severity: 'low',
    status: 'resolved',
    type: 'schema',
    source: 'raw_orders',
    created: '2023-07-19T14:30:00',
    assignee: 'sarah.johnson',
    resolved: '2023-07-19T16:45:00',
    resolution: 'Column added to downstream models and documented. Communication sent to relevant teams.',
    tags: ['schema_drift', 'documentation'],
    last_occurrence: '2023-07-19T14:30:00',
    affected_systems: ['ETL Processes', 'Data Warehouse Staging'],
    suggested_actions: ['Verify impact on downstream models.', 'Update documentation.', 'Communicate change to stakeholders.']
  },
  {
    id: 4,
    title: 'Data quality check failed',
    description: 'Unique constraint violation in customer_id column. 15 duplicate values detected. This can lead to incorrect customer analytics and reporting.',
    severity: 'high',
    status: 'open',
    type: 'quality',
    source: 'stg_customers',
    created: '2023-07-19T09:20:00',
    assignee: null,
    tags: ['dq', 'customer_data', 'critical'],
    last_occurrence: '2023-07-19T09:20:00',
    affected_systems: ['CRM Sync', 'Customer Segmentation Engine'],
    suggested_actions: ['Identify source of duplicate customer_ids.', 'Implement de-duplication logic in ETL.', 'Cleanse existing duplicate records.']
  },
  {
    id: 5,
    title: 'Missing values threshold exceeded',
    description: 'Column "email" in stg_customers has 15% null values, exceeding the 5% threshold. Missing emails impact communication and marketing campaigns.',
    severity: 'medium',
    status: 'resolved',
    type: 'quality',
    source: 'stg_customers',
    created: '2023-07-18T11:35:00',
    assignee: 'mike.brown',
    resolved: '2023-07-18T17:10:00',
    resolution: 'Added data validation rules in ETL process. Backfilled missing emails where possible from alternative sources.',
    tags: ['dq', 'customer_data'],
    last_occurrence: '2023-07-18T11:35:00',
    affected_systems: ['Marketing Automation', 'Customer Support Portal'],
    suggested_actions: ['Investigate source of null email values.', 'Improve data capture forms.', 'Consider data enrichment services.']
  },
  {
    id: 6,
    title: 'Pipeline execution failed',
    description: 'ETL job for daily order aggregation failed due to timeout. This job is critical for generating daily sales reports.',
    severity: 'high',
    status: 'resolved',
    type: 'pipeline',
    source: 'daily_order_aggregation',
    created: '2023-07-17T07:15:00',
    assignee: 'alex.smith',
    resolved: '2023-07-17T09:30:00',
    resolution: 'Increased timeout limit and optimized query. Added monitoring for query execution time.',
    tags: ['etl', 'critical', 'sales_reporting'],
    last_occurrence: '2023-07-17T07:15:00',
    affected_systems: ['Sales Reporting', 'Inventory Management'],
    suggested_actions: ['Analyze query performance.', 'Optimize SQL for aggregation job.', 'Review resource allocation for the ETL server.']
  }
];

// Filter options
const severityOptions = ['All', 'High', 'Medium', 'Low'];
const statusOptions = ['All', 'Open', 'Investigating', 'Resolved'];
const typeOptions = ['All', 'Freshness', 'Anomaly', 'Schema', 'Quality', 'Pipeline'];

// Simple error boundary component to catch rendering errors
const SafeComponent = ({ children, fallback }) => {
  // For simplicity, we'll assume children will not throw an error in this context
  // In a real app, proper error boundary logic would be here.
  // const [hasError, setHasError] = useState(false);
  // if (hasError) { return fallback... }
  // try { return children } catch (e) { setHasError(true); ... }
  return <>{children}</>;
};

// Updated SimpleChart for light theme
const SimpleChart = ({ type, data, title }) => {
  const chartColors = {
    open: 'bg-red-500',
    investigating: 'bg-yellow-500',
    resolved: 'bg-green-500',
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-sky-500',
  };

  const chartTextColors = {
    open: 'text-red-700',
    investigating: 'text-yellow-700',
    resolved: 'text-green-700',
    high: 'text-red-700',
    medium: 'text-yellow-700',
    low: 'text-sky-700',
  };

  if (type === 'pie') {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="text-md font-semibold text-gray-700 mb-3">{title}</h3>
        <div className="flex items-center justify-around h-48">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex flex-col items-center text-center">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center ${chartColors[key.toLowerCase()] || 'bg-gray-400'}`}>
                <span className="text-white font-bold text-xl">{value}</span>
              </div>
              <p className={`text-sm font-medium ${chartTextColors[key.toLowerCase()] || 'text-gray-600'} mt-2`}>{key.charAt(0).toUpperCase() + key.slice(1)}</p>
              <p className="text-xs text-gray-500">{total > 0 ? ((value / total) * 100).toFixed(0) : 0}%</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (type === 'bar') {
    const maxValue = Math.max(...Object.values(data), 1);
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <h3 className="text-md font-semibold text-gray-700 mb-3">{title}</h3>
        <div className="space-y-3">
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span className={`font-medium ${chartTextColors[key.toLowerCase()] || 'text-gray-600'}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <span className={`font-semibold ${chartTextColors[key.toLowerCase()] || 'text-gray-700'}`}>{value}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className={`${chartColors[key.toLowerCase()] || 'bg-gray-400'} h-2.5 rounded-full`}
                  style={{ width: `${(value / maxValue) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function DataAlerts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    severity: 'All',
    status: 'All',
    type: 'All',
    dateRange: { start: null, end: null }
  });
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'created', direction: 'descending' });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'quality', 'freshness', 'schema', 'pipeline'

  // Example data quality metrics - would come from API in real app
  const dataQualityMetrics = {
    overallScore: 89,
    scoreChange: 3, // positive number means improvement
    byCategory: {
      completeness: 92,
      accuracy: 87,
      consistency: 90,
      validity: 85,
      uniqueness: 91
    },
    totalRules: 156,
    passingRules: 142,
    failingRules: 14,
    criticalFailures: 4,
    monitoredTables: 28
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  // Simplified date formatting function
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return dateString; // fallback if date is invalid
    }
  };

  const sortedAlerts = useMemo(() => {
    let sortableItems = [...alertsData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [alertsData, sortConfig]);

  const filteredAlerts = useMemo(() => {
    return sortedAlerts.filter(alert => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesSearch = (
        alert.title.toLowerCase().includes(lowerSearchTerm) ||
        alert.description.toLowerCase().includes(lowerSearchTerm) ||
        alert.source.toLowerCase().includes(lowerSearchTerm)
      );
      const matchesSeverity = filters.severity === 'All' || alert.severity === filters.severity.toLowerCase();
      const matchesStatus = filters.status === 'All' || alert.status === filters.status.toLowerCase();
      const matchesType = filters.type === 'All' || alert.type === filters.type.toLowerCase();
      // Date filtering logic would go here if dateRange was fully implemented
      return matchesSearch && matchesSeverity && matchesStatus && matchesType;
    });
  }, [searchTerm, filters, sortedAlerts]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
    }
    return null;
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full text-xs font-medium';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border border-yellow-300 px-2.5 py-0.5 rounded-full text-xs font-medium';
      case 'low': return 'bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-full text-xs font-medium';
      default: return 'bg-gray-100 text-gray-700 border border-gray-300 px-2.5 py-0.5 rounded-full text-xs font-medium';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-600 px-2.5 py-0.5 rounded-md text-xs font-medium';
      case 'investigating': return 'bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-md text-xs font-medium';
      case 'resolved': return 'bg-green-100 text-green-700 px-2.5 py-0.5 rounded-md text-xs font-medium';
      default: return 'bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-md text-xs font-medium';
    }
  };

  const handleOpenChat = (alert) => {
    setSelectedAlert(alert);
    setChatMessages([
      { sender: 'ai', text: `Hi there! I'm here to help with the alert: "${alert.title}". What would you like to know or do?` }
    ]);
    setIsChatOpen(true);
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;
    const newMessages = [...chatMessages, { sender: 'user', text: chatInput }];
    // Simulate AI response
    setTimeout(() => {
      setChatMessages(prev => [...prev, { sender: 'ai', text: `I've received your message: "${chatInput}". I'm processing it... (Simulated AI response)` }]);
    }, 1000);
    setChatMessages(newMessages);
    setChatInput('');
  };

  // Calculate summary data for charts
  const statusSummary = useMemo(() => alertsData.reduce((acc, alert) => {
    acc[alert.status] = (acc[alert.status] || 0) + 1;
    return acc;
  }, {}), [alertsData]);

  const severitySummary = useMemo(() => alertsData.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {}), [alertsData]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-6 lg:p-8">
      {/* Enhanced Header with Data Quality Summary */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Bell className="h-8 w-8 mr-3 text-sky-600" />
              Data Alerts Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Monitor, investigate, and resolve data incidents with AI assistance</p>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="flex space-x-2">
              <button 
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                onClick={() => setActiveTab('quality')}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Alerts
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
              </button>
            </div>
          </div>
        </div>
        
        {/* Data Quality Score Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Overall Data Quality</p>
                <div className="flex items-baseline mt-1">
                  <p className="text-3xl font-semibold text-gray-900">{dataQualityMetrics.overallScore}%</p>
                  <p className={`ml-2 text-sm font-medium ${dataQualityMetrics.scoreChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dataQualityMetrics.scoreChange >= 0 ? '+' : ''}{dataQualityMetrics.scoreChange}%
                  </p>
                </div>
              </div>
              <div className="bg-sky-100 p-3 rounded-full">
                <BarChart4 className="h-6 w-6 text-sky-600" />
              </div>
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-sky-600 h-2 rounded-full" style={{ width: `${dataQualityMetrics.overallScore}%` }}></div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Data Quality Rules</p>
                <div className="flex items-baseline space-x-2 mt-1">
                  <p className="text-3xl font-semibold text-gray-900">{dataQualityMetrics.passingRules}</p>
                  <p className="text-gray-500 text-sm">of {dataQualityMetrics.totalRules} passing</p>
                </div>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${(dataQualityMetrics.passingRules / dataQualityMetrics.totalRules) * 100}%` }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-500">
                {Math.round((dataQualityMetrics.passingRules / dataQualityMetrics.totalRules) * 100)}%
              </span>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Critical Failures</p>
                <p className="text-3xl font-semibold text-gray-900 mt-1">{dataQualityMetrics.criticalFailures}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {dataQualityMetrics.criticalFailures === 0 
                ? 'No critical issues detected' 
                : `${dataQualityMetrics.criticalFailures} issues requiring immediate attention`}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Monitored Tables</p>
                <p className="text-3xl font-semibold text-gray-900 mt-1">{dataQualityMetrics.monitoredTables}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {dataQualityMetrics.monitoredTables} tables with active monitoring
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <SafeComponent fallback={<div>Error loading status chart.</div>}>
          <SimpleChart type="pie" data={statusSummary} title="Alerts by Status" />
        </SafeComponent>
        <SafeComponent fallback={<div>Error loading severity chart.</div>}>
          <SimpleChart type="bar" data={severitySummary} title="Alerts by Severity" />
        </SafeComponent>
      </div>

      {/* Filters and Actions Section */}
      <div className="mb-6 p-4 sm:p-6 bg-white rounded-lg shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          {/* Search Input */}
          <div className="lg:col-span-2">
            <label htmlFor="search-alerts" className="block text-sm font-medium text-gray-700 mb-1">Search Alerts</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search-alerts"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                placeholder="Search by title, description, source..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Severity Filter */}
          <div>
            <label htmlFor="severity-filter" className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select 
              id="severity-filter" 
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
            >
              {severityOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              id="status-filter" 
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select 
              id="type-filter" 
              className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              {typeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          {/* Add other filters like Date Range if needed */}
        </div>
      </div>

      {/* Alerts Table and Detail View Section */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Alerts Table */}
        <div className={`w-full ${selectedAlert ? 'lg:w-2/3' : 'lg:w-full'} transition-all duration-300 ease-in-out`}>
          <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => requestSort('title')}>
                    <div className="flex items-center">Alert {getSortIndicator('title')}</div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => requestSort('severity')}>
                    <div className="flex items-center">Severity {getSortIndicator('severity')}</div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => requestSort('status')}>
                    <div className="flex items-center">Status {getSortIndicator('status')}</div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200" onClick={() => requestSort('created')}>
                    <div className="flex items-center">Created {getSortIndicator('created')}</div>
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAlerts.length > 0 ? (
                  filteredAlerts.map(alert => (
                    <tr 
                      key={alert.id} 
                      className={`hover:bg-gray-50 ${selectedAlert?.id === alert.id ? 'bg-sky-50' : ''}`}
                      onClick={() => setSelectedAlert(alert)}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-start">
                          <div className={`mr-3 mt-0.5 p-1.5 rounded-full ${getSeverityClass(alert.severity).split(' ')[0]}`}>
                            <AlertTriangle className={`h-4 w-4 ${getSeverityClass(alert.severity).split(' ')[1]}`} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{alert.title}</div>
                            <div className="text-xs text-gray-500">{alert.source} - {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border ${getSeverityClass(alert.severity)}`}>
                          {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(alert.status)}`}>
                          {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(alert.created)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenChat(alert); }}
                          className="text-sky-600 hover:text-sky-800 p-1 rounded-md hover:bg-sky-100 transition-colors duration-150 flex items-center"
                          title="AI Fix / Assistant"
                        >
                          <MessageSquare className="h-5 w-5 mr-1" /> AI Fix
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      <Bell className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                      No alerts match your filters. Try adjusting your search or filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Alert Detail Panel */}
        {selectedAlert && (
          <div className="w-full lg:w-1/3 bg-white shadow-md rounded-lg p-6 space-y-6 transition-all duration-300 ease-in-out transform lg:translate-x-0">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <Bell className="h-6 w-6 mr-2 text-sky-600" /> Alert Details
              </h2>
              <button onClick={() => setSelectedAlert(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{selectedAlert.title}</h3>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">{selectedAlert.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong className="block text-gray-500">Severity:</strong> 
                <span className={`px-2 py-0.5 inline-flex font-semibold rounded-full border text-xs ${getSeverityClass(selectedAlert.severity)}`}>
                  {selectedAlert.severity.charAt(0).toUpperCase() + selectedAlert.severity.slice(1)}
                </span>
              </div>
              <div>
                <strong className="block text-gray-500">Status:</strong> 
                <span className={`px-2 py-0.5 inline-flex font-semibold rounded-full text-xs ${getStatusClass(selectedAlert.status)}`}>
                  {selectedAlert.status.charAt(0).toUpperCase() + selectedAlert.status.slice(1)}
                </span>
              </div>
              <div><strong className="block text-gray-500">Source:</strong> <span className="text-gray-700">{selectedAlert.source}</span></div>
              <div><strong className="block text-gray-500">Type:</strong> <span className="text-gray-700">{selectedAlert.type.charAt(0).toUpperCase() + selectedAlert.type.slice(1)}</span></div>
              <div><strong className="block text-gray-500">Created:</strong> <span className="text-gray-700">{formatDate(selectedAlert.created)}</span></div>
              {selectedAlert.resolved && <div><strong className="block text-gray-500">Resolved:</strong> <span className="text-gray-700">{formatDate(selectedAlert.resolved)}</span></div>}
              <div><strong className="block text-gray-500">Assignee:</strong> <span className="text-gray-700">{selectedAlert.assignee || 'Unassigned'}</span></div>
              <div><strong className="block text-gray-500">Last Occurrence:</strong> <span className="text-gray-700">{formatDate(selectedAlert.last_occurrence)}</span></div>
            </div>

            {selectedAlert.tags && selectedAlert.tags.length > 0 && (
              <div>
                <strong className="block text-sm text-gray-500 mb-1">Tags:</strong>
                <div className="flex flex-wrap gap-2">
                  {selectedAlert.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-md text-xs font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedAlert.affected_systems && selectedAlert.affected_systems.length > 0 && (
              <div>
                <strong className="block text-sm text-gray-500 mb-1">Affected Systems:</strong>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {selectedAlert.affected_systems.map(system => <li key={system}>{system}</li>)}
                </ul>
              </div>
            )}

            {selectedAlert.suggested_actions && selectedAlert.suggested_actions.length > 0 && (
              <div>
                <strong className="block text-sm text-gray-500 mb-1">Suggested Actions:</strong>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {selectedAlert.suggested_actions.map(action => <li key={action}>{action}</li>)}
                </ul>
              </div>
            )}

            {selectedAlert.status === 'resolved' && selectedAlert.resolution && (
              <div>
                <strong className="block text-sm text-gray-500 mb-1">Resolution:</strong>
                <p className="text-sm text-gray-700 bg-green-50 p-3 rounded-md border border-green-200">{selectedAlert.resolution}</p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
              <button 
                onClick={() => handleOpenChat(selectedAlert)}
                className="flex items-center bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors duration-150 shadow-sm hover:shadow-md"
              >
                <MessageSquare className="h-4 w-4 mr-2" /> AI Fix / Assistant
              </button>
              <button className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md text-sm transition-colors duration-150">
                <Edit3 className="h-4 w-4 mr-2" /> Edit Alert
              </button>
              <button className="flex items-center bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md text-sm transition-colors duration-150">
                <Archive className="h-4 w-4 mr-2" /> Archive
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Chat Modal/Panel */}
      {isChatOpen && selectedAlert && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg h-[70vh] flex flex-col overflow-hidden transform transition-all duration-300 ease-in-out scale-100">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">AI Assistant</h3>
                <p className="text-xs text-gray-500 truncate max-w-xs">Regarding: {selectedAlert.title}</p>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-grow p-4 space-y-4 overflow-y-auto bg-gray-100">
              {chatMessages.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[70%] p-3 rounded-lg shadow ${ 
                      msg.sender === 'user' 
                        ? 'bg-sky-500 text-white rounded-br-none'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                    {/* Optional: Timestamp for messages */}
                    {/* <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-sky-100' : 'text-gray-400'}`}>{new Date().toLocaleTimeString()}</p> */}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input Area */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  placeholder="Ask AI for help or suggestions..."
                  className="flex-grow p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
                <button 
                  onClick={handleSendChatMessage}
                  disabled={!chatInput.trim()}
                  className="p-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-gray-300 transition-colors duration-150 shadow-sm hover:shadow-md"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">AI responses are for informational purposes and may require verification.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}