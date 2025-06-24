import React from 'react';
import { GitBranch, Database, ArrowRight } from 'lucide-react';

interface LineageViewerProps {
  filePath: string;
}

export const LineageViewer: React.FC<LineageViewerProps> = ({ filePath }) => {
  return (
    <div className="p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-2 text-blue-600">
            <Database className="h-8 w-8" />
            <ArrowRight className="h-6 w-6" />
            <GitBranch className="h-8 w-8" />
            <ArrowRight className="h-6 w-6" />
            <Database className="h-8 w-8" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Data Lineage</h3>
        <p className="text-gray-600 mb-6">
          Visualize the data flow and dependencies for <strong>{filePath}</strong>. 
          Track how data moves through your system, from source to destination.
        </p>
        <div className="bg-white rounded-lg p-6 border border-blue-100 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Coming Soon:</h4>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            <li>• Interactive dependency graph</li>
            <li>• Upstream and downstream data flow</li>
            <li>• Impact analysis</li>
            <li>• Column-level lineage</li>
            <li>• Cross-platform tracking</li>
          </ul>
        </div>
        <div className="text-sm text-blue-600 font-medium">
          🚧 This feature is under development
        </div>
      </div>
    </div>
  );
}; 