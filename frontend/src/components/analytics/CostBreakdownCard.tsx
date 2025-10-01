import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';

interface CostBreakdownProps {
  totalCost: number;
  actualCost: number;
  profitAmount: number;
  profitMargin: number;
  inputCost?: number;
  outputCost?: number;
  cacheCost?: number;
}

export function CostBreakdownCard({
  totalCost,
  actualCost,
  profitAmount,
  profitMargin,
  inputCost = 0,
  outputCost = 0,
  cacheCost = 0
}: CostBreakdownProps) {
  const costBreakdown = [
    { label: 'Input Tokens', value: inputCost, color: 'bg-blue-500' },
    { label: 'Output Tokens', value: outputCost, color: 'bg-purple-500' },
    { label: 'Cache', value: cacheCost, color: 'bg-green-500' }
  ].filter(item => item.value > 0);

  const total = inputCost + outputCost + cacheCost;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Cost Analysis</h3>
        <DollarSign className="h-4 w-4 text-gray-400" />
      </div>

      {/* Summary Cards - Compact */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-700 mb-0.5">Charged to Customer</p>
          <p className="text-xl font-bold text-blue-900">${totalCost.toFixed(4)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
          <p className="text-xs font-medium text-purple-700 mb-0.5">Actual API Cost</p>
          <p className="text-xl font-bold text-purple-900">${actualCost.toFixed(4)}</p>
        </div>
      </div>

      {/* Profit Metrics - Compact */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-3 border border-green-200">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-green-700">Net Profit</span>
          {profitAmount > 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
          )}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold text-green-900">${profitAmount.toFixed(4)}</span>
          <div className="flex items-center space-x-1">
            <span className="text-base font-semibold text-green-700">{profitMargin.toFixed(1)}%</span>
            <span className="text-xs text-green-600">margin</span>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      {costBreakdown.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 mb-2">Cost Distribution</h4>
          
          {/* Visual breakdown bar */}
          <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
            {costBreakdown.map((item, index) => (
              <div
                key={index}
                className={item.color}
                style={{ width: `${(item.value / total) * 100}%` }}
              />
            ))}
          </div>

          {/* Breakdown items */}
          <div className="space-y-1.5">
            {costBreakdown.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5">
                  <div className={`w-2.5 h-2.5 rounded ${item.color}`} />
                  <span className="text-gray-600">{item.label}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-medium text-gray-900">${item.value.toFixed(4)}</span>
                  <span className="text-xs text-gray-500">
                    ({((item.value / total) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Efficiency Insight */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-start space-x-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Your profit margin of <span className="font-semibold text-gray-900">{profitMargin.toFixed(1)}%</span> represents 
            a <span className="font-semibold text-gray-900">${profitAmount.toFixed(4)}</span> return on 
            infrastructure costs.
          </p>
        </div>
      </div>
    </div>
  );
}
