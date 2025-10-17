import { Request, Response } from 'express';
import { supabaseDuckCode, supabaseAdmin } from '../../config/supabase';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

async function verifyOrgAdmin(userId: string, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();
    return !error && (data?.organization_roles as any)?.name === 'Admin';
  } catch { return false; }
}

async function verifyOrgMember(userId: string, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();
    return !error && !!data;
  } catch { return false; }
}

export async function getOrganizationSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!(await verifyOrgAdmin(userId, organizationId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query raw conversation data directly for accurate totals
    const { data: conversations, error } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('user_id, total_cost, actual_api_cost, profit_amount, total_tokens_in, total_tokens_out, conversation_id')
      .eq('organization_id', organizationId)
      .gte('started_at', startDate.toISOString());

    if (error) {
      console.error('Query error:', error);
      return res.status(500).json({ error: 'Query failed' });
    }

    // Calculate totals from raw data
    const uniqueUsers = new Set<string>();
    const totals = {
      total_cost: 0,
      profit: 0,
      conversations: 0,
      tokens: 0,
      active_users: 0,
    };

    conversations?.forEach(conv => {
      totals.total_cost += parseFloat(conv.total_cost || 0);
      totals.profit += parseFloat(conv.profit_amount || 0);
      totals.conversations += 1;
      totals.tokens += (conv.total_tokens_in || 0) + (conv.total_tokens_out || 0);
      if (conv.user_id) {
        uniqueUsers.add(conv.user_id);
      }
    });

    totals.active_users = uniqueUsers.size;

    // Try to get daily stats for the chart (fallback to empty if not available)
    const { data: stats } = await supabaseDuckCode
      .from('organization_daily_stats')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('usage_date', startDate.toISOString().split('T')[0])
      .order('usage_date', { ascending: false });

    res.json({ totals, daily_stats: stats || [] });
  } catch (error) {
    console.error('getOrganizationSummary error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function getOrganizationTrends(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!(await verifyOrgAdmin(userId, organizationId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Try to get from aggregated table first
    const { data: stats, error } = await supabaseDuckCode
      .from('organization_daily_stats')
      .select('usage_date, total_cost, profit_amount, total_conversations, active_users')
      .eq('organization_id', organizationId)
      .gte('usage_date', startDate.toISOString().split('T')[0])
      .order('usage_date', { ascending: true });

    // If aggregated table has data, use it
    if (!error && stats && stats.length > 0) {
      return res.json({ trends: stats });
    }

    // Fallback: Calculate from raw conversation data
    const { data: conversations } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('started_at, total_cost, profit_amount, user_id')
      .eq('organization_id', organizationId)
      .gte('started_at', startDate.toISOString());

    // Group by date
    const dailyMap: Record<string, any> = {};
    conversations?.forEach(conv => {
      const date = conv.started_at.split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = {
          usage_date: date,
          total_cost: 0,
          profit_amount: 0,
          total_conversations: 0,
          active_users: new Set(),
        };
      }
      dailyMap[date].total_cost += parseFloat(conv.total_cost || 0);
      dailyMap[date].profit_amount += parseFloat(conv.profit_amount || 0);
      dailyMap[date].total_conversations += 1;
      if (conv.user_id) {
        dailyMap[date].active_users.add(conv.user_id);
      }
    });

    // Convert to array and format
    const trends = Object.values(dailyMap)
      .map((day: any) => ({
        usage_date: day.usage_date,
        total_cost: day.total_cost,
        profit_amount: day.profit_amount,
        total_conversations: day.total_conversations,
        active_users: day.active_users.size,
      }))
      .sort((a, b) => a.usage_date.localeCompare(b.usage_date));

    res.json({ trends });
  } catch (error) {
    console.error('getOrganizationTrends error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function getOrganizationUserBreakdown(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!(await verifyOrgAdmin(userId, organizationId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: conversations } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('user_id, total_cost, total_tokens_in, total_tokens_out')
      .eq('organization_id', organizationId)
      .gte('started_at', startDate.toISOString());

    const userMap: Record<string, any> = {};
    conversations?.forEach(conv => {
      if (!userMap[conv.user_id]) {
        userMap[conv.user_id] = { user_id: conv.user_id, total_cost: 0, conversations: 0, tokens: 0 };
      }
      userMap[conv.user_id].total_cost += parseFloat(conv.total_cost || 0);
      userMap[conv.user_id].conversations += 1;
      userMap[conv.user_id].tokens += (conv.total_tokens_in || 0) + (conv.total_tokens_out || 0);
    });

    // Get user profiles for display names
    const userIds = Object.keys(userMap);
    const { data: profiles, error: profileError } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (profileError) {
      console.error('Error fetching user profiles:', profileError);
    }

    console.log(`Fetched ${profiles?.length || 0} user profiles for ${userIds.length} users`);

    // Merge profile data with user stats
    const users = Object.values(userMap).map((user: any) => {
      const profile = profiles?.find(p => p.id === user.user_id);
      return {
        ...user,
        email: profile?.email || null,
        full_name: profile?.full_name || null,
        display_name: profile?.full_name || (profile?.email ? profile.email : user.user_id.substring(0, 12) + '...')
      };
    }).sort((a: any, b: any) => b.total_cost - a.total_cost);

    res.json({ users });
  } catch (error) {
    console.error('getOrganizationUserBreakdown error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function getOrganizationApiKeyBreakdown(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!(await verifyOrgAdmin(userId, organizationId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: stats } = await supabaseDuckCode
      .from('api_key_daily_stats')
      .select('api_key_id, total_cost, total_conversations, total_tokens_in, total_tokens_out')
      .eq('organization_id', organizationId)
      .gte('usage_date', startDate.toISOString().split('T')[0]);

    const keyMap: Record<string, any> = {};
    stats?.forEach(day => {
      const id = day.api_key_id;
      if (!keyMap[id]) keyMap[id] = { api_key_id: id, cost: 0, conversations: 0, tokens: 0 };
      keyMap[id].cost += parseFloat(day.total_cost || 0);
      keyMap[id].conversations += day.total_conversations || 0;
      keyMap[id].tokens += (day.total_tokens_in || 0) + (day.total_tokens_out || 0);
    });

    const keys = Object.values(keyMap).sort((a: any, b: any) => b.cost - a.cost);
    res.json({ api_keys: keys });
  } catch (error) {
    console.error('getOrganizationApiKeyBreakdown error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function getOrganizationModelBreakdown(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!(await verifyOrgAdmin(userId, organizationId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Try aggregated table first
    const { data: stats } = await supabaseDuckCode
      .from('organization_daily_stats')
      .select('model_usage')
      .eq('organization_id', organizationId)
      .gte('usage_date', startDate.toISOString().split('T')[0]);

    const modelMap: Record<string, any> = {};

    // If aggregated data exists, use it
    if (stats && stats.length > 0) {
      stats.forEach(day => {
        Object.entries(day.model_usage || {}).forEach(([model, data]: [string, any]) => {
          if (!modelMap[model]) modelMap[model] = { model, conversations: 0, cost: 0, tokens: 0 };
          modelMap[model].conversations += data.conversations || 0;
          modelMap[model].cost += parseFloat(data.cost || 0);
          modelMap[model].tokens += (data.tokens_in || 0) + (data.tokens_out || 0);
        });
      });
    } else {
      // Fallback: Calculate from raw conversation data
      const { data: conversations } = await supabaseDuckCode
        .from('conversation_analytics')
        .select('model_name, total_cost, total_tokens_in, total_tokens_out')
        .eq('organization_id', organizationId)
        .gte('started_at', startDate.toISOString());

      conversations?.forEach(conv => {
        const model = conv.model_name || 'Unknown';
        if (!modelMap[model]) {
          modelMap[model] = { model, conversations: 0, cost: 0, tokens: 0 };
        }
        modelMap[model].conversations += 1;
        modelMap[model].cost += parseFloat(conv.total_cost || 0);
        modelMap[model].tokens += (conv.total_tokens_in || 0) + (conv.total_tokens_out || 0);
      });
    }

    const models = Object.values(modelMap).sort((a: any, b: any) => b.cost - a.cost);
    res.json({ models });
  } catch (error) {
    console.error('getOrganizationModelBreakdown error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function getUserAnalyticsWithComparison(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId, userId: targetUserId } = req.params;
    const currentUserId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!currentUserId) return res.status(401).json({ error: 'Not authenticated' });

    const isAdmin = await verifyOrgAdmin(currentUserId, organizationId);
    if (!isAdmin && currentUserId !== targetUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: userConvs } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('organization_id', organizationId)
      .gte('started_at', startDate.toISOString());

    const userTotals = userConvs?.reduce((acc, c) => ({
      cost: acc.cost + parseFloat(c.total_cost || 0),
      conversations: acc.conversations + 1,
      tokens: acc.tokens + (c.total_tokens_in || 0) + (c.total_tokens_out || 0),
    }), { cost: 0, conversations: 0, tokens: 0 }) || { cost: 0, conversations: 0, tokens: 0 };

    const { data: allConvs } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('user_id, total_cost')
      .eq('organization_id', organizationId)
      .gte('started_at', startDate.toISOString());

    const uniqueUsers = new Set(allConvs?.map(c => c.user_id) || []);
    const orgAvgCost = uniqueUsers.size > 0 
      ? (allConvs?.reduce((sum, c) => sum + parseFloat(c.total_cost || 0), 0) || 0) / uniqueUsers.size 
      : 0;

    res.json({
      user: userTotals,
      org_average: { cost_per_user: orgAvgCost },
      comparison: { vs_avg_percentage: orgAvgCost > 0 ? (userTotals.cost / orgAvgCost) * 100 : 0 },
    });
  } catch (error) {
    console.error('getUserAnalyticsWithComparison error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function getConversationDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId, conversationId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!(await verifyOrgMember(userId, organizationId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: conversation } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('organization_id', organizationId)
      .single();

    if (!conversation) return res.status(404).json({ error: 'Not found' });

    res.json({ conversation });
  } catch (error) {
    console.error('getConversationDetails error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

export async function exportOrganizationAnalytics(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!(await verifyOrgAdmin(userId, organizationId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { data } = await supabaseDuckCode
      .from('organization_daily_stats')
      .select('*')
      .eq('organization_id', organizationId)
      .order('usage_date', { ascending: false })
      .limit(365);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=analytics-${organizationId}.csv`);
    
    const csv = [
      'Date,Cost,Profit,Conversations,Users',
      ...((data || []).map(d => 
        `${d.usage_date},${d.total_cost},${d.profit_amount},${d.total_conversations},${d.active_users}`
      ))
    ].join('\n');

    res.send(csv);
  } catch (error) {
    console.error('exportOrganizationAnalytics error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
