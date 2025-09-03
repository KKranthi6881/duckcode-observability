import { supabaseDuckCode } from '../config/supabaseClient';

export interface BillingInfo {
  id?: string;
  user_id: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  billing_period_start: string;
  billing_period_end: string;
  monthly_token_limit: number;
  monthly_request_limit: number;
  current_tokens_used: number;
  current_requests_used: number;
  total_cost: number;
  last_updated?: string;
  created_at?: string;
}

export interface SubscriptionTier {
  tier_name: 'free' | 'pro' | 'enterprise';
  display_name: string;
  monthly_price: number;
  monthly_token_limit: number;
  monthly_request_limit: number;
  daily_token_limit: number;
  daily_request_limit: number;
  features: string[];
  created_at?: string;
}

export class SupabaseBilling {
  static async getBillingInfo(userId: string): Promise<BillingInfo | null> {
    try {
      // Get current billing period
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabaseDuckCode
        .from('billing_info')
        .select('*')
        .eq('user_id', userId)
        .eq('billing_period_start', currentMonth.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
      
      return data;
    } catch (error) {
      console.error('Error getting billing info:', error);
      return null;
    }
  }

  static async createOrUpdateBillingInfo(userId: string, subscriptionTier: 'free' | 'pro' | 'enterprise'): Promise<BillingInfo> {
    try {
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const nextMonth = new Date(currentMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      // Get tier limits
      const tier = await this.getSubscriptionTier(subscriptionTier);
      if (!tier) throw new Error('Invalid subscription tier');

      const billingData = {
        user_id: userId,
        subscription_tier: subscriptionTier,
        billing_period_start: currentMonth.toISOString(),
        billing_period_end: nextMonth.toISOString(),
        monthly_token_limit: tier.monthly_token_limit,
        monthly_request_limit: tier.monthly_request_limit,
        current_tokens_used: 0,
        current_requests_used: 0,
        total_cost: 0,
        last_updated: new Date().toISOString()
      };

      const { data, error } = await supabaseDuckCode
        .from('billing_info')
        .upsert(billingData, {
          onConflict: 'user_id,billing_period_start'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating/updating billing info:', error);
      throw error;
    }
  }

  static async getSubscriptionTier(tierName: string): Promise<any> {
    const { data, error } = await supabaseDuckCode
      .from('subscription_tiers')
      .select('*')
      .eq('name', tierName)
      .single();

    if (error) {
      throw new Error(`Failed to get subscription tier: ${error.message}`);
    }

    return data;
  }

  static async getSubscriptionTiers(): Promise<any[]> {
    const { data, error } = await supabaseDuckCode
      .from('subscription_tiers')
      .select('*')
      .order('monthly_price', { ascending: true });

    if (error) {
      throw new Error(`Failed to get subscription tiers: ${error.message}`);
    }

    return data || [];
  }

  static async getAllSubscriptionTiers(): Promise<SubscriptionTier[]> {
    try {
      const { data, error } = await supabaseDuckCode
        .from('subscription_tiers')
        .select('*')
        .order('monthly_price', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting subscription tiers:', error);
      return [];
    }
  }

  static async updateSubscriptionTier(userId: string, newTier: 'free' | 'pro' | 'enterprise'): Promise<void> {
    try {
      // Update user profile
      await supabaseDuckCode
        .from('user_profiles')
        .update({ subscription_tier: newTier })
        .eq('id', userId);

      // Create new billing info for current period
      await this.createOrUpdateBillingInfo(userId, newTier);
    } catch (error) {
      console.error('Error updating subscription tier:', error);
      throw error;
    }
  }

  static async getBillingAnalytics(userId: string): Promise<{
    currentPeriod: BillingInfo | null;
    usage: {
      tokens: { used: number; limit: number; percentage: number };
      requests: { used: number; limit: number; percentage: number };
      cost: number;
    };
    tier: SubscriptionTier | null;
  }> {
    try {
      // Get current billing info
      const billingInfo = await this.getBillingInfo(userId);
      
      // Get user's subscription tier
      const user = await supabaseDuckCode
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();

      if (!user.data) throw new Error('User not found');

      const tier = await this.getSubscriptionTier(user.data.subscription_tier);
      
      // Get current month usage from usage_records
      const { data: monthlyUsage, error: usageError } = await supabaseDuckCode
        .rpc('get_monthly_usage', {
          user_uuid: userId,
          target_month: new Date().toISOString()
        });

      if (usageError) throw usageError;

      const usage = monthlyUsage?.[0] || { total_tokens: 0, total_requests: 0, total_cost: 0 };
      const tokensUsed = parseInt(usage.total_tokens) || 0;
      const requestsUsed = parseInt(usage.total_requests) || 0;
      const cost = parseFloat(usage.total_cost) || 0;

      const tokenLimit = tier?.monthly_token_limit || 100000;
      const requestLimit = tier?.monthly_request_limit || 1000;

      return {
        currentPeriod: billingInfo,
        usage: {
          tokens: {
            used: tokensUsed,
            limit: tokenLimit,
            percentage: tokenLimit === -1 ? 0 : (tokensUsed / tokenLimit) * 100
          },
          requests: {
            used: requestsUsed,
            limit: requestLimit,
            percentage: requestLimit === -1 ? 0 : (requestsUsed / requestLimit) * 100
          },
          cost
        },
        tier
      };
    } catch (error) {
      console.error('Error getting billing analytics:', error);
      throw error;
    }
  }
}
