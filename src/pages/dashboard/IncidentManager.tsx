import React, { useState, useEffect } from 'react';
import { Search, Filter, AlertTriangle, Clock, CheckCircle, XCircle, ExternalLink, ArrowRight, Calendar, 
         MessageSquare, RefreshCw, PlusCircle, PlayCircle, PauseCircle, StopCircle, Cpu, ArrowUpRight, 
         Trello, GitMerge, Bug, Workflow, Database, Server } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample data structure for incidents
type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
type PipelineType = 'airflow' | 'informatica' | 'dbt' | 'other';

interface Incident {
  id: number;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  pipeline: {
    name: string;
    type: PipelineType;
  };
  created: string;
  lastUpdated: string;
  resolvedAt?: string;
  jiraTicket?: string;
  assignee?: string;
  timeSpent?: number; // in minutes
  aiSuggestions?: string[];
  aiResolved?: boolean;
  impacts: string[];
  steps: {
    id: number;
    action: string;
    timestamp: string;
    user: string;
    status: 'success' | 'failed' | 'pending';
  }[];
}

// Sample incident data
const sampleIncidents: Incident[] = [
  {
    id: 1,
    title: 'Airflow DAG customer_etl failure',
    description: 'Customer ETL DAG has failed due to source API timeout. This is affecting downstream reporting dashboards.',
    status: 'investigating',
    severity: 'high',
    pipeline: {
      name: 'customer_etl',
      type: 'airflow'
    },
    created: '2025-05-28T09:15:00Z',
    lastUpdated: '2025-05-28T10:30:00Z',
    jiraTicket: 'DATA-1234',
    assignee: 'alex.johnson',
    timeSpent: 75,
    aiSuggestions: [
      'API timeout may be due to rate limiting, check credentials and request volume',
      'Examine logs for specific error codes from the API provider',
      'Consider implementing a retry mechanism with exponential backoff'
    ],
    impacts: ['Daily Customer Reports', 'Marketing Analytics Dashboard'],
    steps: [
      {
        id: 1,
        action: 'Incident detected',
        timestamp: '2025-05-28T09:15:00Z',
        user: 'system',
        status: 'success'
      },
      {
        id: 2,
        action: 'Assignee added',
        timestamp: '2025-05-28T09:20:00Z',
        user: 'sarah.manager',
        status: 'success'
      },
      {
        id: 3,
        action: 'API credentials refreshed',
        timestamp: '2025-05-28T10:05:00Z',
        user: 'alex.johnson',
        status: 'success'
      }
    ]
  },
  {
    id: 2,
    title: 'dbt model orders_daily_summary failing',
    description: 'The daily orders summary model is failing due to a schema change in the source table. Primary key column was renamed.',
    status: 'resolved',
    severity: 'medium',
    pipeline: {
      name: 'orders_daily_summary',
      type: 'dbt'
    },
    created: '2025-05-27T14:30:00Z',
    lastUpdated: '2025-05-27T17:45:00Z',
    resolvedAt: '2025-05-27T17:45:00Z',
    jiraTicket: 'DATA-1230',
    assignee: 'robert.smith',
    timeSpent: 195,
    aiResolved: true,
    aiSuggestions: [
      'Column name in model SQL doesn\'t match source. Update reference from order_id to order_key',
      'Apply patch to orders_daily_summary.sql to reflect schema change'
    ],
    impacts: ['Sales Reports', 'Finance Dashboard'],
    steps: [
      {
        id: 1,
        action: 'Incident detected',
        timestamp: '2025-05-27T14:30:00Z',
        user: 'system',
        status: 'success'
      },
      {
        id: 2,
        action: 'AI suggested fix applied',
        timestamp: '2025-05-27T16:15:00Z',
        user: 'robert.smith',
        status: 'success'
      },
      {
        id: 3,
        action: 'Model runs successfully',
        timestamp: '2025-05-27T17:30:00Z',
        user: 'system',
        status: 'success'
      },
      {
        id: 4,
        action: 'Incident marked as resolved',
        timestamp: '2025-05-27T17:45:00Z',
        user: 'robert.smith',
        status: 'success'
      }
    ]
  },
  {
    id: 3,
    title: 'Informatica workflow product_integration stalled',
    description: 'The product integration workflow is stalled at the transformation stage. Performance issue detected in the lookup transformation.',
    status: 'open',
    severity: 'critical',
    pipeline: {
      name: 'product_integration',
      type: 'informatica'
    },
    created: '2025-05-28T08:00:00Z',
    lastUpdated: '2025-05-28T08:10:00Z',
    jiraTicket: 'DATA-1235',
    impacts: ['Product Catalog', 'E-commerce Website', 'Mobile App'],
    steps: [
      {
        id: 1,
        action: 'Incident detected',
        timestamp: '2025-05-28T08:00:00Z',
        user: 'system',
        status: 'success'
      },
      {
        id: 2,
        action: 'Jira ticket created',
        timestamp: '2025-05-28T08:05:00Z',
        user: 'system',
        status: 'success'
      }
    ]
  },
  {
    id: 4,
    title: 'dbt source freshness check failed',
    description: 'Source freshness check failed for raw_transactions table. Data is over 12 hours stale.',
    status: 'open',
    severity: 'high',
    pipeline: {
      name: 'financial_models',
      type: 'dbt'
    },
    created: '2025-05-28T07:00:00Z',
    lastUpdated: '2025-05-28T07:05:00Z',
    impacts: ['Financial Reporting', 'Executive Dashboard'],
    steps: [
      {
        id: 1,
        action: 'Incident detected',
        timestamp: '2025-05-28T07:00:00Z',
        user: 'system',
        status: 'success'
      }
    ]
  },
  {
    id: 5,
    title: 'Airflow sensor timeout for partner_data_arrival',
    description: 'Partner data sensor has timed out after waiting for 3 hours. Daily partner feed is missing.',
    status: 'closed',
    severity: 'medium',
    pipeline: {
      name: 'partner_data_processing',
      type: 'airflow'
    },
    created: '2025-05-26T18:30:00Z',
    lastUpdated: '2025-05-27T11:20:00Z',
    resolvedAt: '2025-05-27T11:20:00Z',
    jiraTicket: 'DATA-1225',
    assignee: 'emily.parker',
    timeSpent: 145,
    impacts: ['Partner Analytics', 'Revenue Sharing Reports'],
    steps: [
      {
        id: 1,
        action: 'Incident detected',
        timestamp: '2025-05-26T18:30:00Z',
        user: 'system',
        status: 'success'
      },
      {
        id: 2,
        action: 'Contacted partner support',
        timestamp: '2025-05-27T09:15:00Z',
        user: 'emily.parker',
        status: 'success'
      },
      {
        id: 3,
        action: 'Partner manually uploaded data',
        timestamp: '2025-05-27T10:45:00Z',
        user: 'emily.parker',
        status: 'success'
      },
      {
        id: 4,
        action: 'Pipeline rerun successfully',
        timestamp: '2025-05-27T11:15:00Z',
        user: 'system',
        status: 'success'
      },
      {
        id: 5,
        action: 'Incident closed',
        timestamp: '2025-05-27T11:20:00Z',
        user: 'emily.parker',
        status: 'success'
      }
    ]
  }
];

export function IncidentManager() {
  const [incidents, setIncidents] = useState<Incident[]>(sampleIncidents);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>(sampleIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | 'all'>('all');
  const [pipelineFilter, setPipelineFilter] = useState<PipelineType | 'all'>('all');

  useEffect(() => {
    let result = incidents;
    if (searchTerm) {
      result = result.filter(inc => 
        inc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inc.pipeline.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(inc => inc.status === statusFilter);
    }
    if (severityFilter !== 'all') {
      result = result.filter(inc => inc.severity === severityFilter);
    }
    if (pipelineFilter !== 'all') {
      result = result.filter(inc => inc.pipeline.type === pipelineFilter);
    }
    setFilteredIncidents(result);
  }, [searchTerm, statusFilter, severityFilter, pipelineFilter, incidents]);

  const openModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsModalOpen(true);
  };

  // Helper function to get status badge color
  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'investigating':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'closed':
        return 'bg-gray-100 text-gray-600 border-gray-300'; 
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  // Helper function to get severity badge color
  const getSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-300 font-medium';
      case 'high':
        return 'bg-red-100 text-red-600 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'low':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  // Helper function to get pipeline type icon
  const getPipelineIcon = (type: PipelineType) => {
    switch (type) {
      case 'airflow': return <Workflow className="h-5 w-5 text-sky-600" />;
      case 'informatica': return <GitMerge className="h-5 w-5 text-purple-600" />;
      case 'dbt': return <Database className="h-5 w-5 text-teal-600" />;
      default: return <Server className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format time duration (minutes to hours and minutes)
  const formatTimeDuration = (minutes?: number) => {
    if (!minutes) return 'N/A';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  // Format date to relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / 1440)}d ago`;
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3 sm:mb-0 flex items-center">
          <AlertTriangle className="h-7 w-7 mr-3 text-red-600" />
          Incident Manager
        </h1>
        <button 
          onClick={() => alert('Create New Incident form would appear here.')} 
          className="flex items-center bg-sky-600 text-white px-4 py-2.5 rounded-lg shadow-md hover:bg-sky-700 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Create Incident
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 sm:p-5 bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search incidents..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-700 placeholder-gray-500 bg-white transition-shadow focus:shadow-sm"
            />
          </div>
          <div>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | 'all')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-700 bg-white transition-shadow focus:shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <select 
              value={severityFilter} 
              onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity | 'all')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-700 bg-white transition-shadow focus:shadow-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <select 
              value={pipelineFilter} 
              onChange={(e) => setPipelineFilter(e.target.value as PipelineType | 'all')}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm text-gray-700 bg-white transition-shadow focus:shadow-sm"
            >
              <option value="all">All Pipelines</option>
              <option value="airflow">Airflow</option>
              <option value="informatica">Informatica</option>
              <option value="dbt">dbt</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incident List */}
      {filteredIncidents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredIncidents.map(incident => (
            <div 
              key={incident.id} 
              onClick={() => openModal(incident)} 
              className="bg-white rounded-xl shadow-lg hover:shadow-xl border border-gray-200 p-5 cursor-pointer transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h2 className="text-lg font-semibold text-gray-800 leading-tight pr-2">{incident.title}</h2>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getSeverityColor(incident.severity)}`}>
                    {incident.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3 h-16 overflow-hidden line-clamp-3">{incident.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <div className="flex items-center">
                    {getPipelineIcon(incident.pipeline.type)}
                    <span className="ml-1.5 capitalize">{incident.pipeline.type}: {incident.pipeline.name}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full border ${getStatusColor(incident.status)}`}>
                    {incident.status}
                  </span>
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <div className="flex items-center">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                    Created: {formatRelativeTime(incident.created)}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                    Last Updated: {formatRelativeTime(incident.lastUpdated)}
                  </div>
                  {incident.resolvedAt && (
                     <div className="flex items-center text-green-600">
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                      Resolved: {formatRelativeTime(incident.resolvedAt)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-3 border-t border-gray-200 flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  {incident.assignee ? `Assigned to: ${incident.assignee}` : 'Unassigned'}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); openModal(incident); }} 
                  className="text-sm text-sky-600 hover:text-sky-700 font-medium flex items-center"
                >
                  View Details <ArrowRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bug className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Incidents Found</h3>
          <p className="text-gray-500">Try adjusting your filters or check back later.</p>
        </div>
      )}

      {/* Incident Detail Modal */}
      {isModalOpen && selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 transform transition-all duration-300 ease-in-out scale-100" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{selectedIncident.title}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XCircle className="h-7 w-7" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-5 text-sm">
              <div className="flex items-center">
                <strong className="text-gray-600 w-28">Status:</strong> 
                <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${getStatusColor(selectedIncident.status)}`}>{selectedIncident.status}</span>
              </div>
              <div className="flex items-center">
                <strong className="text-gray-600 w-28">Severity:</strong> 
                <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${getSeverityColor(selectedIncident.severity)}`}>{selectedIncident.severity}</span>
              </div>
              <div className="flex items-center col-span-1 md:col-span-2">
                <strong className="text-gray-600 w-28">Pipeline:</strong> 
                <span className="text-gray-700 flex items-center">
                  {getPipelineIcon(selectedIncident.pipeline.type)} 
                  <span className="ml-1.5">{selectedIncident.pipeline.name} ({selectedIncident.pipeline.type})</span>
                </span>
              </div>
              <div className="flex items-center">
                <strong className="text-gray-600 w-28">Created:</strong> <span className="text-gray-700">{new Date(selectedIncident.created).toLocaleString()}</span>
              </div>
              <div className="flex items-center">
                <strong className="text-gray-600 w-28">Last Updated:</strong> <span className="text-gray-700">{new Date(selectedIncident.lastUpdated).toLocaleString()}</span>
              </div>
              {selectedIncident.resolvedAt && (
                <div className="flex items-center text-green-700">
                  <strong className="text-green-600 w-28">Resolved At:</strong> {new Date(selectedIncident.resolvedAt).toLocaleString()}
                </div>
              )}
              <div className="flex items-center">
                <strong className="text-gray-600 w-28">Assignee:</strong> <span className="text-gray-700">{selectedIncident.assignee || 'N/A'}</span>
              </div>
              <div className="flex items-center">
                <strong className="text-gray-600 w-28">Time Spent:</strong> <span className="text-gray-700">{formatTimeDuration(selectedIncident.timeSpent) || 'N/A'}</span>
              </div>
              {selectedIncident.jiraTicket && (
                <div className="flex items-center col-span-1 md:col-span-2">
                  <strong className="text-gray-600 w-28">Jira Ticket:</strong> 
                  <Link to={`https://jira.example.com/browse/${selectedIncident.jiraTicket}`} target="_blank" className="text-sky-600 hover:text-sky-700 hover:underline flex items-center">
                    {selectedIncident.jiraTicket} <ExternalLink className="h-4 w-4 ml-1.5" />
                  </Link>
                </div>
              )}
            </div>
            
            <div className="mb-5">
              <h3 className="text-base font-semibold mb-1.5 text-gray-700">Description</h3>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-200 whitespace-pre-wrap">{selectedIncident.description}</p>
            </div>

            <div className="mb-5">
              <h3 className="text-base font-semibold mb-1.5 text-gray-700">Impacted Systems/Reports</h3>
              <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-md border border-gray-200">
                {selectedIncident.impacts.map(impact => (
                  <span key={impact} className="px-2.5 py-1 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">{impact}</span>
                ))}
              </div>
            </div>

            {selectedIncident.aiSuggestions && selectedIncident.aiSuggestions.length > 0 && (
              <div className="mb-6 p-4 border border-sky-200 rounded-lg bg-sky-50 shadow-sm">
                <div className="flex items-center mb-2.5">
                  <Cpu className="h-6 w-6 mr-2.5 text-sky-600" />
                  <h3 className="text-lg font-semibold text-sky-700">AI-Assisted Diagnosis & Suggestions</h3>
                </div>
                {selectedIncident.aiResolved && (
                  <div className="flex items-center text-sm text-green-700 mb-2.5 bg-green-100 p-2.5 rounded-md border border-green-200 font-medium">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    This incident was potentially resolved using AI suggestions.
                  </div>
                )}
                <ul className="list-disc list-inside space-y-2.5 text-sm">
                  {selectedIncident.aiSuggestions.map((suggestion, index) => (
                    <li key={index} className="bg-white p-3 rounded-md shadow-sm border border-gray-200 text-gray-700 hover:border-sky-300 transition-colors">{suggestion}</li>
                  ))}
                </ul>
                <div className="mt-3 text-xs text-gray-500">
                  <p>These suggestions are AI-generated. Always verify before applying critical changes.</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-base font-semibold mb-2 text-gray-700">Resolution Timeline / Steps</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 border border-gray-200 rounded-md p-3 bg-gray-50">
                {selectedIncident.steps.map(step => (
                  <div key={step.id} className="flex items-start p-3 bg-white rounded-md shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className={`mr-3 mt-1 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center 
                      ${step.status === 'success' ? 'bg-green-500' : step.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                      {step.status === 'success' ? <CheckCircle className="h-3 w-3 text-white"/> : 
                       step.status === 'failed' ? <XCircle className="h-3 w-3 text-white"/> : 
                       <Clock className="h-3 w-3 text-white"/>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{step.action}</p>
                      <p className="text-xs text-gray-500">By: {step.user} - {formatRelativeTime(step.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-300 flex justify-end space-x-3">
              <button 
                onClick={() => alert('Escalate not implemented')} 
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75 shadow-sm hover:shadow-md"
              >
                Escalate
              </button>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 shadow-sm hover:shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
