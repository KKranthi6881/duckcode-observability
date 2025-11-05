import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle, TrendingUp, DollarSign, Zap, Archive, Database, AlertTriangle } from 'lucide-react';
import { enterpriseService } from '../../services/enterpriseService';

interface Connector {
  id: string;
  name: string;
  connector_type: string;
}

interface Recommendation {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'applied' | 'dismissed' | 'failed';
  warehouse_name?: string;
  database_name?: string;
  schema_name?: string;
  table_name?: string;
  title: string;
  description: string;
  current_value?: string;
  recommended_value?: string;
  estimated_monthly_savings_usd: number;
  confidence_score: number;
  effort_level: 'easy' | 'medium' | 'hard';
  sql_commands: string[];
  created_at: string;
}

interface RecommendationsSummary {
  total: number;
  by_status: {
    pending: number;
    applied: number;
    dismissed: number;
    failed: number;
    expired: number;
  };
  by_priority: {
    high: number;
    medium: number;
    low: number;
  };
  total_potential_savings: number;
  applied_savings: number;
}

interface ROISummary {
  total_recommendations_applied: number;
  total_projected_savings: number;
  total_actual_savings: number;
  average_variance_percent: number;
  roi_percentage: number;
  annual_savings: number;
  product_cost_annual: number;
  payback_period_months: number;
}

export default function SnowflakeRecommendations() {
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<RecommendationsSummary | null>(null);
  const [roiSummary, setROISummary] = useState<ROISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Selected recommendation for detail view
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  // Load user's organization
  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const orgs = await enterpriseService.organization.getUserOrganizations();
        if (orgs && orgs.length > 0) {
          setOrganizationId(orgs[0].organization_id);
        }
      } catch (err) {
        console.error('Error loading organization:', err);
      }
    };
    loadOrganization();
  }, []);
  
  // Load connectors when organization is available
  useEffect(() => {
    if (!organizationId) return;
    
    const loadConnectors = async () => {
      try {
        const res = await fetch(`/api/connectors?organizationId=${organizationId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          const snowflakeConnectors = (data.connectors?.filter((c: Connector) => c.connector_type === 'snowflake') || []) as Connector[];
          setConnectors(snowflakeConnectors);
          if (snowflakeConnectors.length > 0 && !connectorId) {
            setConnectorId(snowflakeConnectors[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading connectors:', err);
      }
    };
    loadConnectors();
  }, [organizationId]);

  const loadData = useCallback(async () => {
    if (!connectorId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const [recsRes, summaryRes, roiRes] = await Promise.all([
        fetch(`/api/connectors/${connectorId}/recommendations?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/connectors/${connectorId}/recommendations/summary`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/connectors/${connectorId}/roi`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
      ]);

      if (recsRes.ok && summaryRes.ok && roiRes.ok) {
        const recsData = await recsRes.json();
        const summaryData = await summaryRes.json();
        const roiData = await roiRes.json();
        
        setRecommendations(recsData.data || []);
        setSummary(summaryData.data);
        setROISummary(roiData.data?.summary);
        setError(null);
      } else {
        setError('Failed to load recommendations');
      }
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [connectorId, statusFilter, priorityFilter, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyRecommendation = async (recId: string) => {
    if (!confirm('Are you sure you want to apply this recommendation? This will execute SQL commands on your Snowflake instance.')) {
      return;
    }

    try {
      const res = await fetch(`/api/connectors/${connectorId}/recommendations/${recId}/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        alert('Recommendation applied successfully!');
        loadData();
      } else {
        const errorData = await res.json();
        alert(`Failed to apply recommendation: ${errorData.error}`);
      }
    } catch (err) {
      alert('Error applying recommendation');
    }
  };

  const dismissRecommendation = async (recId: string) => {
    const reason = prompt('Please provide a reason for dismissing this recommendation (optional):');
    
    try {
      const res = await fetch(`/api/connectors/${connectorId}/recommendations/${recId}/dismiss`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (res.ok) {
        alert('Recommendation dismissed');
        loadData();
      } else {
        alert('Failed to dismiss recommendation');
      }
    } catch (err) {
      alert('Error dismissing recommendation');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'warehouse_resize': return <Database className="w-5 h-5" />;
      case 'auto_suspend': return <Zap className="w-5 h-5" />;
      case 'enable_cache': return <TrendingUp className="w-5 h-5" />;
      case 'archive_table': return <Archive className="w-5 h-5" />;
      case 'disable_clustering': return <AlertTriangle className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading recommendations...</div></div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-800 rounded">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Connector Selector */}
      {connectors.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Snowflake Connection
          </label>
          <select
            value={connectorId || ''}
            onChange={(e) => setConnectorId(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            {connectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Smart Recommendations</h1>
          <p className="text-sm text-gray-500">AI-powered cost optimization recommendations</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      {/* ROI Summary Cards */}
      {roiSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Potential Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${summary?.total_potential_savings.toLocaleString() || 0}/mo
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Applied Savings</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${summary?.applied_savings.toLocaleString() || 0}/mo
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ROI</p>
                <p className="text-2xl font-bold text-purple-600">
                  {roiSummary.roi_percentage}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Recommendations</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary?.by_status.pending || 0} pending
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="applied">Applied</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-gray-600 block mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-gray-600 block mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded"
            >
              <option value="all">All Types</option>
              <option value="warehouse_resize">Warehouse Resize</option>
              <option value="auto_suspend">Auto-Suspend</option>
              <option value="enable_cache">Enable Cache</option>
              <option value="archive_table">Archive Table</option>
              <option value="disable_clustering">Disable Clustering</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recommendation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effort</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No recommendations found
                </td>
              </tr>
            ) : (
              recommendations.map((rec) => (
                <tr key={rec.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(rec.priority)}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(rec.type)}
                      <span className="text-sm text-gray-600">
                        {rec.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{rec.title}</p>
                      <p className="text-sm text-gray-500">{rec.description.substring(0, 100)}...</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-green-600">
                      ${rec.estimated_monthly_savings_usd.toFixed(0)}/mo
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{rec.confidence_score}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 capitalize">{rec.effort_level}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedRec(rec);
                          setShowDetail(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View
                      </button>
                      {rec.status === 'pending' && (
                        <>
                          <button
                            onClick={() => applyRecommendation(rec.id)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => dismissRecommendation(rec.id)}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {showDetail && selectedRec && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold">{selectedRec.title}</h2>
                  <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(selectedRec.priority)}`}>
                    {selectedRec.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{selectedRec.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Current State</h3>
                  <p className="text-gray-600">{selectedRec.current_value || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Recommended State</h3>
                  <p className="text-gray-600">{selectedRec.recommended_value || 'N/A'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Monthly Savings</h3>
                  <p className="text-2xl font-bold text-green-600">
                    ${selectedRec.estimated_monthly_savings_usd.toFixed(0)}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Confidence</h3>
                  <p className="text-2xl font-bold text-blue-600">{selectedRec.confidence_score}%</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Effort</h3>
                  <p className="text-2xl font-bold text-gray-600 capitalize">{selectedRec.effort_level}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-2">SQL Commands</h3>
                <pre className="bg-gray-50 p-4 rounded text-sm overflow-x-auto">
                  {selectedRec.sql_commands.join('\n')}
                </pre>
              </div>
              
              {selectedRec.status === 'pending' && (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      applyRecommendation(selectedRec.id);
                      setShowDetail(false);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Apply Recommendation
                  </button>
                  <button
                    onClick={() => {
                      dismissRecommendation(selectedRec.id);
                      setShowDetail(false);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
