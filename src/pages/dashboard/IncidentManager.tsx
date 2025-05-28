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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [pipelineFilter, setPipelineFilter] = useState<string>('all');
  
  // Apply filters
  useEffect(() => {
    let result = incidents;
    
    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(incident => 
        incident.title.toLowerCase().includes(term) || 
        incident.description.toLowerCase().includes(term) ||
        incident.pipeline.name.toLowerCase().includes(term) ||
        (incident.jiraTicket && incident.jiraTicket.toLowerCase().includes(term))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(incident => incident.status === statusFilter);
    }
    
    // Apply severity filter
    if (severityFilter !== 'all') {
      result = result.filter(incident => incident.severity === severityFilter);
    }
    
    // Apply pipeline filter
    if (pipelineFilter !== 'all') {
      result = result.filter(incident => incident.pipeline.type === pipelineFilter);
    }
    
    setFilteredIncidents(result);
  }, [incidents, searchTerm, statusFilter, severityFilter, pipelineFilter]);
  
  // Helper function to get status badge color
  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-700 border-red-200';
      case 'investigating': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'closed': return 'bg-gray-200 text-gray-700 border-gray-300';
      default: return 'bg-gray-200 text-gray-700 border-gray-300';
    }
  };
  
  // Helper function to get severity badge color
  const getSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-sky-100 text-sky-700 border-sky-200';
      default: return 'bg-gray-200 text-gray-700 border-gray-300';
    }
  };
  
  // Helper function to get pipeline type icon
  const getPipelineIcon = (type: PipelineType) => {
    switch (type) {
      case 'airflow': return <Workflow className="h-5 w-5 text-blue-500" />;
      case 'informatica': return <Database className="h-5 w-5 text-purple-500" />;
      case 'dbt': return <GitMerge className="h-5 w-5 text-green-500" />;
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
    <div className="space-y-6 p-6 bg-gray-100 min-h-screen text-gray-900">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Incident Manager</h1>
        <button 
          onClick={() => alert('New Incident form not yet implemented.')} 
          className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          New Incident
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {['open', 'investigating', 'resolved', 'closed'].map(status => {
          const count = incidents.filter(inc => inc.status === status).length;
          let icon = <AlertTriangle className="h-6 w-6" />;
          let iconColor = 'text-gray-600';
          let iconBg = 'bg-gray-100';

          switch (status) {
            case 'open': icon = <AlertTriangle className="h-6 w-6 text-red-600" />; iconBg = 'bg-red-100'; break;
            case 'investigating': icon = <RefreshCw className="h-6 w-6 text-yellow-600" />; iconBg = 'bg-yellow-100'; break;
            case 'resolved': icon = <CheckCircle className="h-6 w-6 text-green-600" />; iconBg = 'bg-green-100'; break;
            case 'closed': icon = <XCircle className="h-6 w-6 text-gray-600" />; iconBg = 'bg-gray-100'; break;
          }
          return (
            <div key={status} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase">{status}</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-1">{count}</p>
                </div>
                <div className={`p-3 rounded-full ${iconBg}`}>
                  {icon}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <input 
                type="text" 
                id="search"
                placeholder="Search by title, JIRA ID..."
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              id="statusFilter"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-gray-900"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label htmlFor="severityFilter" className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select 
              id="severityFilter"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-gray-900"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="pipelineFilter" className="block text-sm font-medium text-gray-700 mb-1">Pipeline Type</label>
            <select 
              id="pipelineFilter"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-gray-900"
              value={pipelineFilter}
              onChange={(e) => setPipelineFilter(e.target.value)}
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

      {/* Incidents Table */}
      <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incident</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignee</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">JIRA</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Spent</th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">View</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredIncidents.length > 0 ? filteredIncidents.map((incident) => (
              <tr key={incident.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={incident.title}>{incident.title}</div>
                  <div className="text-xs text-gray-500 truncate max-w-xs" title={incident.description}>{incident.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(incident.status)} border`}>
                    {incident.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityColor(incident.severity)} border`}>
                    {incident.severity}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getPipelineIcon(incident.pipeline.type)}
                    <span className="ml-2 text-sm text-gray-700">{incident.pipeline.name} ({incident.pipeline.type})</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatRelativeTime(incident.created)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {incident.assignee || 'Unassigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {incident.jiraTicket ? (
                    <a href={`#`} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-700 flex items-center">
                      {incident.jiraTicket} <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500">N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {formatTimeDuration(incident.timeSpent)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => { setSelectedIncident(incident); setIsModalOpen(true); }} 
                    className="text-sky-600 hover:text-sky-700 flex items-center"
                  >
                    View <ArrowRight className="h-4 w-4 ml-1" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Search className="h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-xl font-semibold text-gray-500 mb-1">No Incidents Found</p>
                    <p className="text-sm text-gray-400">Try adjusting your search or filter criteria.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Incident Detail Modal */}
      {isModalOpen && selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative text-gray-900 transform transition-all duration-300 ease-in-out scale-100">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-bold mb-2 text-sky-700">{selectedIncident.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
              {[ 
                { label: 'Status', value: selectedIncident.status, colorClass: getStatusColor(selectedIncident.status), isBadge: true },
                { label: 'Severity', value: selectedIncident.severity, colorClass: getSeverityColor(selectedIncident.severity), isBadge: true },
                { label: 'Pipeline', value: `${selectedIncident.pipeline.name} (${selectedIncident.pipeline.type})`, icon: getPipelineIcon(selectedIncident.pipeline.type) },
                { label: 'Created', value: new Date(selectedIncident.created).toLocaleString() },
                { label: 'Last Updated', value: new Date(selectedIncident.lastUpdated).toLocaleString() },
                { label: 'Assignee', value: selectedIncident.assignee || 'N/A' },
                { label: 'JIRA Ticket', value: selectedIncident.jiraTicket, isLink: true },
                { label: 'Time Spent', value: formatTimeDuration(selectedIncident.timeSpent) },
                ...(selectedIncident.resolvedAt ? [{ label: 'Resolved At', value: new Date(selectedIncident.resolvedAt).toLocaleString() }] : []),
              ].map(item => (
                <div key={item.label} className="bg-gray-50 p-3 rounded-md border border-gray-200">
                  <p className="text-xs font-medium text-gray-500 uppercase">{item.label}</p> 
                  {item.isBadge ? (
                    <p className={`mt-1 inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${item.colorClass} border`}>{item.value}</p>
                  ) : item.icon ? (
                    <div className="mt-1 flex items-center text-gray-700">
                      {item.icon}
                      <span className="ml-2">{item.value}</span>
                    </div>
                  ) : item.isLink && item.value !== 'N/A' ? (
                     <a href="#" target="_blank" rel="noopener noreferrer" className="mt-1 text-sky-600 hover:text-sky-700 flex items-center">{item.value} <ExternalLink className="h-3 w-3 ml-1"/></a>
                  ) : (
                    <p className="mt-1 text-gray-700">{item.value}</p>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1 text-gray-700">Description</h3>
              <p className="text-sm bg-gray-50 p-3 rounded-md border border-gray-200 text-gray-700">{selectedIncident.description}</p>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1 text-gray-700">Impacted Systems/Reports</h3>
              <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-md border border-gray-200">
                {selectedIncident.impacts.map(impact => (
                  <span key={impact} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">{impact}</span>
                ))}
              </div>
            </div>

            {selectedIncident.aiSuggestions && selectedIncident.aiSuggestions.length > 0 && (
              <div className="mb-6 p-4 border border-sky-300 rounded-lg bg-sky-50">
                <div className="flex items-center mb-2">
                  <Cpu className="h-6 w-6 mr-2 text-sky-600" />
                  <h3 className="text-xl font-semibold text-sky-700">AI-Assisted Diagnosis & Suggestions</h3>
                </div>
                {selectedIncident.aiResolved && (
                  <div className="flex items-center text-sm text-green-700 mb-2 bg-green-100 p-2 rounded-md border border-green-200">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    This incident was potentially resolved using AI suggestions.
                  </div>
                )}
                <ul className="list-disc list-inside space-y-2 text-sm">
                  {selectedIncident.aiSuggestions.map((suggestion, index) => (
                    <li key={index} className="bg-white p-3 rounded-md shadow-sm border border-gray-200 text-gray-700">{suggestion}</li>
                  ))}
                </ul>
                <div className="mt-3 text-xs text-gray-500">
                  <p>These suggestions are AI-generated. Always verify before applying critical changes.</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2 text-gray-700">Resolution Timeline / Steps</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {selectedIncident.steps.map(step => (
                  <div key={step.id} className="flex items-start p-3 bg-gray-50 rounded-md shadow-sm border border-gray-200">
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

            <div className="mt-6 pt-4 border-t border-gray-300 flex justify-end space-x-3">
              <button 
                onClick={() => alert('Escalate not implemented')} 
                className="px-4 py-2 bg-yellow-500 text-white rounded-md text-sm font-medium hover:bg-yellow-600 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75 shadow-sm"
              >
                Escalate
              </button>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 shadow-sm"
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
