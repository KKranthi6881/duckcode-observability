import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, DollarSign, CheckCircle, Target, Calendar, Loader2, Clock } from 'lucide-react';
import recommendationsService, { ROISummary, ROIBreakdownItem } from '../../services/snowflakeRecommendationsService';

interface Props {
  connectorId: string;
}

export default function ROITrackerView({ connectorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ROISummary | null>(null);
  const [breakdown, setBreakdown] = useState<ROIBreakdownItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await recommendationsService.getROI(connectorId);
      setSummary(data.summary);
      setBreakdown(data.breakdown);
    } catch (error) {
      console.error('Error loading ROI data:', error);
    } finally {
      setLoading(false);
    }
  }, [connectorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6a3c]" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12 bg-[#161413] border border-[#2d2a27] rounded-xl">
        <Target className="w-16 h-16 text-[#8d857b] mx-auto mb-4" />
        <p className="text-[#8d857b] text-lg">No ROI data available yet</p>
        <p className="text-[#8d857b] text-sm mt-2">Apply some recommendations to start tracking ROI</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Target className="w-8 h-8 text-[#ff6a3c]" />
          ROI Tracker
        </h2>
        <p className="text-[#8d857b] mt-1">Track savings from implemented recommendations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Applied Recommendations */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">Applied</span>
          </div>
          <div className="text-3xl font-bold text-white">{summary.applied_recommendations || 0}</div>
          <div className="text-[#8d857b] text-sm mt-1">
            of {summary.total_recommendations || 0} total
          </div>
        </div>

        {/* Projected Savings */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-6 h-6 text-blue-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">Projected</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">
            {formatCurrency(summary.projected_annual_savings || 0)}
          </div>
          <div className="text-[#8d857b] text-sm mt-1">/year</div>
        </div>

        {/* Actual Savings */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-6 h-6 text-green-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">Actual</span>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {formatCurrency(summary.actual_annual_savings || 0)}
          </div>
          <div className="text-[#8d857b] text-sm mt-1">/year</div>
        </div>

        {/* ROI Percentage */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-6 h-6 text-purple-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">ROI</span>
          </div>
          <div className="text-3xl font-bold text-purple-400">
            {(summary.roi_percentage || 0).toFixed(0)}%
          </div>
          <div className="text-[#8d857b] text-sm mt-1">
            Payback: {(summary.payback_months || 0).toFixed(1)} months
          </div>
        </div>
      </div>

      {/* Savings Visualization */}
      <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Projected vs Actual Savings</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#8d857b] text-sm">Projected Annual Savings</span>
              <span className="text-blue-400 font-bold">
                {formatCurrency(summary.projected_annual_savings || 0)}
              </span>
            </div>
            <div className="w-full bg-[#0d0c0a] rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#8d857b] text-sm">Actual Annual Savings</span>
              <span className="text-green-400 font-bold">
                {formatCurrency(summary.actual_annual_savings || 0)}
              </span>
            </div>
            <div className="w-full bg-[#0d0c0a] rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full transition-all"
                style={{ 
                  width: `${Math.min(((summary.actual_annual_savings || 0) / (summary.projected_annual_savings || 1)) * 100, 100)}%` 
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      {breakdown.length > 0 && (
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[#2d2a27]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Detailed Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0d0c0a]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                    Recommendation
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                    Projected
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2a27]">
                {breakdown.map((item) => (
                  <tr key={item.id} className="hover:bg-[#0d0c0a] transition-colors">
                    <td className="px-6 py-4 text-sm text-white">
                      {item.recommendation_title}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-blue-400 font-medium">
                      {formatCurrency(item.projected_savings_usd)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-green-400 font-medium">
                      {formatCurrency(item.actual_savings_usd)}
                    </td>
                    <td className={`px-6 py-4 text-sm text-right font-medium ${
                      item.variance_percent >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {item.variance_percent >= 0 ? '+' : ''}{item.variance_percent.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.measurement_period_end ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Measured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 text-xs">
                          <Clock className="w-3 h-3" />
                          Tracking
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success Message */}
      {(summary.actual_annual_savings || 0) > 0 && (
        <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-400 mb-2">
                Great Progress! 🎉
              </h3>
              <p className="text-[#8d857b] mb-3">
                You've saved <span className="text-green-400 font-bold">{formatCurrency(summary.actual_annual_savings || 0)}</span> annually 
                by implementing {summary.applied_recommendations || 0} recommendations. 
                {(summary.actual_annual_savings || 0) >= (summary.projected_annual_savings || 0) ? (
                  <span className="text-green-400 font-medium"> You've exceeded your savings target!</span>
                ) : (
                  <span> You're on track to reach your {formatCurrency(summary.projected_annual_savings || 0)} annual savings goal.</span>
                )}
              </p>
              <div className="text-sm text-[#8d857b]">
                ROI: <span className="text-purple-400 font-bold">{(summary.roi_percentage || 0).toFixed(0)}%</span> | 
                Payback Period: <span className="text-purple-400 font-bold">{(summary.payback_months || 0).toFixed(1)} months</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
