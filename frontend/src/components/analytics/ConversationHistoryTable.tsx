import { useState } from 'react';
import { MessageSquare, Download } from 'lucide-react';

interface Conversation {
  id: string;
  conversation_id: string;
  topic_title: string;
  model_name: string;
  status: 'active' | 'completed' | 'abandoned' | 'error';
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  message_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  actual_api_cost?: number;
  profit_amount?: number;
  profit_margin?: number;
  tool_call_count: number;
  tools_used: string[];
}

interface ConversationHistoryTableProps {
  conversations: Conversation[];
  onExport?: () => void;
}

export function ConversationHistoryTable({ conversations, onExport }: ConversationHistoryTableProps) {
  const [sortField, setSortField] = useState<keyof Conversation>('started_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleSort = (field: keyof Conversation) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };


  const filteredConversations = conversations.filter(conv => 
    filterStatus === 'all' || conv.status === filterStatus
  );

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    return ((aVal as number) - (bVal as number)) * multiplier;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-600/20 text-green-400 border border-green-600/30',
      active: 'bg-blue-600/20 text-blue-400 border border-blue-600/30',
      abandoned: 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30',
      error: 'bg-red-600/20 text-red-400 border border-red-600/30'
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${styles[status as keyof typeof styles]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const SortIcon = ({ field }: { field: keyof Conversation }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Conversation History</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{sortedConversations.length} total conversations</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-muted border border-border text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 hover:border-primary/30 transition"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="active">Active</option>
              <option value="abandoned">Abandoned</option>
              <option value="error">Error</option>
            </select>
            
            {/* Export Button */}
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center space-x-2 px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shadow-lg"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <button
                  onClick={() => handleSort('topic_title')}
                  className="flex items-center space-x-1 hover:text-primary transition"
                >
                  <span>Conversation</span>
                  <SortIcon field="topic_title" />
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <button
                  onClick={() => handleSort('model_name')}
                  className="flex items-center space-x-1 hover:text-primary transition"
                >
                  <span>Model</span>
                  <SortIcon field="model_name" />
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <button
                  onClick={() => handleSort('message_count')}
                  className="flex items-center space-x-1 hover:text-primary transition"
                >
                  <span>Messages</span>
                  <SortIcon field="message_count" />
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <button
                  onClick={() => handleSort('total_cost')}
                  className="flex items-center space-x-1 hover:text-primary transition"
                >
                  <span>Cost</span>
                  <SortIcon field="total_cost" />
                </button>
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <button
                  onClick={() => handleSort('started_at')}
                  className="flex items-center space-x-1 hover:text-primary transition"
                >
                  <span>Date</span>
                  <SortIcon field="started_at" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedConversations.map((conv) => {
              const totalTokens = conv.total_tokens_in + conv.total_tokens_out;
              
              return (
                <tr key={conv.id} className="hover:bg-muted transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate max-w-xs">
                          {conv.topic_title}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-foreground font-medium">{conv.model_name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(conv.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-foreground">{conv.message_count}</div>
                    <div className="text-xs text-muted-foreground">{totalTokens.toLocaleString()} tokens</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-orange-400">${conv.total_cost.toFixed(4)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-foreground font-medium">
                      {new Date(conv.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(conv.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {sortedConversations.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg font-medium">No conversations found</p>
            <p className="text-muted-foreground text-sm mt-2">Conversations will appear here once you start using the IDE chat</p>
          </div>
        )}
      </div>
    </div>
  );
}
