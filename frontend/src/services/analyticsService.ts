import { supabase } from '../config/supabaseClient';

export interface ChatMessageEvent {
  sessionId: string;
  messageType: 'user' | 'assistant';
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  modelName?: string;
  responseTimeMs?: number;
  cost?: number;
  toolCalls?: string[];
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface ChatSessionEvent {
  id: string;
  topic?: string;
  modelName?: string;
  startedAt: string;
  endedAt?: string;
  totalMessages?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCost?: number;
  metadata?: Record<string, unknown>;
}

export interface IdeUsageEvent {
  ideVersion?: string;
  osPlatform?: string;
  workspacePath?: string;
  projectLanguage?: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  filesAnalyzed?: number;
  commandsExecuted?: number;
  errorsEncountered?: number;
  metadata?: Record<string, unknown>;
}

export interface FeatureUsageEvent {
  featureName: string;
  action: string;
  count?: number;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  activeTimeMinutes: number;
  avgResponseTime: number;
  successRate: number;
}

export interface DailyStats {
  date: string;
  messages: number;
  tokens: number;
  cost: number;
  activeTime: number;
}

export interface ModelStats {
  modelName: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  avgResponseTime: number;
}

export interface ChatSession {
  id: string;
  topic: string;
  model_name: string;
  started_at: string;
  ended_at: string | null;
  total_messages: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
}

export interface AnalyticsData {
  usageStats: UsageStats;
  dailyStats: DailyStats[];
  modelStats: ModelStats[];
  recentSessions: ChatSession[];
}

class AnalyticsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  }

  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data?: AnalyticsData; error?: string }> {
    const token = await this.getAuthToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.baseUrl}/api/analytics${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async getDashboardData(timeRange: '7d' | '30d' | '90d' = '7d'): Promise<AnalyticsData> {
    try {
      const response = await this.makeRequest(`/dashboard?timeRange=${timeRange}`);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch dashboard data');
      }

      return response.data || this.getMockData();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Return mock data as fallback
      return this.getMockData();
    }
  }

  async sendChatMessages(events: ChatMessageEvent[]): Promise<void> {
    await this.makeRequest('/chat_messages', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  async sendChatSessions(events: ChatSessionEvent[]): Promise<void> {
    await this.makeRequest('/chat_sessions', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  async sendIdeUsage(events: IdeUsageEvent[]): Promise<void> {
    await this.makeRequest('/ide_sessions', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  async sendFeatureUsage(events: FeatureUsageEvent[]): Promise<void> {
    await this.makeRequest('/feature_usage', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  private getMockData(): AnalyticsData {
    return {
      usageStats: {
        totalSessions: 156,
        totalMessages: 1247,
        totalInputTokens: 89432,
        totalOutputTokens: 156789,
        totalCost: 12.45,
        activeTimeMinutes: 2340,
        avgResponseTime: 1250,
        successRate: 98.5
      },
      dailyStats: [
        { date: '2024-01-01', messages: 45, tokens: 12500, cost: 1.25, activeTime: 120 },
        { date: '2024-01-02', messages: 62, tokens: 18200, cost: 1.82, activeTime: 180 },
        { date: '2024-01-03', messages: 38, tokens: 9800, cost: 0.98, activeTime: 95 },
        { date: '2024-01-04', messages: 71, tokens: 21300, cost: 2.13, activeTime: 210 },
        { date: '2024-01-05', messages: 55, tokens: 16400, cost: 1.64, activeTime: 165 },
        { date: '2024-01-06', messages: 49, tokens: 14200, cost: 1.42, activeTime: 140 },
        { date: '2024-01-07', messages: 67, tokens: 19800, cost: 1.98, activeTime: 195 }
      ],
      modelStats: [
        {
          modelName: 'gpt-4',
          requests: 89,
          inputTokens: 45600,
          outputTokens: 78900,
          cost: 8.45,
          avgResponseTime: 1450
        },
        {
          modelName: 'gpt-3.5-turbo',
          requests: 67,
          inputTokens: 43832,
          outputTokens: 77889,
          cost: 4.00,
          avgResponseTime: 850
        }
      ],
      recentSessions: [
        {
          id: '1',
          topic: 'React Component Optimization',
          model_name: 'gpt-4',
          started_at: '2024-01-07T10:30:00Z',
          ended_at: '2024-01-07T11:15:00Z',
          total_messages: 12,
          total_input_tokens: 2400,
          total_output_tokens: 3600,
          total_cost: 0.85
        },
        {
          id: '2',
          topic: 'Database Schema Design',
          model_name: 'gpt-4',
          started_at: '2024-01-07T09:00:00Z',
          ended_at: '2024-01-07T09:45:00Z',
          total_messages: 8,
          total_input_tokens: 1800,
          total_output_tokens: 2700,
          total_cost: 0.65
        }
      ]
    };
  }
}

export const analyticsService = new AnalyticsService();
