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
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Activity className="w-4 h-4 text-blue-500" />;
    }
  };

  // Helper function for severity colors
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-100';
      case 'medium': return 'text-yellow-500 bg-yellow-100';
      default: return 'text-blue-500 bg-blue-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold text-white">Data Observability Overview</h2>
        <div className="flex items-center space-x-2 bg-slate-700 rounded-md px-3 py-1.5">
          <Clock className="w-4 h-4 text-slate-400" />
          <select 
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="bg-slate-700 text-white text-sm border-none focus:ring-0 focus:outline-none"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Data Quality Score Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Data Quality Score</span>
            <div className="p-2 rounded-full bg-green-900/40">
              <Shield className="h-5 w-5 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.overview.dataQualityScore}%</div>
          <div className="text-xs text-green-400 mt-1">+2.1% from yesterday</div>
        </div>
        
        {/* Healthy Assets Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Healthy Assets</span>
            <div className="p-2 rounded-full bg-green-900/40">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.overview.healthyAssets}</div>
          <div className="text-xs text-slate-400 mt-1">of {dashboardData.overview.totalAssets} total</div>
        </div>
        
        {/* At Risk Assets Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">At Risk Assets</span>
            <div className="p-2 rounded-full bg-yellow-900/40">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.overview.atRiskAssets}</div>
          <div className="text-xs text-yellow-400 mt-1">+3 in last 24h</div>
        </div>
        
        {/* Critical Issues Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Critical Issues</span>
            <div className="p-2 rounded-full bg-red-900/40">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.overview.criticalIssues}</div>
          <div className="text-xs text-red-400 mt-1">Needs attention</div>
        </div>
        
        {/* Active Models Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Active Models</span>
            <div className="p-2 rounded-full bg-blue-900/40">
              <Layers className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.lineage.totalModels}</div>
          <div className="text-xs text-slate-400 mt-1">DBT models monitored</div>
        </div>

        {/* AI Solved Data Quality Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">AI Solved DQ Issues</span>
            <div className="p-2 rounded-full bg-teal-900/40">
              <Cpu className="h-5 w-5 text-teal-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.overview.aiSolvedDataQuality}</div>
          <div className="text-xs text-teal-400 mt-1">Auto-remediated</div>
        </div>

        {/* AI Solved Data Governance Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">AI Solved Gov Tasks</span>
            <div className="p-2 rounded-full bg-indigo-900/40">
              <Cpu className="h-5 w-5 text-indigo-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.overview.aiSolvedDataGovernance}</div>
          <div className="text-xs text-indigo-400 mt-1">Automated actions</div>
        </div>

        {/* AI Solved Auto Data Catalog Card */}
        <div className="bg-slate-800 rounded-lg border border-slate-700/70 p-5 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:shadow-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">AI Catalog Enhancements</span>
            <div className="p-2 rounded-full bg-pink-900/40">
              <Cpu className="h-5 w-5 text-pink-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{dashboardData.overview.aiSolvedAutoDataCatalog}</div>
          <div className="text-xs text-pink-400 mt-1">Auto-discoveries</div>
        </div>
      </div>

      {/* Main Dashboard Sections - 3 Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Data Lineage Summary */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white flex items-center">
              <GitBranch className="w-5 h-5 mr-2 text-[#2AB7A9]" />
              Data Lineage Summary
            </h3>
            <Link to="/dashboard/lineage" className="text-[#2AB7A9] hover:text-[#38d6c8] text-sm font-medium">
              View Details
            </Link>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
              <span className="text-sm font-medium text-white">Source Tables</span>
              <span className="text-lg font-bold text-blue-400">{dashboardData.lineage.sourcesTables}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
              <span className="text-sm font-medium text-white">Staging Models</span>
              <span className="text-lg font-bold text-green-400">{dashboardData.lineage.stagingModels}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
              <span className="text-sm font-medium text-white">Mart Models</span>
              <span className="text-lg font-bold text-purple-400">{dashboardData.lineage.martModels}</span>
            </div>
            <div className="mt-4 p-4 bg-slate-700/30 rounded border border-slate-600">
              <h4 className="font-medium text-white mb-2">Recent Lineage Update</h4>
              <p className="text-sm text-slate-300">fct_order_items → 3 downstream dependencies</p>
              <p className="text-xs text-slate-400 mt-1">Updated 2 hours ago</p>
            </div>
          </div>
        </div>

        {/* Data Quality Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white flex items-center">
              <Shield className="w-5 h-5 mr-2 text-[#2AB7A9]" />
              Data Quality
            </h3>
            <Link to="/dashboard/quality" className="text-[#2AB7A9] hover:text-[#38d6c8] text-sm font-medium">
              View Tests
            </Link>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Success Rate</span>
              <span className="text-lg font-bold text-green-400">{dashboardData.dataQuality.successRate}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{width: `${dashboardData.dataQuality.successRate}%`}}
              ></div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-green-900/30 rounded">
                <div className="text-lg font-bold text-green-400">{dashboardData.dataQuality.passedTests}</div>
                <div className="text-xs text-green-300">Passed</div>
              </div>
              <div className="p-2 bg-yellow-900/30 rounded">
                <div className="text-lg font-bold text-yellow-400">{dashboardData.dataQuality.warningTests}</div>
                <div className="text-xs text-yellow-300">Warnings</div>
              </div>
              <div className="p-2 bg-red-900/30 rounded">
                <div className="text-lg font-bold text-red-400">{dashboardData.dataQuality.failedTests}</div>
                <div className="text-xs text-red-300">Failed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-[#2AB7A9]" />
              Critical Alerts
            </h3>
            <Link to="/dashboard/alerts" className="text-[#2AB7A9] hover:text-[#38d6c8] text-sm font-medium">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {criticalAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 border border-slate-700 rounded hover:bg-slate-700/50">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <h4 className="font-medium text-white">{alert.title}</h4>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">{alert.table}</p>
                  <p className="text-xs text-slate-400">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white flex items-center">
              <Activity className="w-5 h-5 mr-2 text-[#2AB7A9]" />
              Recent Activity
            </h3>
            <Link to="/dashboard/activity" className="text-[#2AB7A9] hover:text-[#38d6c8] text-sm font-medium">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentActivity.map(activity => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-slate-700/50 rounded">
                {getStatusIcon(activity.status)}
                <div className="flex-1">
                  <p className="text-sm text-white">{activity.message}</p>
                  <p className="text-xs text-slate-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Quality Trends Chart */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">
              Data Quality Score Trends
            </h3>
            <Link to="/dashboard/quality/trends" className="text-[#2AB7A9] hover:text-[#38d6c8] text-sm font-medium">
              View History
            </Link>
          </div>
          <DataQualityChart />
        </div>
      </div>

      {/* GitHub Code Health Section */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white flex items-center">
            <Code className="w-5 h-5 mr-2 text-[#2AB7A9]" />
            Code Health & Repository Status
          </h3>
          <Link to="/dashboard/code" className="text-[#2AB7A9] hover:text-[#38d6c8] text-sm font-medium">
            View GitHub
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            <GitBranch className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{dashboardData.codeHealth.activeRepos}</div>
            <div className="text-sm text-slate-300">Active Repos</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            <Activity className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{dashboardData.codeHealth.totalCommits}</div>
            <div className="text-sm text-slate-300">Total Commits</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{dashboardData.codeHealth.codeReviews}</div>
            <div className="text-sm text-slate-300">Code Reviews</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            <Target className="w-8 h-8 text-orange-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-white">{dashboardData.codeHealth.deployments}</div>
            <div className="text-sm text-slate-300">Deployments</div>
          </div>
        </div>
        <div className="mt-4 flex justify-between p-3 bg-slate-700/30 rounded border border-slate-600">
          <div className="flex items-center">
            <Database className="w-4 h-4 text-[#2AB7A9] mr-2" />
            <span className="text-sm text-slate-300">Latest commit: <span className="text-white">fix: schema drift detection in customer model</span></span>
          </div>
          <span className="text-xs text-slate-400">30 mins ago</span>
        </div>
      </div>
    </div>
  );
}