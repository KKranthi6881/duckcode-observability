import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Zap, DollarSign, Bot, TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface ConversationStats {
  totalConversations: number;
  completedConversations: number;
  totalMessages: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCacheWrites: number;
  totalCacheReads: number;
  totalCost: number;
  totalToolCalls: number;
  completionRate: string;
}

interface ConversationAnalytics {
  id: string;
  conversation_id?: string;
  topic_title: string;
  model_name: string;
  provider_name?: string;
  mode_name?: string;
  started_at: string;
  ended_at?: string;
  status: string;
  message_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cache_writes?: number;
  total_cache_reads?: number;
  cache_efficiency?: number; // 0..1 ratio
  total_cost: number;
  tool_call_count?: number;
  tools_used?: string[] | Record<string, number>;
}

interface DailyConversationStats {
  usage_date: string;
  total_conversations: number;
  completed_conversations: number;
  total_messages: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cache_writes: number;
  total_cache_reads: number;
  total_cost: number;
  total_tool_calls: number;
  model_usage: Record<string, {
    conversations: number;
    tokens_in: number;
    tokens_out: number;
    cost: number;
  }>;
}

interface ModelStats {
  model: string;
  totalConversations: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function ChatAnalytics() {
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [conversations, setConversations] = useState<ConversationAnalytics[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyConversationStats[]>([]);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);

  const fetchChatAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch conversations
      const conversationsResponse = await fetch('/api/chat-analytics/conversations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!conversationsResponse.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const conversationsData = await conversationsResponse.json();
      setConversations(conversationsData.conversations || []);

      // Calculate stats from conversations
      const list: ConversationAnalytics[] = conversationsData.conversations || [];
      const totalConversations = list.length;
      const completedConversations = list.filter((c: any) => c.status === 'completed').length;
      const totalMessages = list.reduce((sum: number, conv: any) => sum + (conv.message_count || 0), 0);
      const totalTokensIn = list.reduce((sum: number, conv: any) => sum + (conv.total_tokens_in || 0), 0);
      const totalTokensOut = list.reduce((sum: number, conv: any) => sum + (conv.total_tokens_out || 0), 0);
      const totalCacheWrites = list.reduce((sum: number, conv: any) => sum + (conv.total_cache_writes || 0), 0);
      const totalCacheReads = list.reduce((sum: number, conv: any) => sum + (conv.total_cache_reads || 0), 0);
      const totalCost = list.reduce((sum: number, conv: any) => sum + (conv.total_cost || 0), 0);
      const totalToolCalls = list.reduce((sum: number, conv: any) => sum + (conv.tool_call_count || 0), 0);
      const completionRate = totalConversations > 0 ? (completedConversations / totalConversations * 100).toFixed(1) : '0';

      setStats({
        totalConversations,
        completedConversations,
        totalMessages,
        totalTokensIn,
        totalTokensOut,
        totalCacheWrites,
        totalCacheReads,
        totalCost,
        totalToolCalls,
        completionRate
      });

      // Fetch all analytics data
      const [statsRes, sessionsRes, dailyRes, modelRes] = await Promise.all([
        fetch(`/api/chat-analytics/stats?period=${period}`, { headers }),
        fetch(`/api/chat-analytics/sessions?limit=10`, { headers }),
        fetch(`/api/chat-analytics/daily-stats?period=${period}`, { headers }),
        fetch(`/api/chat-analytics/model-stats?period=${period}`, { headers })
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.summary);
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setConversations(data.sessions);
      }

      if (dailyRes.ok) {
        const data = await dailyRes.json();
        setDailyStats(data.dailyStats);
      }

      if (modelRes.ok) {
        const data = await modelRes.json();
        setModelStats(data.modelStats);
      }

    } catch (error) {
      console.error('Error fetching chat analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatAnalytics();
  }, [period]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount);
  };

  const formatPercent = (value?: number) => {
    const v = typeof value === 'number' ? value : 0;
    return `${(v * 100).toFixed(1)}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Chat Analytics</h1>
          <p className="text-gray-600">Monitor your DuckCode IDE chat usage and performance</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchChatAnalytics} variant="outline">
            <TrendingUp className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Conversations</p>
                <div className="text-2xl font-bold">{stats.totalConversations}</div>
                <p className="text-xs text-muted-foreground">Total Conversations</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats?.totalMessages || 0)}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Input Tokens</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats?.totalTokensIn || 0)}</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Output Tokens</p>
                <div className="text-2xl font-bold">{(stats.totalTokensIn + stats.totalTokensOut).toLocaleString()}</div>
              </div>
              <Bot className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalCost || 0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Daily Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="usage_date" tickFormatter={formatDate} />
                    <YAxis />
                    <Tooltip labelFormatter={formatDate} />
                    <Line type="monotone" dataKey="total_chat_messages" stroke="#8884d8" name="Messages" />
                    <Line type="monotone" dataKey="total_sessions" stroke="#82ca9d" name="Sessions" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Model Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bot className="h-5 w-5 mr-2" />
                  Model Usage Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={modelStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ model, percent }) => `${model} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalRequests"
                    >
                      {modelStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Recent Chat Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversations.map((session) => (
                  <div key={session.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{session.topic_title}</h3>
                        <p className="text-sm text-gray-600">Started: {formatDate(session.started_at)}</p>
                      </div>
                      <Badge variant="secondary">{session.model_name}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Messages:</span>
                        <span className="ml-1 font-medium">{session.message_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Input Tokens:</span>
                        <span className="ml-1 font-medium">{formatNumber(session.total_tokens_in)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Output Tokens:</span>
                        <span className="ml-1 font-medium">{formatNumber(session.total_tokens_out)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Cost:</span>
                        <span className="ml-1 font-medium">{formatCurrency(session.total_cost)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tool Calls:</span>
                        <span className="ml-1 font-medium">{session.tool_call_count ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Cache Eff.:</span>
                        <span className="ml-1 font-medium">{formatPercent(session.cache_efficiency)}</span>
                      </div>
                    </div>
                    {session.tools_used && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Tools:</span>{' '}
                        {Array.isArray(session.tools_used)
                          ? (session.tools_used as string[]).join(', ')
                          : Object.entries(session.tools_used as Record<string, number>)
                              .map(([k, v]) => `${k} (${v})`)
                              .join(', ')
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                Model Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modelStats.map((model, index) => (
                  <div key={model.model} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-sm font-medium">{model.model}</div>
                      <div className="text-xs text-muted-foreground">{model.totalConversations} conversations</div>
                      <Badge style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                        {formatNumber(model.totalRequests)} requests
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Input Tokens:</span>
                        <span className="ml-1 font-medium">{formatNumber(model.totalTokensIn)}</span>
                      </div>
                      <div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {(model.totalTokensIn + model.totalTokensOut).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {model.totalTokensIn > 0 ? (model.totalTokensOut / (model.totalTokensIn + model.totalTokensOut) * 100).toFixed(1) : '0'}% output
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${model.totalCost.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Token Usage Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="usage_date" tickFormatter={formatDate} />
                  <YAxis />
                  <Tooltip labelFormatter={formatDate} />
                  <Bar dataKey="total_input_tokens" stackId="a" fill="#8884d8" name="Input Tokens" />
                  <Bar dataKey="total_output_tokens" stackId="a" fill="#82ca9d" name="Output Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
