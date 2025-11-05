import { supabase } from '../config/supabaseClient';

// Recommendation Interface
export interface Recommendation {
  id: string;
  connector_id: string;
  organization_id: string;
  type: 'warehouse_resize' | 'auto_suspend' | 'enable_cache' | 'archive_table' | 'disable_clustering' | 'optimize_query' | 'disable_task' | 'optimize_mv_refresh';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'applied' | 'dismissed' | 'failed' | 'expired';
  warehouse_name?: string;
  database_name?: string;
  schema_name?: string;
  table_name?: string;
  query_hash?: string;
  title: string;
  description: string;
  current_value?: string;
  recommended_value?: string;
  estimated_monthly_savings_usd: number;
  confidence_score: number;
  effort_level: 'easy' | 'medium' | 'hard';
  sql_commands: string[];
  implementation_notes?: string;
  created_at: string;
  updated_at: string;
  applied_at?: string;
  applied_by?: string;
  dismissed_at?: string;
  dismissed_by?: string;
  dismissal_reason?: string;
  expires_at?: string;
}

// Recommendations Summary
export interface RecommendationsSummary {
  total: number;
  by_status: {
    pending: number;
    applied: number;
    dismissed: number;
    failed: number;
    expired: number;
  };
  by_priority: {
    high: number;
    medium: number;
    low: number;
  };
  total_potential_savings: number;
  applied_savings: number;
}

// ROI Summary
export interface ROISummary {
  total_recommendations: number;
  applied_recommendations: number;
  projected_annual_savings: number;
  actual_annual_savings: number;
  roi_percentage: number;
  payback_months: number;
  total_invested: number;
}

// ROI Breakdown Item
export interface ROIBreakdownItem {
  id: string;
  recommendation_id: string;
  recommendation_title: string;
  projected_savings_usd: number;
  actual_savings_usd: number;
  variance_percent: number;
  baseline_period_start: string;
  baseline_period_end: string;
  measurement_period_start?: string;
  measurement_period_end?: string;
}

class SnowflakeRecommendationsService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  }

  private async token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  }

  /**
   * List all recommendations for a connector
   */
  async listRecommendations(
    connectorId: string, 
    filters?: { status?: string; priority?: string; type?: string }
  ): Promise<Recommendation[]> {
    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/recommendations`);
    
    if (filters?.status) url.searchParams.set('status', filters.status);
    if (filters?.priority) url.searchParams.set('priority', filters.priority);
    if (filters?.type) url.searchParams.set('type', filters.type);

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    const json = await res.json();
    return json.data || [];
  }

  /**
   * Get recommendations summary
   */
  async getSummary(connectorId: string): Promise<RecommendationsSummary> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/recommendations/summary`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    
    if (!res.ok) throw new Error('Failed to fetch recommendations summary');
    const json = await res.json();
    return json.data;
  }

  /**
   * Apply a recommendation (execute SQL)
   */
  async applyRecommendation(connectorId: string, recommendationId: string): Promise<void> {
    const t = await this.token();
    const res = await fetch(
      `${this.baseUrl}/api/connectors/${connectorId}/recommendations/${recommendationId}/apply`, 
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${t}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to apply recommendation');
    }
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(
    connectorId: string, 
    recommendationId: string, 
    reason?: string
  ): Promise<void> {
    const t = await this.token();
    const res = await fetch(
      `${this.baseUrl}/api/connectors/${connectorId}/recommendations/${recommendationId}/dismiss`, 
      {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${t}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      }
    );
    
    if (!res.ok) throw new Error('Failed to dismiss recommendation');
  }

  /**
   * Generate recommendations manually
   */
  async generateRecommendations(connectorId: string): Promise<void> {
    const t = await this.token();
    const res = await fetch(
      `${this.baseUrl}/api/connectors/${connectorId}/recommendations/generate`, 
      {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${t}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!res.ok) throw new Error('Failed to generate recommendations');
  }

  /**
   * Get ROI summary and breakdown
   */
  async getROI(connectorId: string): Promise<{ summary: ROISummary; breakdown: ROIBreakdownItem[] }> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/roi`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    
    if (!res.ok) throw new Error('Failed to fetch ROI data');
    const json = await res.json();
    return json.data;
  }
}

export default new SnowflakeRecommendationsService();
