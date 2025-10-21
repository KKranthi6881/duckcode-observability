import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExtractionProgress } from '../components/metadata/ExtractionProgress';
import { ArrowLeft, ExternalLink, GitBranch, Eye } from 'lucide-react';

interface Connection {
  id: string;
  repository_url: string;
  repository_name: string;
  repository_owner: string;
  branch: string;
  status: string;
  manifest_uploaded: boolean;
}

export const ExtractionPage: React.FC = () => {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnection();
  }, [connectionId]);

  const fetchConnection = async () => {
    try {
      const response = await fetch(
        `/api/admin/metadata/connections/${connectionId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConnection(data);
      }
    } catch (error) {
      console.error('Failed to fetch connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    // Refresh connection data
    fetchConnection();
  };

  if (loading || !connection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate('/metadata/connections')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Connections</span>
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Automatic Metadata Extraction
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  <span>{connection.repository_owner}/{connection.repository_name}</span>
                </div>
                <span>•</span>
                <span>Branch: {connection.branch}</span>
              </div>
            </div>

            <a
              href={connection.repository_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Repository
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              🚀 Automatic Extraction Process
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Cloning repository from GitHub</li>
              <li>Installing dbt dependencies</li>
              <li>Running <code className="bg-blue-100 px-1 rounded">dbt parse</code> to generate manifest</li>
              <li>Extracting models, sources, and dependencies</li>
              <li>Storing metadata in database</li>
            </ul>
            <p className="text-xs text-blue-700 mt-3">
              ⏱️ This typically takes 1-3 minutes depending on project size
            </p>
          </div>

          {/* Progress Component */}
          {connectionId && (
            <ExtractionProgress
              connectionId={connectionId}
              onComplete={handleComplete}
            />
          )}

          {/* Actions (shown after completion) */}
          {connection.manifest_uploaded && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Next Steps
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => navigate(`/metadata/connections/${connectionId}/lineage`)}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-5 h-5" />
                  View Lineage
                </button>
                <button
                  onClick={() => navigate('/metadata/connections')}
                  className="flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to Connections
                </button>
              </div>
            </div>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard
              title="GOLD Tier"
              description="Manifest-based extraction provides 100% accurate lineage"
              color="yellow"
            />
            <InfoCard
              title="Auto-Updates"
              description="Setup GitHub webhooks for automatic re-extraction on push"
              color="blue"
            />
            <InfoCard
              title="Fast Processing"
              description="Typical extraction completes in under 3 minutes"
              color="green"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface InfoCardProps {
  title: string;
  description: string;
  color: 'yellow' | 'blue' | 'green';
}

const InfoCard: React.FC<InfoCardProps> = ({ title, description, color }) => {
  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900'
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <h4 className="font-semibold text-sm mb-1">{title}</h4>
      <p className="text-xs opacity-90">{description}</p>
    </div>
  );
};
