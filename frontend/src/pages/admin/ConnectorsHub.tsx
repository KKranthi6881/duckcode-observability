import { useState } from 'react';
import { ArrowLeft, Plug2 } from 'lucide-react';
import ConnectorsPage from '../dashboard/ConnectorsPage';
import { MetadataExtraction } from './MetadataExtraction';

// Import SVG icons
const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const SnowflakeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.27 2.23l-1.27.76-1.27-.76-1.27.76-1.27-.76-1.27.76-1.27-.76-1.27.76-1.27-.76v1.51l1.27.76 1.27-.76 1.27.76 1.27-.76 1.27.76 1.27-.76 1.27.76 1.27-.76V2.23zm-3.81 3.82l-1.27.76-1.27-.76-1.27.76-1.27-.76v1.51l1.27.76 1.27-.76 1.27.76 1.27-.76V6.05zm7.62 1.52l-1.27-.76-1.27.76-1.27-.76-1.27.76V6.05l1.27-.76 1.27.76 1.27-.76 1.27.76v1.52zm-11.43 0l-1.27-.76-1.27.76-1.27-.76-1.27.76V6.05l1.27-.76 1.27.76 1.27-.76 1.27.76v1.52zm15.24 3.81l-1.27-.76-1.27.76-1.27-.76v1.52l1.27.76 1.27-.76 1.27.76 1.27-.76v-1.52l-1.27.76zm-19.05 0l-1.27-.76-1.27.76v-1.52l1.27-.76 1.27.76 1.27-.76 1.27.76v1.52l-1.27-.76zm11.43 0l-1.27-.76-1.27.76-1.27-.76-1.27.76v-1.52l1.27-.76 1.27.76 1.27-.76 1.27.76v1.52zm3.81-3.81l-1.27-.76-1.27.76v-1.52l1.27-.76 1.27.76v1.52zm-7.62 11.43l-1.27-.76-1.27.76-1.27-.76-1.27.76v-1.52l1.27-.76 1.27.76 1.27-.76 1.27.76V18zm7.62-3.81l-1.27-.76-1.27.76-1.27-.76-1.27.76v-1.52l1.27-.76 1.27.76 1.27-.76 1.27.76v1.52zm-3.81 7.62l-1.27-.76-1.27.76v-1.52l1.27-.76 1.27.76v1.52z"/>
  </svg>
);

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  gradient: string;
  stats?: {
    connections?: number;
    objects?: number;
  };
}

const CONNECTORS: Connector[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Extract metadata from GitHub repositories - tables, views, and columns',
    icon: GitHubIcon,
    iconColor: 'text-purple-400',
    gradient: 'from-purple-600 to-purple-700',
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: 'Connect to Snowflake data warehouse for cost intelligence and optimization',
    icon: SnowflakeIcon,
    iconColor: 'text-blue-400',
    gradient: 'from-blue-600 to-blue-700',
  },
];

export default function ConnectorsHub() {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  // Render individual connector page
  if (selectedConnector === 'github') {
    return (
      <div className="min-h-screen bg-[#0d0c0c]">
        <div className="border-b border-[#2d2a27] bg-[#161413] px-6 py-4">
          <button
            onClick={() => setSelectedConnector(null)}
            className="flex items-center gap-2 text-[#8d857b] hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Connectors
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/10 rounded-lg">
              <GitHubIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">GitHub Connector</h1>
              <p className="text-sm text-[#8d857b]">Extract metadata from repositories</p>
            </div>
          </div>
        </div>
        <MetadataExtraction />
      </div>
    );
  }

  if (selectedConnector === 'snowflake') {
    return (
      <div className="min-h-screen bg-[#0d0c0c]">
        <div className="border-b border-[#2d2a27] bg-[#161413] px-6 py-4">
          <button
            onClick={() => setSelectedConnector(null)}
            className="flex items-center gap-2 text-[#8d857b] hover:text-white transition mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Connectors
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-lg">
              <SnowflakeIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Snowflake Connector</h1>
              <p className="text-sm text-[#8d857b]">Cost intelligence and optimization</p>
            </div>
          </div>
        </div>
        <ConnectorsPage />
      </div>
    );
  }

  // Main hub view
  return (
    <div className="min-h-screen bg-[#0d0c0c] p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Plug2 className="w-8 h-8 text-[#ff6a3c]" />
              Connectors Hub
            </h1>
            <p className="text-[#8d857b] mt-1">Manage all your data source connections in one place</p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <Plug2 className="w-8 h-8 text-[#ff6a3c]" />
              <span className="text-xs font-bold text-[#8d857b] uppercase">Available</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{CONNECTORS.length}</div>
            <div className="text-sm text-[#8d857b]">Data connectors</div>
          </div>

          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <GitHubIcon className="w-8 h-8 text-purple-400" />
              <span className="text-xs font-bold text-[#8d857b] uppercase">GitHub</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">-</div>
            <div className="text-sm text-[#8d857b]">Repositories connected</div>
          </div>

          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <SnowflakeIcon className="w-8 h-8 text-blue-400" />
              <span className="text-xs font-bold text-[#8d857b] uppercase">Snowflake</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">-</div>
            <div className="text-sm text-[#8d857b]">Accounts configured</div>
          </div>
        </div>

        {/* Connectors Grid */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Available Connectors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CONNECTORS.map((connector) => {
              const Icon = connector.icon;
              return (
                <button
                  key={connector.id}
                  onClick={() => setSelectedConnector(connector.id)}
                  className="group relative bg-[#161413] border border-[#2d2a27] rounded-xl p-6 hover:border-[#ff6a3c]/50 transition-all duration-200 text-left overflow-hidden"
                >
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${connector.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  
                  <div className="relative">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`p-3 bg-gradient-to-br ${connector.gradient} rounded-xl shadow-lg`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#ff6a3c] transition-colors">
                          {connector.name}
                        </h3>
                        <p className="text-sm text-[#8d857b] leading-relaxed">
                          {connector.description}
                        </p>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2d2a27]">
                      <span className="text-xs text-[#8d857b] font-medium uppercase tracking-wider">
                        Click to configure
                      </span>
                      <div className="flex items-center gap-2 text-[#ff6a3c] opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-sm font-medium">Open</span>
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Info */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">About Connectors</h3>
          <div className="space-y-3 text-sm text-[#8d857b]">
            <p>
              <span className="font-medium text-white">Connectors</span> allow you to integrate external data sources
              with your platform. Each connector provides specialized functionality:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-[#ff6a3c] mt-1">•</span>
                <span><strong className="text-white">GitHub:</strong> Extract database schemas, tables, views, and column metadata from dbt projects</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#ff6a3c] mt-1">•</span>
                <span><strong className="text-white">Snowflake:</strong> Analyze costs, monitor usage, and optimize your Snowflake data warehouse</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
