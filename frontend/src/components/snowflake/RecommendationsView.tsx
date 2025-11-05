import { useEffect, useState, useCallback } from 'react';
import { 
  Lightbulb, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  Loader2,
  Code,
  X,
  Check,
  Ban
} from 'lucide-react';
import recommendationsService, { Recommendation, RecommendationsSummary } from '../../services/snowflakeRecommendationsService';

interface Props {
  connectorId: string;
}

export default function RecommendationsView({ connectorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RecommendationsSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filter, setFilter] = useState<{ status?: string; priority?: string; type?: string }>({});
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [showSQLModal, setShowSQLModal] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryData, recsData] = await Promise.all([
        recommendationsService.getSummary(connectorId),
        recommendationsService.listRecommendations(connectorId, filter)
      ]);
      setSummary(summaryData);
      setRecommendations(recsData);
    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recommendations');
      setSummary(null);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [connectorId, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApply = async (recId: string) => {
    if (!confirm('Are you sure you want to apply this recommendation? This will execute SQL commands on your Snowflake account.')) {
      return;
    }

    try {
      setApplying(recId);
      await recommendationsService.applyRecommendation(connectorId, recId);
      await loadData();
      alert('Recommendation applied successfully!');
    } catch (error) {
      alert(`Failed to apply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setApplying(null);
    }
  };

  const handleDismiss = async (recId: string) => {
    const reason = prompt('Why are you dismissing this recommendation? (optional)');
    
    try {
      setDismissing(recId);
      await recommendationsService.dismissRecommendation(connectorId, recId, reason || undefined);
      await loadData();
    } catch (error) {
      alert(`Failed to dismiss: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDismissing(null);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await recommendationsService.generateRecommendations(connectorId);
      await loadData();
      alert('Recommendations generated successfully!');
    } catch (error) {
      alert(`Failed to generate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const priorityColors = {
    high: 'text-red-400 bg-red-500/10 border-red-500/20',
    medium: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    low: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  };

  const effortIcons = {
    easy: '⚡',
    medium: '⚙️',
    hard: '🔧'
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6a3c]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-[#161413] border border-[#2d2a27] rounded-xl">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Failed to Load Recommendations</h3>
        <p className="text-[#8d857b] text-sm mb-4">{error}</p>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-[#ff6a3c] hover:bg-[#d94a1e] text-white rounded-lg font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-[#ff6a3c]" />
            AI-Powered Recommendations
          </h2>
          <p className="text-[#8d857b] mt-1">Automated cost optimization suggestions</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-[#ff6a3c] hover:bg-[#ff7a4c] text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" />
              Generate New
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Pending */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-6 h-6 text-yellow-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">Pending</span>
            </div>
            <div className="text-3xl font-bold text-white">{summary.by_status.pending}</div>
            <div className="text-[#8d857b] text-sm mt-1">Ready to apply</div>
          </div>

          {/* Potential Savings */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">Potential</span>
            </div>
            <div className="text-3xl font-bold text-green-400">
              {formatCurrency(summary.total_potential_savings)}
            </div>
            <div className="text-[#8d857b] text-sm mt-1">/month</div>
          </div>

          {/* Applied */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-6 h-6 text-blue-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">Applied</span>
            </div>
            <div className="text-3xl font-bold text-white">{summary.by_status.applied}</div>
            <div className="text-[#8d857b] text-sm mt-1">
              Saving {formatCurrency(summary.applied_savings)}/mo
            </div>
          </div>

          {/* High Priority */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">High Priority</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{summary.by_priority.high}</div>
            <div className="text-[#8d857b] text-sm mt-1">Quick wins</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filter.status || ''}
          onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          className="px-4 py-2 bg-[#161413] border border-[#2d2a27] rounded-lg text-white text-sm focus:outline-none focus:border-[#ff6a3c]"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="applied">Applied</option>
          <option value="dismissed">Dismissed</option>
        </select>

        <select
          value={filter.priority || ''}
          onChange={(e) => setFilter({ ...filter, priority: e.target.value || undefined })}
          className="px-4 py-2 bg-[#161413] border border-[#2d2a27] rounded-lg text-white text-sm focus:outline-none focus:border-[#ff6a3c]"
        >
          <option value="">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>

        <select
          value={filter.type || ''}
          onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
          className="px-4 py-2 bg-[#161413] border border-[#2d2a27] rounded-lg text-white text-sm focus:outline-none focus:border-[#ff6a3c]"
        >
          <option value="">All Types</option>
          <option value="warehouse_resize">Warehouse Resize</option>
          <option value="auto_suspend">Auto-Suspend</option>
          <option value="enable_cache">Enable Caching</option>
          <option value="archive_table">Archive Table</option>
          <option value="disable_clustering">Disable Clustering</option>
        </select>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <div className="text-center py-12 bg-[#161413] border border-[#2d2a27] rounded-xl">
            <Lightbulb className="w-16 h-16 text-[#8d857b] mx-auto mb-4" />
            <p className="text-[#8d857b] text-lg">No recommendations found</p>
            <p className="text-[#8d857b] text-sm mt-2">Click "Generate New" to analyze your Snowflake usage</p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${priorityColors[rec.priority]}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className="text-[#8d857b] text-sm">
                      {effortIcons[rec.effort_level]} {rec.effort_level}
                    </span>
                    <span className="text-[#8d857b] text-sm">
                      {(rec.confidence_score || 0).toFixed(0)}% confidence
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-white mb-2">{rec.title}</h3>

                  {/* Description */}
                  <p className="text-[#8d857b] mb-4">{rec.description}</p>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {rec.current_value && (
                      <div>
                        <div className="text-[#8d857b] text-xs uppercase mb-1">Current</div>
                        <div className="text-white font-medium">{rec.current_value}</div>
                      </div>
                    )}
                    {rec.recommended_value && (
                      <div>
                        <div className="text-[#8d857b] text-xs uppercase mb-1">Recommended</div>
                        <div className="text-green-400 font-medium">{rec.recommended_value}</div>
                      </div>
                    )}
                  </div>

                  {/* Savings */}
                  <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-bold text-lg">
                      {formatCurrency(rec.estimated_monthly_savings_usd)}/month
                    </span>
                    <span className="text-green-400 text-sm">
                      = {formatCurrency(rec.estimated_monthly_savings_usd * 12)}/year
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {rec.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedRec(rec);
                          setShowSQLModal(true);
                        }}
                        className="px-4 py-2 bg-[#2d2a27] hover:bg-[#3d3a37] text-white rounded-lg text-sm flex items-center gap-2"
                      >
                        <Code className="w-4 h-4" />
                        View SQL
                      </button>
                      <button
                        onClick={() => handleApply(rec.id)}
                        disabled={applying === rec.id}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                      >
                        {applying === rec.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Apply
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDismiss(rec.id)}
                        disabled={dismissing === rec.id}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                      >
                        {dismissing === rec.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Dismissing...
                          </>
                        ) : (
                          <>
                            <Ban className="w-4 h-4" />
                            Dismiss
                          </>
                        )}
                      </button>
                    </>
                  )}
                  {rec.status === 'applied' && (
                    <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Applied
                    </div>
                  )}
                  {rec.status === 'dismissed' && (
                    <div className="px-4 py-2 bg-gray-500/10 border border-gray-500/20 rounded-lg text-gray-400 text-sm font-medium flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Dismissed
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SQL Preview Modal */}
      {showSQLModal && selectedRec && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-[#161413] border-b border-[#2d2a27] p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">SQL Commands</h3>
              <button
                onClick={() => setShowSQLModal(false)}
                className="p-2 hover:bg-[#2d2a27] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-[#0d0c0a] border border-[#2d2a27] rounded-lg p-4">
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                  {selectedRec.sql_commands.join('\n\n')}
                </pre>
              </div>
              {selectedRec.implementation_notes && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-yellow-400 font-medium mb-1">Implementation Notes</div>
                      <div className="text-[#8d857b] text-sm">{selectedRec.implementation_notes}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
