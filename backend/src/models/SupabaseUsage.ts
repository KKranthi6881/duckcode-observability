import { supabaseDuckCode } from '../config/supabaseClient';

export interface UsageRecord {
  id: string;
  user_id: string;
  tokens: number;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt?: string;
  completion?: string;
  metadata?: any;
  created_at: string;
}

export interface UsageStats {
  totalTokens: number;
  totalRequests: number;
  period: string;
  startDate: string;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  requests: number;
}

export interface ModelUsage {
  model: string;
  tokens: number;
  requests: number;
}

export class SupabaseUsage {
  // Create a new usage record
  static async create(usageData: {
    userId: string;
    tokens: number;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    prompt?: string;
    completion?: string;
    metadata?: any;
  }): Promise<any> {
    const { data, error } = await supabaseDuckCode
      .from('usage_records')
      .insert({
        user_id: usageData.userId,
        tokens: usageData.tokens,
        model: usageData.model,
        prompt_tokens: usageData.promptTokens || 0,
        completion_tokens: usageData.completionTokens || 0,
        prompt: usageData.prompt,
        completion: usageData.completion,
        metadata: usageData.metadata || {},
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create usage record: ${error.message}`);
    }

    return data;
  }

  // Get usage statistics for a user
  static async getStats(userId: string, period: string = '30d'): Promise<any> {
    const startDate = this.getStartDate(period);
    
    const { data, error } = await supabaseDuckCode
      .from('usage_records')
      .select('tokens, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }

    const totalTokens = data.reduce((sum: number, record: any) => sum + record.tokens, 0);
    const totalRequests = data.length;

    return {
      totalTokens,
      totalRequests,
      period,
      startDate: startDate.toISOString()
    };
  }

  // Get daily usage breakdown
  static async getDailyBreakdown(userId: string, period: string = '30d'): Promise<any[]> {
    const startDate = this.getStartDate(period);
    
    const { data, error } = await supabaseDuckCode
      .from('usage_records')
      .select('tokens, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get daily breakdown: ${error.message}`);
    }

    // Group by date
    const dailyData = data.reduce((acc: any, record: any) => {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, tokens: 0, requests: 0 };
      }
      acc[date].tokens += record.tokens;
      acc[date].requests += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(dailyData);
  }

  // Get model usage breakdown
  static async getModelBreakdown(userId: string, period: string = '30d'): Promise<any[]> {
    const startDate = this.getStartDate(period);
    
    const { data, error } = await supabaseDuckCode
      .from('usage_records')
      .select('tokens, model')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw new Error(`Failed to get model breakdown: ${error.message}`);
    }

    // Group by model
    const modelData = data.reduce((acc: any, record: any) => {
      if (!acc[record.model]) {
        acc[record.model] = { model: record.model, tokens: 0, requests: 0 };
      }
      acc[record.model].tokens += record.tokens;
      acc[record.model].requests += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(modelData).sort((a: any, b: any) => b.tokens - a.tokens);
  }


  // Check if user can make request (usage limits)
  static async canMakeRequest(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseDuckCode.rpc('check_usage_limit', {
        user_uuid: userId
      });

      if (error) {
        console.error('Error checking usage limit:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error in canMakeRequest:', error);
      return false;
    }
  }

  // Helper method to get start date based on period
  private static getStartDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  static async getMonthlyUsage(userId: string): Promise<{ totalTokens: number; totalRequests: number }> {
    try {
      const { data, error } = await supabaseDuckCode
        .rpc('get_monthly_usage', {
          user_uuid: userId,
          target_month: new Date().toISOString()
        });

      if (error) throw error;
      
      const result = data?.[0] || { total_tokens: 0, total_requests: 0 };
      return {
        totalTokens: parseInt(result.total_tokens) || 0,
        totalRequests: parseInt(result.total_requests) || 0
      };
    } catch (error) {
      console.error('Error getting monthly usage:', error);
      return { totalTokens: 0, totalRequests: 0 };
    }
  }

  static async checkUsageLimits(userId: string): Promise<{
    canMakeRequest: boolean;
    monthlyTokensUsed: number;
    monthlyTokensLimit: number;
    monthlyRequestsUsed: number;
    monthlyRequestsLimit: number;
    subscriptionTier: string;
  }> {
    try {
      const { data, error } = await supabaseDuckCode
        .rpc('check_usage_limits', {
          user_uuid: userId
        });

      if (error) throw error;
      
      const result = data?.[0] || {
        can_make_request: false,
        monthly_tokens_used: 0,
        monthly_tokens_limit: 100000,
        monthly_requests_used: 0,
        monthly_requests_limit: 1000,
        subscription_tier: 'free'
      };

      return {
        canMakeRequest: result.can_make_request,
        monthlyTokensUsed: parseInt(result.monthly_tokens_used) || 0,
        monthlyTokensLimit: parseInt(result.monthly_tokens_limit) || 100000,
        monthlyRequestsUsed: parseInt(result.monthly_requests_used) || 0,
        monthlyRequestsLimit: parseInt(result.monthly_requests_limit) || 1000,
        subscriptionTier: result.subscription_tier
      };
    } catch (error) {
      console.error('Error checking usage limits:', error);
      return {
        canMakeRequest: false,
        monthlyTokensUsed: 0,
        monthlyTokensLimit: 100000,
        monthlyRequestsUsed: 0,
        monthlyRequestsLimit: 1000,
        subscriptionTier: 'free'
      };
    }
  }
}
