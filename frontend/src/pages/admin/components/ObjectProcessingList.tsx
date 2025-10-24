/**
 * Object Processing List Component
 * Simple, clean display of individual object statuses during documentation generation
 */

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Loader2, XCircle, Circle } from 'lucide-react';
import { supabase } from '../../../config/supabaseClient';
import { Job } from '../../../services/aiDocumentationService';

interface ObjectStatus {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface ObjectProcessingListProps {
  job: Job;
}

interface ErrorLog {
  objectId?: string;
  error?: string;
  timestamp?: string;
}

export function ObjectProcessingList({ job }: ObjectProcessingListProps) {
  const [objects, setObjects] = useState<ObjectStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const updateObjectStatuses = useCallback((objectsList: ObjectStatus[]) => {
    if (objectsList.length === 0) return;

    const failedIds = new Set(
      job.error_log?.map((log: ErrorLog) => log.objectId).filter(Boolean) || []
    );

    const updated = objectsList.map((obj, index) => {
      // Failed
      if (failedIds.has(obj.id)) {
        return { ...obj, status: 'failed' as const };
      }
      
      // Currently processing
      if (obj.id === job.current_object_id) {
        return { ...obj, status: 'processing' as const };
      }
      
      // Completed (before current index minus failed)
      const completedCount = job.processed_objects;
      const failedCount = job.failed_objects;
      const processedIndex = completedCount + failedCount;
      
      if (index < processedIndex && !failedIds.has(obj.id)) {
        return { ...obj, status: 'completed' as const };
      }
      
      // Pending
      return { ...obj, status: 'pending' as const };
    });

    setObjects(updated);
  }, [job.current_object_id, job.processed_objects, job.failed_objects, job.error_log]);

  const fetchObjectNames = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .schema('metadata')
        .from('objects')
        .select('id, name, object_type, schema_name')
        .in('id', job.object_ids);

      if (error) throw error;

      // Initialize with names and pending status
      const objectsMap = new Map(data?.map(obj => [obj.id, obj.name]) || []);
      const initialObjects = job.object_ids.map(id => ({
        id,
        name: objectsMap.get(id) || 'Unknown',
        status: 'pending' as const,
      }));

      setObjects(initialObjects);
      updateObjectStatuses(initialObjects);
    } catch (error) {
      console.error('Error fetching object names:', error);
    } finally {
      setLoading(false);
    }
  }, [job.object_ids, updateObjectStatuses]);

  useEffect(() => {
    fetchObjectNames();
  }, [fetchObjectNames]);

  useEffect(() => {
    // Update statuses when job changes
    updateObjectStatuses(objects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.current_object_id, job.processed_objects, job.failed_objects, job.error_log]);

  const getStatusIcon = (status: ObjectStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-[#2AB7A9] animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: ObjectStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing...';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
    }
  };

  const getStatusColor = (status: ObjectStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-[#2AB7A9]';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 text-[#2AB7A9] animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Object Processing Status</h3>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {objects.map((obj) => (
            <div
              key={obj.id}
              className={`
                px-4 py-3 flex items-center justify-between
                ${obj.status === 'processing' ? 'bg-[#2AB7A9]/5' : ''}
                hover:bg-gray-50 transition-colors
              `}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getStatusIcon(obj.status)}
                <span className="text-sm text-gray-900 truncate font-medium">
                  {obj.name}
                </span>
              </div>
              <span className={`text-xs font-medium ${getStatusColor(obj.status)}`}>
                {getStatusText(obj.status)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {job.processed_objects} completed
            </span>
            {job.failed_objects > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-600" />
                {job.failed_objects} failed
              </span>
            )}
          </div>
          <span className="text-gray-500">
            {job.object_ids.length} total
          </span>
        </div>
      </div>
    </div>
  );
}
