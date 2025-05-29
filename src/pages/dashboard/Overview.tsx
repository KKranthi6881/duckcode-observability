import React, { useState } from 'react';
import { DataQualityChart } from './components/charts/DataQualityChart';
import { Link } from 'react-router-dom';
import { 
  Database, 
  GitBranch, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock,
  Layers,
  Activity,
  Code,
  Users,
  Target,
  Cpu
} from 'lucide-react';

export function Overview() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const brandColor = "#2AB7A9";
  const brandColorHover = "#239a8c"; // A slightly darker teal for hover
  const brandLightBg = "bg-[#2AB7A9]/10";
  const brandBorder = "border-[#2AB7A9]/20";
  const brandText = `text-[${brandColor}]`;
  
  // Sample data for dashboard metrics
  const dashboardData = {
    overview: {
      totalAssets: 234,
      healthyAssets: 198,
      atRiskAssets: 28,
      criticalIssues: 8,
      dataQualityScore: 92.5,
      aiSolvedDataQuality: 15,
      aiSolvedDataGovernance: 7,
      aiSolvedAutoDataCatalog: 22
    },
    lineage: {
      totalModels: 156,
      sourcesTables: 45,
      stagingModels: 67,
      martModels: 44,
      activeLineages: 89
    },
    dataQuality: {
      passedTests: 1247,
      failedTests: 23,
      warningTests: 45,
      totalTests: 1315,
      successRate: 94.8
    },
    codeHealth: {
      activeRepos: 12,
      totalCommits: 1456,
      codeReviews: 234,
      deployments: 89
    }
  };

  // Critical alerts for display
  const criticalAlerts = [
    { id: 1, title: 'High Cardinality Detected', table: 'fct_order_items', severity: 'high', time: '10 mins ago' },
    { id: 2, title: 'Schema Drift Alert', table: 'stg_tpch_customers', severity: 'medium', time: '1 hour ago' },
    { id: 3, title: 'Freshness SLA Breach', table: 'dim_products', severity: 'high', time: '3 hours ago' }
  ];

  // Recent activity for display
  const recentActivity = [
    { id: 1, type: 'lineage', message: 'New lineage detected: fct_order_items → dim_customers', time: '2 mins ago', status: 'info' },
    { id: 2, type: 'quality', message: 'Data quality test failed: null_check on customer_key', time: '15 mins ago', status: 'error' },
    { id: 3, type: 'governance', message: 'New PII tag added to customer_email column', time: '1 hour ago', status: 'success' }
  ];

  // Helper function for status icons
  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default: return <Activity className={`w-4 h-4 ${brandText}`} />;
    }
  };

  // Helper function for severity colors
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-700 bg-red-100 border-red-200';
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      default: return `text-teal-700 bg-teal-100 border-teal-200`; // Using Tailwind teal for simplicity here
    }
  };

  const keyMetrics = [
    { title: 'Data Quality Score', value: `${dashboardData.overview.dataQualityScore}%`, icon: Shield, color: 'brand', link: '/dashboard/quality' },
    { title: 'Healthy Assets', value: dashboardData.overview.healthyAssets, icon: CheckCircle, color: 'green', link: '/dashboard/assets' },
    { title: 'At Risk Assets', value: dashboardData.overview.atRiskAssets, icon: AlertTriangle, color: 'yellow', link: '/dashboard/assets' },
    { title: 'Critical Issues', value: dashboardData.overview.criticalIssues, icon: XCircle, color: 'red', link: '/dashboard/issues' },
    { title: 'Total Data Assets', value: dashboardData.overview.totalAssets, icon: Database, color: 'brand', link: '/dashboard/catalog' },
    { title: 'AI Solved Quality', value: dashboardData.overview.aiSolvedDataQuality, icon: Cpu, color: 'brand', link: '/dashboard/quality' },
    { title: 'AI Solved Governance', value: dashboardData.overview.aiSolvedDataGovernance, icon: Cpu, color: 'brand', link: '/dashboard/governance' },
    { title: 'AI Auto-Cataloged', value: dashboardData.overview.aiSolvedAutoDataCatalog, icon: Cpu, color: 'brand', link: '/dashboard/catalog' },
  ];

  const getMetricCardStyles = (color) => {
    switch (color) {
      case 'brand': return `${brandLightBg} ${brandBorder} ${brandText}`;
      case 'green': return 'bg-green-50 border-green-200 text-green-600';
      case 'yellow': return 'bg-yellow-50 border-yellow-200 text-yellow-600';
      case 'red': return 'bg-red-50 border-red-200 text-red-600';
      default: return `${brandLightBg} ${brandBorder} ${brandText}`;
    }
  };

  const getIconStyling = (color) => {
    switch (color) {
      case 'brand': return { bg: 'bg-[#2AB7A9]/10', text: 'text-[#2AB7A9]' };
      case 'green': return { bg: 'bg-green-50', text: 'text-green-600' };
      case 'yellow': return { bg: 'bg-yellow-50', text: 'text-yellow-600' };
      case 'red': return { bg: 'bg-red-50', text: 'text-red-600' };
      default: return { bg: 'bg-[#2AB7A9]/10', text: 'text-[#2AB7A9]' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 sm:mb-0">Data Observability Overview</h1>
        <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
          <Clock className="w-5 h-5 text-gray-500" />
          <select 
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="bg-white text-gray-700 text-sm border-none focus:ring-0 focus:outline-none appearance-none pr-8"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {keyMetrics.map(metric => {
          const iconStyle = getIconStyling(metric.color);
          return (
            <Link to={metric.link || '#'} key={metric.title} className={`block p-5 rounded-xl shadow-sm border border-gray-100 bg-white hover:shadow-md hover:border-[#2AB7A9]/20 hover:scale-[1.02] transition-all duration-200`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className={`text-sm font-medium text-gray-600`}>{metric.title}</h3>
                <div className={`p-2 rounded-full ${iconStyle.bg} flex items-center justify-center`}>
                  <metric.icon className={`w-5 h-5 ${iconStyle.text}`} />
                </div>
              </div>
              <p className={`text-3xl font-semibold text-gray-800 mt-3`}>{metric.value}</p>
            </Link>
          );
        })}
      </div>

      {/* Three Column Layout: Lineage, Quality Metrics, Critical Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Data Lineage Summary */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <GitBranch className={`w-5 h-5 mr-2 ${brandText}`} />
              <Link to="/dashboard/lineage" className="hover:text-[#2AB7A9]">Data Lineage Summary</Link>
            </h3>
            <Link to="/dashboard/lineage" className={`text-sm font-medium text-[#2AB7A9] hover:text-[#239a8c]`}>
              Explore Lineage
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            {[ 
              { label: 'Total Models', value: dashboardData.lineage.totalModels, icon: Layers },
              { label: 'Source Tables', value: dashboardData.lineage.sourcesTables, icon: Database },
              { label: 'Staging Models', value: dashboardData.lineage.stagingModels, icon: Layers },
              { label: 'Mart Models', value: dashboardData.lineage.martModels, icon: Target },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-md">
                <span className="text-gray-600">{item.label}</span>
                <span className="font-semibold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Quality Metrics */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
              <Link to="/dashboard/quality" className="hover:text-[#2AB7A9]">Data Quality</Link>
            </h3>
            <Link to="/dashboard/quality" className={`text-sm font-medium text-[#2AB7A9] hover:text-[#239a8c]`}>
              View Details
            </Link>
          </div>
          <div className="space-y-3">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-green-600">{dashboardData.dataQuality.successRate}%</div>
              <div className="text-sm text-gray-500">Overall Success Rate</div>
            </div>
            {[ 
              { label: 'Passed Tests', value: dashboardData.dataQuality.passedTests, color: 'text-green-600' },
              { label: 'Failed Tests', value: dashboardData.dataQuality.failedTests, color: 'text-red-600' },
              { label: 'Warning Tests', value: dashboardData.dataQuality.warningTests, color: 'text-yellow-600' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className={`text-sm ${item.color}`}>{item.label}</span>
                <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <AlertTriangle className={`w-5 h-5 mr-2 ${brandText}`} />
              <Link to="/dashboard/alerts" className="hover:text-[#2AB7A9]">Critical Alerts</Link>
            </h3>
            <Link to="/dashboard/alerts" className={`text-sm font-medium text-[#2AB7A9] hover:text-[#239a8c]`}>
              View All Alerts
            </Link>
          </div>
          <div className="space-y-3">
            {criticalAlerts.slice(0, 4).map(alert => (
              <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-xs opacity-80">Table: {alert.table}</p>
                </div>
                <p className="text-xs opacity-80">{alert.time}</p>
              </div>
            ))}
            {criticalAlerts.length === 0 && <p className="text-sm text-gray-500">No critical alerts. Great job!</p>}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Activity & Data Quality Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <Activity className={`w-5 h-5 mr-2 ${brandText}`} />
              <Link to="/dashboard/activity" className="hover:text-[#2AB7A9]">Recent Activity</Link>
            </h3>
            <Link to="/dashboard/activity" className={`text-sm font-medium text-[#2AB7A9] hover:text-[#239a8c]`}>
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map(activity => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                {getStatusIcon(activity.status)}
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{activity.message}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && <p className="text-sm text-gray-500">No recent activity.</p>}
          </div>
        </div>

        {/* Data Quality Trends Chart */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              <Link to="/dashboard/quality/trends" className="hover:text-[#2AB7A9]">Data Quality Score Trends</Link>
            </h3>
            <Link to="/dashboard/quality/trends" className={`text-sm font-medium text-[#2AB7A9] hover:text-[#239a8c]`}>
              View History
            </Link>
          </div>
          <div className="h-64 md:h-80">
            <DataQualityChart />
          </div>
        </div>
      </div>

      {/* GitHub Code Health Section */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <Code className={`w-5 h-5 mr-2 ${brandText}`} />
            <Link to="/dashboard/code" className="hover:text-[#2AB7A9]">Code Health & Repository Status</Link>
          </h3>
          <Link to="/dashboard/code" className={`text-sm font-medium text-[#2AB7A9] hover:text-[#239a8c]`}>
            View GitHub
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[ 
            { title: 'Active Repos', value: dashboardData.codeHealth.activeRepos, icon: GitBranch, color: 'brand' },
            { title: 'Total Commits', value: dashboardData.codeHealth.totalCommits, icon: Activity, color: 'green' }, // Keep green for positive connotation
            { title: 'Code Reviews', value: dashboardData.codeHealth.codeReviews, icon: Users, color: 'brand' },
            { title: 'Deployments', value: dashboardData.codeHealth.deployments, icon: Target, color: 'brand' },
          ].map(item => (
            <div key={item.title} className={`rounded-lg p-4 text-center ${getMetricCardStyles(item.color)}`}>
              <item.icon className={`w-8 h-8 mx-auto mb-2`} />
              <div className="text-2xl font-bold text-gray-800">{item.value}</div>
              <div className="text-sm text-gray-600">{item.title}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center mb-2 sm:mb-0">
            <Database className={`w-4 h-4 ${brandText} mr-2 flex-shrink-0`} />
            <span className="text-sm text-gray-700">Latest commit: <span className="font-medium text-gray-800">fix: schema drift detection in customer model</span></span>
          </div>
          <span className="text-xs text-gray-500">30 mins ago</span>
        </div>
      </div>
    </div>
  );
}