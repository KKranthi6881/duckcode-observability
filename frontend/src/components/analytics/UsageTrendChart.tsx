import { TrendingUp, Calendar } from 'lucide-react';

interface DailyData {
  usage_date: string;
  total_conversations: number;
  total_messages: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  actual_api_cost?: number;
  profit_amount?: number;
}

interface UsageTrendChartProps {
  data: DailyData[];
  metric: 'conversations' | 'tokens' | 'cost' | 'profit';
  title: string;
}

export function UsageTrendChart({ data, metric, title }: UsageTrendChartProps) {
  const getValue = (item: DailyData): number => {
    switch (metric) {
      case 'conversations':
        return item.total_conversations;
      case 'tokens':
        return item.total_tokens_in + item.total_tokens_out;
      case 'cost':
        return item.total_cost;
      case 'profit':
        return item.profit_amount || 0;
      default:
        return 0;
    }
  };

  const maxValue = Math.max(...data.map(getValue), 1);
  const total = data.reduce((sum, item) => sum + getValue(item), 0);
  const average = data.length > 0 ? total / data.length : 0;

  const formatValue = (value: number): string => {
    if (metric === 'cost' || metric === 'profit') {
      return `$${value.toFixed(2)}`;
    } else if (metric === 'tokens') {
      return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString();
    }
    return value.toString();
  };

  const getBarColor = (metric: string): string => {
    if (metric === 'profit') {
      return '#10b981'; // Green
    } else if (metric === 'cost') {
      return '#f59e0b'; // Amber
    } else if (metric === 'tokens') {
      return '#8b5cf6'; // Purple
    }
    return '#3b82f6'; // Blue
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center space-x-2 mt-0.5">
            <span className="text-xs text-gray-500">
              Total: <span className="font-medium text-gray-900">{formatValue(total)}</span>
            </span>
            <span className="text-xs text-gray-500">
              Avg: <span className="font-medium text-gray-900">{formatValue(average)}</span>
            </span>
          </div>
        </div>
        <TrendingUp className="h-4 w-4 text-gray-400" />
      </div>

      {/* Chart */}
      <div className="space-y-1.5">
        {data.map((item, index) => {
          const value = getValue(item);
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const date = new Date(item.usage_date);
          const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div key={index} className="group">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="h-3 w-3 text-gray-400" />
                  <span className="text-xs font-medium text-gray-600">{formattedDate}</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{formatValue(value)}</span>
              </div>
              
              {/* Bar */}
              <div className="relative h-7 bg-gray-50 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-300 group-hover:scale-105 origin-left"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: getBarColor(metric),
                    minWidth: value > 0 ? '3%' : '0%'
                  }}
                >
                </div>
                {value > 0 && (
                  <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-xs font-semibold text-gray-700">
                      {formatValue(value)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-xs">No data available for this period</p>
        </div>
      )}
    </div>
  );
}
