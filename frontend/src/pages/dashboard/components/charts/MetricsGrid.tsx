import React from 'react';
import { ArrowUpRight, ArrowDownRight, Users, Database, AlertTriangle, Clock } from 'lucide-react';
const metrics = [{
  name: 'Active Tables',
  value: '245',
  change: '+12.3%',
  increasing: true,
  icon: Database
}, {
  name: 'Data Quality Score',
  value: '98.2%',
  change: '+2.1%',
  increasing: true,
  icon: AlertTriangle
}, {
  name: 'Active Users',
  value: '1,234',
  change: '-0.4%',
  increasing: false,
  icon: Users
}, {
  name: 'Avg. Query Time',
  value: '1.2s',
  change: '-12.5%',
  increasing: false,
  icon: Clock
}];
export function MetricsGrid() {
  return <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(metric => <div key={metric.name} className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <metric.icon className="h-5 w-5 text-slate-400" />
            <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${metric.increasing ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              {metric.increasing ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {metric.change}
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-semibold text-white">
              {metric.value}
            </h3>
            <p className="mt-1 text-sm text-slate-400">{metric.name}</p>
          </div>
        </div>)}
    </div>;
}