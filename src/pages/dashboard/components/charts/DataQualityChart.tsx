import React from 'react';
export function DataQualityChart() {
  // Simplified placeholder chart
  return <div className="flex flex-col h-64">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-bold text-[#2AB7A9]">98.2%</div>
          <div className="text-sm text-gray-500 mt-2">
            Average Quality Score
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        {[{
        label: 'Completeness',
        score: 99.5
      }, {
        label: 'Accuracy',
        score: 98.2
      }, {
        label: 'Freshness',
        score: 97.0
      }].map(metric => <div key={metric.label} className="text-center">
            <div className="text-lg font-medium text-gray-700">
              {metric.score}%
            </div>
            <div className="text-xs text-gray-500">{metric.label}</div>
          </div>)}
      </div>
    </div>;
}