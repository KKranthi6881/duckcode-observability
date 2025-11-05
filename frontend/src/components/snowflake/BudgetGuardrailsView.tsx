import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle, Loader2, Plus, Edit2, Trash2, Bell, Calendar, Target, TrendingDown, X } from 'lucide-react';
import budgetService, { Budget, BudgetSpend } from '../../services/budgetService';

interface Props {
  connectorId: string;
}

export default function BudgetGuardrailsView({ connectorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetSpends, setBudgetSpends] = useState<Map<string, BudgetSpend>>(new Map());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState({
    budget_name: '',
    budget_type: 'connector' as 'organization' | 'connector' | 'warehouse',
    warehouse_name: '',
    budget_amount: 50000,
    budget_period: 'monthly' as 'monthly' | 'quarterly' | 'annually',
    alert_threshold_1: 75,
    alert_threshold_2: 90,
    alert_threshold_3: 100,
    email_alerts: true,
    alert_emails: '',  // Comma-separated email addresses
    slack_webhook_url: '',
    auto_suspend_at_limit: false,  // DISABLED - dangerous feature
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const budgetsList = await budgetService.listBudgets(connectorId);
      setBudgets(budgetsList);

      // Load spend data for each budget
      const spendsMap = new Map<string, BudgetSpend>();
      await Promise.all(
        budgetsList.map(async (budget) => {
          try {
            const spend = await budgetService.getCurrentSpend(connectorId, budget.id);
            spendsMap.set(budget.id, spend);
          } catch (err) {
            console.error(`Error loading spend for budget ${budget.id}:`, err);
          }
        })
      );
      setBudgetSpends(spendsMap);
    } catch (err) {
      console.error('Error loading budgets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [connectorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBudget = async () => {
    try {
      await budgetService.createBudget(connectorId, formData);
      setShowCreateForm(false);
      setFormData({
        budget_name: '',
        budget_type: 'connector',
        warehouse_name: '',
        budget_amount: 50000,
        budget_period: 'monthly',
        alert_threshold_1: 75,
        alert_threshold_2: 90,
        alert_threshold_3: 100,
        email_alerts: true,
        alert_emails: '',
        slack_webhook_url: '',
        auto_suspend_at_limit: false,
      });
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create budget');
    }
  };

  const handleUpdateBudget = async () => {
    if (!editingBudget) return;
    
    try {
      await budgetService.updateBudget(connectorId, editingBudget.id, formData);
      setEditingBudget(null);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update budget');
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    
    try {
      await budgetService.deleteBudget(connectorId, budgetId);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete budget');
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

  const getStatusColor = (percentage: number, budget: Budget) => {
    if (percentage >= budget.alert_threshold_3) return 'red';
    if (percentage >= budget.alert_threshold_2) return 'orange';
    if (percentage >= budget.alert_threshold_1) return 'yellow';
    return 'green';
  };

  const getStatusText = (percentage: number, budget: Budget) => {
    if (percentage >= 100) return 'Budget Exceeded';
    if (percentage >= budget.alert_threshold_3) return 'Critical';
    if (percentage >= budget.alert_threshold_2) return 'Warning';
    if (percentage >= budget.alert_threshold_1) return 'Caution';
    return 'On Track';
  };

  if (loading) {
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
        <h3 className="text-xl font-bold text-white mb-2">Failed to Load Budgets</h3>
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

  const activeBudgets = budgets.filter(b => b.status === 'active');
  const totalBudget = activeBudgets.reduce((sum, b) => sum + b.budget_amount, 0);
  const totalSpend = activeBudgets.reduce((sum, b) => {
    const spend = budgetSpends.get(b.id);
    return sum + (spend?.current_spend || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-[#ff6a3c]" />
            Budget Guardrails
          </h2>
          <p className="text-[#8d857b] mt-1">Prevent cost overruns with real-time monitoring</p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingBudget(null);
          }}
          className="px-4 py-2 bg-[#ff6a3c] hover:bg-[#d94a1e] text-white rounded-lg font-medium flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          Create Budget
        </button>
      </div>

      {/* Summary Cards - Professional Dark Theme */}
      {activeBudgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Budget */}
          <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-blue-500/30 transition">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-blue-400" />
              <span className="text-[#8d857b] text-sm uppercase tracking-wider">Total Budget</span>
            </div>
            <div className="text-3xl font-bold text-white">{formatCurrency(totalBudget)}</div>
            <div className="text-sm text-[#8d857b] mt-1">{activeBudgets.length} active budgets</div>
          </div>

          {/* Current Spend */}
          <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-purple-500/30 transition">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              <span className="text-[#8d857b] text-sm uppercase tracking-wider">Current Spend</span>
            </div>
            <div className="text-3xl font-bold text-white">{formatCurrency(totalSpend)}</div>
            <div className="text-sm text-[#8d857b] mt-1">
              {totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : 0}% of total budget
            </div>
          </div>

          {/* Remaining */}
          <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-green-500/30 transition">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-6 h-6 text-green-400" />
              <span className="text-[#8d857b] text-sm uppercase tracking-wider">Remaining</span>
            </div>
            <div className="text-3xl font-bold text-white">{formatCurrency(totalBudget - totalSpend)}</div>
            <div className="text-sm text-[#8d857b] mt-1">Across all budgets</div>
          </div>
        </div>
      )}

      {/* Create/Edit Budget Form */}
      {(showCreateForm || editingBudget) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-[#161413] border-b border-[#2d2a27] p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingBudget ? 'Edit Budget' : 'Create Budget'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingBudget(null);
                }}
                className="p-2 hover:bg-[#2d2a27] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Budget Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Budget Name</label>
                <input
                  type="text"
                  value={formData.budget_name}
                  onChange={(e) => setFormData({ ...formData, budget_name: e.target.value })}
                  placeholder="e.g., Monthly Production Budget"
                  className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded-lg px-4 py-2 text-white focus:border-[#ff6a3c] focus:outline-none"
                />
              </div>

              {/* Budget Type */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Budget Type</label>
                <select
                  value={formData.budget_type}
                  onChange={(e) => setFormData({ ...formData, budget_type: e.target.value as any })}
                  className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded-lg px-4 py-2 text-white focus:border-[#ff6a3c] focus:outline-none"
                >
                  <option value="organization">Organization Level</option>
                  <option value="connector">Connector Level</option>
                  <option value="warehouse">Warehouse Level</option>
                </select>
              </div>

              {/* Warehouse Name (if warehouse type) */}
              {formData.budget_type === 'warehouse' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Warehouse Name</label>
                  <input
                    type="text"
                    value={formData.warehouse_name}
                    onChange={(e) => setFormData({ ...formData, warehouse_name: e.target.value })}
                    placeholder="e.g., COMPUTE_WH"
                    className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded-lg px-4 py-2 text-white focus:border-[#ff6a3c] focus:outline-none"
                  />
                </div>
              )}

              {/* Budget Amount */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Budget Amount (USD)</label>
                <input
                  type="number"
                  value={formData.budget_amount}
                  onChange={(e) => setFormData({ ...formData, budget_amount: parseFloat(e.target.value) })}
                  className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded-lg px-4 py-2 text-white focus:border-[#ff6a3c] focus:outline-none"
                />
              </div>

              {/* Budget Period */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Budget Period</label>
                <select
                  value={formData.budget_period}
                  onChange={(e) => setFormData({ ...formData, budget_period: e.target.value as any })}
                  className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded-lg px-4 py-2 text-white focus:border-[#ff6a3c] focus:outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>

              {/* Alert Thresholds */}
              <div className="border border-[#2d2a27] rounded-lg p-4 space-y-3">
                <h4 className="text-white font-medium">Alert Thresholds</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#8d857b] mb-1">Threshold 1 (%)</label>
                    <input
                      type="number"
                      value={formData.alert_threshold_1}
                      onChange={(e) => setFormData({ ...formData, alert_threshold_1: parseInt(e.target.value) })}
                      className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8d857b] mb-1">Threshold 2 (%)</label>
                    <input
                      type="number"
                      value={formData.alert_threshold_2}
                      onChange={(e) => setFormData({ ...formData, alert_threshold_2: parseInt(e.target.value) })}
                      className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8d857b] mb-1">Threshold 3 (%)</label>
                    <input
                      type="number"
                      value={formData.alert_threshold_3}
                      onChange={(e) => setFormData({ ...formData, alert_threshold_3: parseInt(e.target.value) })}
                      className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="border border-[#2d2a27] rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="w-5 h-5 text-[#ff6a3c]" />
                  <h4 className="text-white font-medium">Notification Settings</h4>
                </div>

                {/* Email Alerts */}
                <div>
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={formData.email_alerts}
                      onChange={(e) => setFormData({ ...formData, email_alerts: e.target.checked })}
                      className="w-4 h-4 rounded border-[#2d2a27] bg-[#0d0c0a] text-[#ff6a3c] focus:ring-[#ff6a3c]"
                    />
                    <span className="text-white text-sm font-medium">Enable email alerts</span>
                  </label>

                  {formData.email_alerts && (
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Alert Recipients (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.alert_emails}
                        onChange={(e) => setFormData({ ...formData, alert_emails: e.target.value })}
                        placeholder="email1@company.com, email2@company.com"
                        className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded-lg px-4 py-2 text-white text-sm focus:border-[#ff6a3c] focus:outline-none"
                      />
                      <p className="text-xs text-[#8d857b] mt-1">
                        Enter email addresses separated by commas. Leave empty to send to all organization admins.
                      </p>
                    </div>
                  )}
                </div>

                {/* Slack Webhook */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Slack Webhook URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.slack_webhook_url}
                    onChange={(e) => setFormData({ ...formData, slack_webhook_url: e.target.value })}
                    placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
                    className="w-full bg-[#0d0c0a] border border-[#2d2a27] rounded-lg px-4 py-2 text-white text-sm focus:border-[#ff6a3c] focus:outline-none"
                  />
                  <div className="mt-2 text-xs text-[#8d857b] space-y-1">
                    <p>💡 Get your webhook URL:</p>
                    <ol className="list-decimal list-inside ml-2 space-y-0.5">
                      <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-[#ff6a3c] hover:underline">api.slack.com/apps</a></li>
                      <li>Create New App → From scratch</li>
                      <li>Enable "Incoming Webhooks"</li>
                      <li>Add webhook to workspace</li>
                      <li>Copy webhook URL and paste here</li>
                    </ol>
                  </div>
                </div>

                {/* Safety Note */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-xs text-blue-300">
                    ℹ️ <strong>Safety First:</strong> We don't automatically modify your Snowflake resources. You'll receive alerts via email/Slack when thresholds are reached, allowing you to take appropriate action.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={editingBudget ? handleUpdateBudget : handleCreateBudget}
                  className="flex-1 px-4 py-2 bg-[#ff6a3c] hover:bg-[#d94a1e] text-white rounded-lg font-medium transition"
                >
                  {editingBudget ? 'Update Budget' : 'Create Budget'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingBudget(null);
                  }}
                  className="px-4 py-2 bg-[#2d2a27] hover:bg-[#3d3a37] text-white rounded-lg font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget List */}
      {budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-[#2d2a27] rounded-lg">
          <Target className="w-16 h-16 text-[#4a4745] mb-4" />
          <h4 className="text-white font-medium mb-2">No Budgets Yet</h4>
          <p className="text-sm text-[#8d857b] text-center max-w-md mb-4">
            Create your first budget to start monitoring and controlling your Snowflake costs.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-[#ff6a3c] hover:bg-[#d94a1e] text-white rounded-lg font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Create Budget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {budgets.map((budget) => {
            const spend = budgetSpends.get(budget.id);
            const percentage = spend ? spend.percentage_used : 0;
            const statusColor = getStatusColor(percentage, budget);
            const statusText = getStatusText(percentage, budget);

            return (
              <div
                key={budget.id}
                className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6 hover:border-[#3d3a37] transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{budget.budget_name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        statusColor === 'red' ? 'bg-red-500/20 text-red-400' :
                        statusColor === 'orange' ? 'bg-orange-500/20 text-orange-400' :
                        statusColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {statusText}
                      </span>
                      {budget.status === 'paused' && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500/20 text-gray-400">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-[#8d857b]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {budget.budget_period.charAt(0).toUpperCase() + budget.budget_period.slice(1)}
                      </span>
                      <span>{budget.budget_type.charAt(0).toUpperCase() + budget.budget_type.slice(1)} Level</span>
                      {budget.warehouse_name && <span>Warehouse: {budget.warehouse_name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingBudget(budget);
                        setFormData({
                          budget_name: budget.budget_name,
                          budget_type: budget.budget_type,
                          warehouse_name: budget.warehouse_name || '',
                          budget_amount: budget.budget_amount,
                          budget_period: budget.budget_period,
                          alert_threshold_1: budget.alert_threshold_1,
                          alert_threshold_2: budget.alert_threshold_2,
                          alert_threshold_3: budget.alert_threshold_3,
                          email_alerts: budget.email_alerts,
                          alert_emails: (budget as any).alert_emails?.join(', ') || '',
                          slack_webhook_url: budget.slack_webhook_url || '',
                          auto_suspend_at_limit: budget.auto_suspend_at_limit,
                        });
                      }}
                      className="p-2 hover:bg-[#2d2a27] rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-[#8d857b]" />
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="p-2 hover:bg-[#2d2a27] rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {spend && (
                  <>
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-2xl font-bold text-white">{formatCurrency(spend.current_spend)}</span>
                          <span className="text-[#8d857b] text-sm ml-2">of {formatCurrency(budget.budget_amount)}</span>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            statusColor === 'red' ? 'text-red-400' :
                            statusColor === 'orange' ? 'text-orange-400' :
                            statusColor === 'yellow' ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {percentage.toFixed(1)}%
                          </div>
                          <div className="text-[#8d857b] text-xs">Used</div>
                        </div>
                      </div>

                      <div className="w-full bg-[#0d0c0a] rounded-full h-4 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            statusColor === 'red' ? 'bg-gradient-to-r from-red-600 to-red-500' :
                            statusColor === 'orange' ? 'bg-gradient-to-r from-orange-600 to-orange-500' :
                            statusColor === 'yellow' ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' :
                            'bg-gradient-to-r from-green-600 to-green-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Forecast & Details */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-[#8d857b] mb-1">Remaining</div>
                        <div className="text-white font-medium">{formatCurrency(spend.remaining_budget)}</div>
                      </div>
                      {spend.projected_end_of_period_spend !== undefined && (
                        <div>
                          <div className="text-[#8d857b] mb-1">Projected</div>
                          <div className={`font-medium ${
                            (spend.projected_end_of_period_spend || 0) > budget.budget_amount ? 'text-red-400' : 'text-white'
                          }`}>
                            {formatCurrency(spend.projected_end_of_period_spend || 0)}
                          </div>
                        </div>
                      )}
                      {spend.days_until_limit && (
                        <div>
                          <div className="text-[#8d857b] mb-1">Limit Date</div>
                          <div className="text-orange-400 font-medium">
                            {new Date(spend.days_until_limit).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Alert Indicators */}
                    <div className="mt-4 flex items-center gap-2 text-xs">
                      {budget.email_alerts && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                          <Bell className="w-3 h-3" />
                          Email Alerts
                        </span>
                      )}
                      {budget.auto_suspend_at_limit && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                          <AlertCircle className="w-3 h-3" />
                          Auto-Suspend
                        </span>
                      )}
                      {(spend.projected_overage || 0) > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded">
                          <TrendingUp className="w-3 h-3" />
                          Projected Overage: {formatCurrency(spend.projected_overage || 0)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
