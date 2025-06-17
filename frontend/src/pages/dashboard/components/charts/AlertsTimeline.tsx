import React from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
const alerts = [{
  id: 1,
  type: 'warning',
  message: 'Data quality threshold breach in customer_orders',
  timestamp: '2 hours ago',
  status: 'active'
}, {
  id: 2,
  type: 'success',
  message: 'Daily ETL pipeline completed successfully',
  timestamp: '4 hours ago',
  status: 'resolved'
}, {
  id: 3,
  type: 'warning',
  message: 'Unusual data volume detected in transactions',
  timestamp: '6 hours ago',
  status: 'active'
}];
export function AlertsTimeline() {
  return <div className="space-y-4">
      {alerts.map(alert => <div key={alert.id} className={`flex items-start space-x-3 p-4 rounded-lg ${alert.status === 'active' ? 'bg-slate-700/50' : 'bg-slate-800/50'}`}>
          {alert.type === 'warning' ? <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" /> : <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{alert.message}</p>
            <div className="mt-1 flex items-center text-xs text-slate-400">
              <Clock className="h-3 w-3 mr-1" />
              {alert.timestamp}
            </div>
          </div>
          {alert.status === 'active' && <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-400/10 text-yellow-400">
              Active
            </span>}
        </div>)}
    </div>;
}