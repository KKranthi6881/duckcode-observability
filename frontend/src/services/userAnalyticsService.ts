import axios from 'axios';
import { supabase } from '../config/supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Helper to get auth headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
};

export interface UserAnalyticsSummary {
  totals: {
    total_cost: number;
    conversations: number;
    tokens_in: number;
    tokens_out: number;
    total_tokens: number;
  };
}

export interface UserTrend {
  usage_date: string;
  total_cost: number;
  tokens: number;
  conversations: number;
}

export interface UserModelBreakdown {
  model: string;
  cost: number;
  tokens: number;
  conversations: number;
}

export interface RecentConversation {
  conversation_id: string;
  topic_title: string;
  model_name: string;
  total_cost: number;
  total_tokens_in: number;
  total_tokens_out: number;
  created_at: string;
  status: string;
}

class UserAnalyticsService {
  /**
   * Get analytics summary for logged-in user
   */
  async getUserSummary(days: number = 30): Promise<UserAnalyticsSummary> {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/user-analytics/summary?days=${days}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching user summary:', error);
      throw error;
    }
  }

  /**
   * Get daily cost trends for logged-in user
   */
  async getUserTrends(days: number = 30): Promise<{ trends: UserTrend[] }> {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/user-analytics/trends?days=${days}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching user trends:', error);
      throw error;
    }
  }

  /**
   * Get model usage breakdown for logged-in user
   */
  async getUserModelBreakdown(days: number = 30): Promise<{ models: UserModelBreakdown[] }> {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/user-analytics/models?days=${days}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching user model breakdown:', error);
      throw error;
    }
  }

  /**
   * Get recent conversations for logged-in user
   */
  async getUserRecentConversations(limit: number = 10): Promise<{ conversations: RecentConversation[] }> {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/user-analytics/recent?limit=${limit}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching recent conversations:', error);
      throw error;
    }
  }

  /**
   * Export analytics data for logged-in user
   */
  async exportUserAnalytics(days: number = 30): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get(`${API_BASE_URL}/api/user-analytics/export?days=${days}`, {
        headers,
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `my-analytics-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting user analytics:', error);
      throw error;
    }
  }
}

export const userAnalyticsService = new UserAnalyticsService();
