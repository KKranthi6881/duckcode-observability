import { AlertCircle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  connectorName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ connectorName, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Delete Connector?</h2>
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <span className="font-semibold">{connectorName}</span>?
              </p>
            </div>
            <button 
              className="text-gray-400 hover:text-gray-600 transition-colors" 
              onClick={onCancel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> All metadata extracted from this connector will be permanently deleted, including:
            </p>
            <ul className="text-sm text-red-700 mt-2 ml-4 space-y-1">
              <li>• Tables and views</li>
              <li>• Columns and data types</li>
              <li>• Lineage relationships</li>
              <li>• Extraction history</li>
            </ul>
            <p className="text-sm text-red-800 mt-2 font-medium">
              This action cannot be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button 
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" 
              onClick={onCancel}
            >
              Cancel
            </button>
            <button 
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors" 
              onClick={onConfirm}
            >
              Delete Connector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
