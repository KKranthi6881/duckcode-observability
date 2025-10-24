/**
 * AI Documentation Generation Service
 * Handles all API calls for AI-powered documentation generation
 */

import { supabase } from '../config/supabaseClient';

const API_BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api`;

export interface JobOptions {
  skipExisting?: boolean;
  regenerateAll?: boolean;
  maxRetries?: number;
}

export interface Job {
  id: string;
  organization_id: string;
  object_ids: string[];
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused';
  total_objects: number;
  processed_objects: number;
  failed_objects: number;
  progress_percentage: number;
  current_object_id?: string;
  current_object_name?: string;
  estimated_completion_time?: string;
  total_tokens_used: number;
  estimated_cost: number;
  actual_cost: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_log?: any[];
}

export interface JobResponse {
  jobId: string;
  status: string;
  totalObjects: number;
  message: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
}

export interface Documentation {
  id: string;
  object_id: string;
  organization_id: string;
  executive_summary: string;
  business_narrative: {
    whatItDoes: string;
    dataJourney: string[];
    businessImpact: string;
  };
  transformation_cards: Array<{
    stepNumber: number;
    title: string;
    input: string;
    logic: string;
    output: string;
    whyItMatters: string;
  }>;
  code_explanations: Array<{
    codeBlock: string;
    plainEnglish: string;
    businessContext: string;
  }>;
  business_rules: Array<{
    rule: string;
    codeReference: string;
    impact: string;
  }>;
  impact_analysis: {
    usedBy: Array<{
      team: string;
      frequency: string;
      purpose: string;
    }>;
    questionsAnswered: string[];
    downstreamImpact: string;
  };
  complexity_score: number;
  generated_by_model: string;
  generated_at: string;
  is_current: boolean;
  version: number;
}

class AIDocumentationService {
  private async getAuthToken(): Promise<string> {
    // Get token from Supabase session using the client
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || '';
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return '';
    }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return response;
  }

  /**
   * Create a new documentation generation job
   */
  async createJob(
    organizationId: string,
    objectIds: string[],
    options: JobOptions = {}
  ): Promise<JobResponse> {
    const response = await this.fetchWithAuth(
      `/ai-documentation/organizations/${organizationId}/jobs`,
      {
        method: 'POST',
        body: JSON.stringify({ objectIds, options }),
      }
    );

    return response.json();
  }

  /**
   * Get job status and details
   */
  async getJobStatus(jobId: string): Promise<Job> {
    const response = await this.fetchWithAuth(`/ai-documentation/jobs/${jobId}`);
    return response.json();
  }

  /**
   * List all jobs for an organization
   */
  async listJobs(
    organizationId: string,
    params: {
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<JobListResponse> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const url = `/ai-documentation/organizations/${organizationId}/jobs?${queryParams.toString()}`;
    const response = await this.fetchWithAuth(url);
    return response.json();
  }

  /**
   * Cancel a running or queued job
   */
  async cancelJob(jobId: string): Promise<void> {
    await this.fetchWithAuth(`/ai-documentation/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Pause a running job
   */
  async pauseJob(jobId: string): Promise<void> {
    await this.fetchWithAuth(`/ai-documentation/jobs/${jobId}/pause`, {
      method: 'POST',
    });
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<void> {
    await this.fetchWithAuth(`/ai-documentation/jobs/${jobId}/resume`, {
      method: 'POST',
    });
  }

  /**
   * Get generated documentation for an object
   */
  async getObjectDocumentation(objectId: string): Promise<Documentation> {
    const response = await this.fetchWithAuth(
      `/ai-documentation/objects/${objectId}/documentation`
    );
    return response.json();
  }

  /**
   * Calculate estimated cost for generating documentation
   */
  calculateEstimatedCost(objectCount: number): { min: number; max: number } {
    const minCostPerObject = 0.002; // Simple objects
    const maxCostPerObject = 0.005; // Complex objects
    
    return {
      min: objectCount * minCostPerObject,
      max: objectCount * maxCostPerObject,
    };
  }
}

export const aiDocumentationService = new AIDocumentationService();
