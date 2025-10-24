/**
 * JobStatusMonitor Component
 * Real-time monitoring of documentation generation jobs
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Pause, 
  Play, 
  Square,
  Loader2,
  FileText,
  DollarSign,
  Zap
} from 'lucide-react';
import { aiDocumentationService, Job } from '../../../services/aiDocumentationService';
import { formatDistanceToNow } from 'date-fns';

interface JobStatusMonitorProps {
  organizationId: string;
  highlightJobId?: string;
  onJobComplete?: (jobId: string) => void;
}

export function JobStatusMonitor({ organizationId, highlightJobId, onJobComplete }: JobStatusMonitorProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchJobs();
    
    // Poll every 5 seconds for active jobs
    const interval = setInterval(() => {
      const hasActiveJobs = jobs.some(j => 
        ['queued', 'processing', 'paused'].includes(j.status)
      );
      if (hasActiveJobs) {
        fetchJobs();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [organizationId, jobs]);

  const fetchJobs = async () => {
    try {
      const params: any = { limit: 50, offset: 0 };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const result = await aiDocumentationService.listJobs(organizationId, params);
      
      // Check if any jobs just completed
      const previousJobs = jobs;
      result.jobs.forEach(job => {
        const prevJob = previousJobs.find(j => j.id === job.id);
        if (prevJob && prevJob.status === 'processing' && job.status === 'completed') {
          onJobComplete?.(job.id);
        }
      });

      setJobs(result.jobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      await aiDocumentationService.pauseJob(jobId);
      await fetchJobs();
    } catch (error: any) {
      alert(`Failed to pause job: ${error.message}`);
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      await aiDocumentationService.resumeJob(jobId);
      await fetchJobs();
    } catch (error: any) {
      alert(`Failed to resume job: ${error.message}`);
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    
    try {
      await aiDocumentationService.cancelJob(jobId);
      await fetchJobs();
    } catch (error: any) {
      alert(`Failed to cancel job: ${error.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'paused': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return Clock;
      case 'processing': return Loader2;
      case 'completed': return CheckCircle;
      case 'failed': return XCircle;
      case 'cancelled': return Square;
      case 'paused': return Pause;
      default: return Clock;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-[#2AB7A9] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Jobs</h3>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm"
        >
          <option value="all">All Status</option>
          <option value="queued">Queued</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No jobs found</p>
            <p className="text-sm mt-1">Generate documentation to create your first job</p>
          </div>
        ) : (
          jobs.map((job) => {
            const StatusIcon = getStatusIcon(job.status);
            const isHighlighted = job.id === highlightJobId;

            return (
              <div
                key={job.id}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${isHighlighted 
                    ? 'border-[#2AB7A9] bg-[#2AB7A9]/5' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-5 w-5 ${
                      job.status === 'processing' ? 'animate-spin' : ''
                    }`} />
                    <span className={`
                      px-2 py-1 rounded text-xs font-medium ${getStatusColor(job.status)}
                    `}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Control Buttons */}
                    {job.status === 'processing' && (
                      <>
                        <button
                          onClick={() => handlePause(job.id)}
                          className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded"
                          title="Pause"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Cancel"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {job.status === 'paused' && (
                      <button
                        onClick={() => handleResume(job.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        title="Resume"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {['queued', 'processing', 'paused'].includes(job.status) && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>
                        {job.processed_objects} / {job.total_objects} objects
                      </span>
                      <span>{job.progress_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#2AB7A9] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${job.progress_percentage}%` }}
                      />
                    </div>
                    {job.current_object_name && (
                      <p className="text-xs text-gray-600 mt-1">
                        Current: {job.current_object_name}
                      </p>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs">Objects</span>
                    </div>
                    <p className="font-medium text-gray-900 mt-1">
                      {job.total_objects}
                      {job.failed_objects > 0 && (
                        <span className="text-red-600 text-xs ml-1">
                          ({job.failed_objects} failed)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Zap className="h-4 w-4" />
                      <span className="text-xs">Tokens</span>
                    </div>
                    <p className="font-medium text-gray-900 mt-1">
                      {job.total_tokens_used.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs">Cost</span>
                    </div>
                    <p className="font-medium text-gray-900 mt-1">
                      ${job.actual_cost > 0 ? job.actual_cost.toFixed(4) : job.estimated_cost.toFixed(4)}
                    </p>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>
                      Created {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </span>
                    {job.completed_at && (
                      <span>
                        Completed {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
