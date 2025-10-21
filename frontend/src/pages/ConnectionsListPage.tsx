import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, GitBranch, Play, Plus, ExternalLink, Clock, CheckCircle } from 'lucide-react';

interface Connection {
  id: string;
  repository_url: string;
  repository_name: string;
  repository_owner: string;
  branch: string;
  status: string;
  manifest_uploaded: boolean;
  extraction_tier?: string;
  total_objects?: number;
  last_extraction_at?: string;
  created_at: string;
}

export const ConnectionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/admin/metadata/connections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async (connectionId: string) => {
    try {
      setExtracting(prev => new Set(prev).add(connectionId));

      const response = await fetch(`/api/metadata/connections/${connectionId}/extract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Navigate to progress page
        navigate(`/metadata/connections/${connectionId}/extract`);
      } else {
        const error = await response.json();
        alert(`Extraction failed: ${error.error}`);
        setExtracting(prev => {
          const next = new Set(prev);
          next.delete(connectionId);
          return next;
        });
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setExtracting(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading connections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Repository Connections
              </h1>
              <p className="text-gray-600">
                Automatic metadata extraction from your dbt projects
              </p>
            </div>
            <button
              onClick={() => navigate('/metadata/connections/new')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Connect Repository
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {connections.length === 0 ? (
          <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
            <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No connections yet
            </h3>
            <p className="text-gray-600 mb-6">
              Connect your first dbt project to start automatic metadata extraction
            </p>
            <button
              onClick={() => navigate('/metadata/connections/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Connect Repository
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                extracting={extracting.has(connection.id)}
                onExtract={() => handleExtract(connection.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ConnectionCardProps {
  connection: Connection;
  extracting: boolean;
  onExtract: () => void;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({ connection, extracting, onExtract }) => {
  const isExtracting = connection.status === 'extracting' || extracting;

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {connection.repository_name}
              </h3>
              <p className="text-xs text-gray-500">
                {connection.repository_owner}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span className={`
            px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1
            ${connection.manifest_uploaded && !isExtracting
              ? 'bg-green-100 text-green-800' 
              : isExtracting
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
            }
          `}>
            {isExtracting ? (
              <>
                <Clock className="w-3 h-3 animate-spin" />
                Extracting
              </>
            ) : connection.manifest_uploaded ? (
              <>
                <CheckCircle className="w-3 h-3" />
                Ready
              </>
            ) : (
              'Not Extracted'
            )}
          </span>
        </div>

        {/* Stats */}
        {connection.manifest_uploaded && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Objects</span>
              <span className="font-medium text-gray-900">{connection.total_objects || 0}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Tier</span>
              <span className={`font-medium ${
                connection.extraction_tier === 'GOLD' ? 'text-yellow-600' :
                connection.extraction_tier === 'SILVER' ? 'text-gray-600' :
                'text-orange-600'
              }`}>
                {connection.extraction_tier || 'N/A'}
              </span>
            </div>
            {connection.last_extraction_at && (
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Last extracted:</span>
                <span>{new Date(connection.last_extraction_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onExtract}
            disabled={isExtracting}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm rounded-lg transition-colors
              ${isExtracting 
                ? 'bg-gray-400 text-white cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            <Play className="w-4 h-4" />
            {isExtracting ? 'Extracting...' : connection.manifest_uploaded ? 'Re-extract' : 'Extract'}
          </button>
          <a
            href={connection.repository_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4 text-gray-600" />
          </a>
        </div>

        {/* Auto-extraction Note */}
        {!connection.manifest_uploaded && !isExtracting && (
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            <strong>Automatic extraction:</strong> Click Extract to clone repo, run dbt parse, and extract metadata automatically
          </div>
        )}
      </div>
    </div>
  );
};
