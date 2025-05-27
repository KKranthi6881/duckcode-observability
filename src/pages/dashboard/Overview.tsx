import React from 'react';
import { MetricsGrid } from './components/MetricsGrid';
import { DataQualityChart } from './components/charts/DataQualityChart';
import { AlertsTimeline } from './components/charts/AlertsTimeline';
import ColumnLineageGraph from './components/charts/ColumnLineageGraph';

export function Overview() {
  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <MetricsGrid />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Quality Trends */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-medium text-white mb-6">
            Data Quality Score Trends
          </h3>
          <DataQualityChart />
        </div>
        {/* Recent Alerts */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-medium text-white mb-6">
            Recent Alerts
          </h3>
          <AlertsTimeline />
        </div>
      </div>
      {/* Data Lineage Overview */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-medium text-white mb-6">
          Key Data Assets Lineage
        </h3>
        <div className="h-[400px]">
          <ColumnLineageGraph />
        </div>
      </div>
    </div>
  );
}