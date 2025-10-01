import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';
import { TrendingUp, DollarSign, MessageSquare, Zap } from 'lucide-react';
import { supabase } from '@/config/supabaseClient';

interface DashboardStats {
  today: {
    conversations: number;
    cost: number;
    profit: number;
    tokens: number;
  };
  week: {
    conversations: number;
    cost: number;
    profit: number;
  };
  month: {
    conversations: number;
    cost: number;
    profit: number;
  };
  total: {
    conversations: number;
    cost: number;
    profit: number;
    tokens: number;
  };
  avgCostPer1kTokens: number;
  avgCacheEfficiency: number;
}

interface ConversationDetail {
  id: string;
  topic_title: string;
  model_name: string;
  started_at: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cache_reads: number;
  actual_api_cost: number;
  charged_cost: number;
  profit_amount: number;
  profit_margin: number;
  context_usage_percentage: number;
  cache_efficiency_calc: number;
}

const AnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<ConversationDetail[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [modelBreakdown, setModelBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      console.log('🔍 Fetching analytics with token:', token ? 'Present' : 'Missing', 'Length:', token?.length);
      
      // Fetch dashboard summary
      const summaryRes = await fetch('/api/analytics/dashboard-summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('📊 Dashboard summary response:', summaryRes.status, summaryRes.ok);
      const summaryData = await summaryRes.json();
      console.log('📊 Dashboard summary data:', summaryData);
      
      // Fetch recent conversations
      const conversationsRes = await fetch('/api/analytics/conversations?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const conversationsData = await conversationsRes.json();
      
      // Fetch daily trends
      const dailyRes = await fetch('/api/analytics/daily-trends?days=30', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dailyTrends = await dailyRes.json();
      
      // Fetch model breakdown
      const modelRes = await fetch('/api/analytics/model-breakdown', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const modelData = await modelRes.json();
      
      setStats(summaryData);
      setConversations(conversationsData);
      setDailyData(dailyTrends);
      setModelBreakdown(modelData);
      setLoading(false);
      console.log('✅ Analytics loaded successfully');
    } catch (error) {
      console.error('❌ Failed to fetch analytics:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading analytics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <div>No analytics data available</div>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          Start using the IDE to generate conversation data
        </div>
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>
          Analytics Dashboard
        </h1>
        <p style={{ color: '#666' }}>
          Complete transparency into your AI usage, costs, and profit margins
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Today's Revenue */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', marginBottom: '16px' }}>
            <div>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>Today's Revenue</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#2AB7A9' }}>
                ${stats?.today.cost.toFixed(2) || '0.00'}
              </h2>
            </div>
            <DollarSign size={24} color="#2AB7A9" />
          </div>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Profit: <span style={{ color: '#10B981', fontWeight: 'bold' }}>
              ${stats?.today.profit.toFixed(2) || '0.00'}
            </span> (100% margin)
          </p>
        </div>

        {/* Today's Conversations */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
            <div>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>Today's Conversations</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>
                {stats?.today.conversations || 0}
              </h2>
            </div>
            <MessageSquare size={24} color="#3B82F6" />
          </div>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Tokens: {((stats?.today.tokens || 0) / 1000).toFixed(1)}k
          </p>
        </div>

        {/* Monthly Profit */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
            <div>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>Monthly Profit</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#10B981' }}>
                ${stats?.month.profit.toFixed(2) || '0.00'}
              </h2>
            </div>
            <TrendingUp size={24} color="#10B981" />
          </div>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Revenue: ${stats?.month.cost.toFixed(2) || '0.00'}
          </p>
        </div>

        {/* Cache Efficiency */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
            <div>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '4px' }}>Cache Efficiency</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#8B5CF6' }}>
                {stats?.avgCacheEfficiency.toFixed(1) || '0.0'}%
              </h2>
            </div>
            <Zap size={24} color="#8B5CF6" />
          </div>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Cost per 1k tokens: ${stats?.avgCostPer1kTokens.toFixed(4) || '0.0000'}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* Daily Revenue & Profit Trend */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
            Revenue & Profit Trend (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="charged_cost" stackId="1" stroke="#2AB7A9" fill="#2AB7A9" name="Revenue" />
              <Area type="monotone" dataKey="profit_amount" stackId="2" stroke="#10B981" fill="#10B981" name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Model Usage Breakdown */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
            Model Usage Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={modelBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.model_name}: ${entry.percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="conversations"
              >
                {modelBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Token Usage Chart */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
          Token Usage Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total_tokens_in" stroke="#3B82F6" name="Input Tokens" />
            <Line type="monotone" dataKey="total_tokens_out" stroke="#EF4444" name="Output Tokens" />
            <Line type="monotone" dataKey="total_cache_reads" stroke="#8B5CF6" name="Cache Reads" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Conversations Table */}
      <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
          Recent Conversations
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Topic</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#666' }}>Model</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#666' }}>Tokens In</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#666' }}>Tokens Out</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#666' }}>Cache</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#666' }}>API Cost</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#666' }}>Charged</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#666' }}>Profit</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#666' }}>Context %</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conv) => (
                <tr key={conv.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.topic_title}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>
                    {conv.model_name}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                    {(conv.total_tokens_in / 1000).toFixed(1)}k
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                    {(conv.total_tokens_out / 1000).toFixed(1)}k
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#8B5CF6' }}>
                    {(conv.total_cache_reads / 1000).toFixed(1)}k
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#EF4444' }}>
                    ${conv.actual_api_cost.toFixed(4)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#2AB7A9', fontWeight: '600' }}>
                    ${conv.charged_cost.toFixed(4)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#10B981', fontWeight: '600' }}>
                    ${conv.profit_amount.toFixed(4)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                    {conv.context_usage_percentage.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transparency Notice */}
      <div style={{ marginTop: '32px', padding: '20px', backgroundColor: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: '#1E40AF' }}>
          💡 Complete Cost Transparency
        </h4>
        <p style={{ fontSize: '14px', color: '#1E40AF', lineHeight: '1.6' }}>
          We believe in full transparency. All costs shown include our 100% profit margin (2x markup). 
          <strong> API Cost</strong> is what we pay to the AI provider, 
          <strong> Charged</strong> is what you pay (2x), and 
          <strong> Profit</strong> is our margin. This allows us to provide enterprise-grade features, support, and infrastructure.
        </p>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
