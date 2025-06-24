import React from 'react';
import { Bell, AlertTriangle, Shield, TrendingUp } from 'lucide-react';

interface AlertsViewerProps {
  filePath: string;
}

export const AlertsViewer: React.FC<AlertsViewerProps> = ({ filePath }) => {
  return (
    <div className="p-8 text-center bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200">
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Shield className="h-12 w-12 text-orange-600" />
            <Bell className="h-5 w-5 text-red-500 absolute -top-1 -right-1" />
            <AlertTriangle className="h-4 w-4 text-yellow-500 absolute -bottom-1 -left-1" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Smart Alerts</h3>
        <p className="text-gray-600 mb-6">
          Monitor and receive intelligent alerts for <strong>{filePath}</strong>. 
          Stay informed about performance issues, data quality problems, and potential risks.
        </p>
        <div className="bg-white rounded-lg p-6 border border-orange-100 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Alert Types:</h4>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            <li>• Performance degradation</li>
            <li>• Data quality issues</li>
            <li>• Security vulnerabilities</li>
            <li>• Dependency failures</li>
            <li>• Anomaly detection</li>
            <li>• Custom rule violations</li>
          </ul>
        </div>
        <div className="flex items-center justify-center space-x-2 text-sm text-orange-600 font-medium">
          <TrendingUp className="h-4 w-4" />
          <span>Intelligent Monitoring System In Development</span>
        </div>
      </div>
    </div>
  );
}; 