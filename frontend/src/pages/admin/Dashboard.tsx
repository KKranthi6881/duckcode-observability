import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, MoreHorizontal, Calendar, ChevronRight, Link as LinkIcon, ExternalLink } from 'lucide-react';
import type { Organization, OrganizationWithStats } from '../../types/enterprise';
import { organizationService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

export const Dashboard: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [stats, setStats] = useState<OrganizationWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    if (selectedOrg) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  const loadStats = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      const data = await organizationService.getOrganizationWithStats(selectedOrg.id);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = ['Overview', 'Calendar', 'Tasks', 'Activity'];

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-sm text-foreground bg-muted border border-border rounded-lg hover:bg-accent transition-colors">
              <ExternalLink className="h-4 w-4" />
              View careers site
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm text-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors font-semibold">
              + New job
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-border -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold transition-colors relative ${
                activeTab === tab
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Analytics Report Section */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">Analytics report</h2>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground bg-muted border border-border rounded-lg hover:bg-accent">
                <Calendar className="h-4 w-4" />
                Today
              </button>
              <span className="text-sm text-muted-foreground">compared to</span>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground bg-muted border border-border rounded-lg hover:bg-accent">
                Previous period
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">New candidates</span>
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  +4
                </span>
              </div>
              <div className="text-3xl font-bold text-foreground">{stats?.member_count || 35}</div>
              <div className="text-xs text-muted-foreground mt-1">in last 7 days</div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Job applications</span>
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  +7
                </span>
              </div>
              <div className="text-3xl font-bold text-foreground">{stats?.team_count || 49}</div>
              <div className="text-xs text-muted-foreground mt-1">in last 7 days</div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Total candidates</span>
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  +25
                </span>
              </div>
              <div className="text-3xl font-bold text-foreground">587</div>
              <div className="text-xs text-muted-foreground mt-1">for the entire period</div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Employees</span>
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <TrendingUp className="h-3 w-3" />
                  +3
                </span>
              </div>
              <div className="text-3xl font-bold text-foreground">{stats?.api_key_count || 20}</div>
              <div className="text-xs text-muted-foreground mt-1">for the entire period</div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="relative h-64 bg-gradient-to-b from-primary/10 to-transparent rounded-lg p-4 border border-border">
            <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(255, 106, 60)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(255, 106, 60)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 120 Q 50 80, 100 100 T 200 90 T 300 110 T 400 70 T 500 100 T 600 60 T 700 90 T 800 50"
                fill="url(#chartGradient)"
                stroke="rgb(255, 106, 60)"
                strokeWidth="2"
              />
            </svg>
            <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs text-muted-foreground">
              <span>17/11</span>
              <span>18/11</span>
              <span>19/11</span>
              <span>20/11</span>
              <span>21/11</span>
              <span>22/11</span>
              <span>23/11</span>
              <span>24/11</span>
              <span>25/11</span>
              <span>26/11</span>
              <span>27/11</span>
              <span>28/11</span>
              <span>29/11</span>
              <span>30/11</span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-2 gap-6">
          {/* Upcoming Interviews */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Upcoming interviews</h3>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-4">
              {[24, 25, 26].map((day, idx) => (
                <div key={day} className="flex items-start gap-4 pb-4 border-b border-border last:border-0">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{day}</div>
                    <div className="text-xs text-muted-foreground">{idx === 0 ? 'Mon' : idx === 1 ? 'Tue' : 'Wed'}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">Ivan Serthin (10:30 - 12:00)</div>
                    <div className="text-xs text-muted-foreground">Product Designer phone screening</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 text-muted-foreground hover:text-foreground">
                      <LinkIcon className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button className="text-sm text-primary hover:text-primary/90 font-semibold">
                Join with Google Meet
              </button>
            </div>
          </div>

          {/* Applications to Review */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Applications to review</h3>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-4">
              {[
                { title: 'Senior .NET Developer', date: 'Nov 26 2020', count: 4 },
                { title: 'Senior Java Developer', date: 'Nov 25 2020', count: 10 },
                { title: 'UI/UX Designer', date: 'Nov 24 2020', count: 7 }
              ].map((app, idx) => (
                <div key={idx} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{app.title}</div>
                    <div className="text-xs text-muted-foreground">{app.date}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[...Array(Math.min(3, app.count))].map((_, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/90 border-2 border-card"
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">+{app.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
