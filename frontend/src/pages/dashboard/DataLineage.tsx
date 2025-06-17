import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, Database, Shield, GitBranch, Network, BarChart, Table, LineChart, GitFork, AlertTriangle } from 'lucide-react';

// Error boundary component to catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("LineageGraph Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 rounded-lg border border-red-200 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Unable to render lineage graph</h3>
          <p className="text-sm text-red-600">There was an error loading the visualization component. Please check the console for details.</p>
          <button 
            className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Sample placeholder data 
const lineageModels = [
  {
    id: 'customer',
    name: 'Customer Data',
    description: 'End-to-end customer data flow from source to dimension table',
    lastUpdated: 'Jul 20, 2023, 09:15 AM',
    tables: 9,
    relationships: 12
  },
  {
    id: 'order',
    name: 'Order Processing',
    description: 'Order processing flow including fact tables and calculated metrics',
    lastUpdated: 'Jul 20, 2023, 11:30 AM',
    tables: 11,
    relationships: 15
  }
];

const placeholderTables = {
  'customer': [
    { id: 'tpch_customers', name: 'tpch_customers', type: 'source', description: 'Source customers data from TPCH', columns: 9, relationships: 3 },
    { id: 'stg_tpch_customers', name: 'stg_tpch_customers', type: 'staging', description: 'Cleaned and transformed customer data', columns: 10, relationships: 2 },
    { id: 'dim_customers', name: 'dim_customers', type: 'mart', description: 'Customer dimension table', columns: 12, relationships: 3 }
  ],
  'order': [
    { id: 'tpch_orders', name: 'tpch_orders', type: 'source', description: 'Source orders data from TPCH', columns: 9, relationships: 3 },
    { id: 'stg_tpch_orders', name: 'stg_tpch_orders', type: 'staging', description: 'Cleaned and transformed orders data', columns: 10, relationships: 3 },
    { id: 'fct_orders', name: 'fct_orders', type: 'mart', description: 'Order fact table', columns: 12, relationships: 3 }
  ]
};

export function DataLineage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModel, setSelectedModel] = useState('customer');
  const [selectedViewType, setSelectedViewType] = useState('table');
  const [loadVisualizer, setLoadVisualizer] = useState(false);
  
  // Lazy load the LineageGraph component to avoid rendering issues
  const LazyLineageGraph = React.lazy(() => import('./components/charts/LineageGraph').catch(() => ({
    default: () => (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center p-8">
          <Network className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">Lineage Visualization</h3>
          <p className="text-sm text-gray-400 mt-2">Visualization component could not be loaded</p>
        </div>
      </div>
    )
  })));

  // Get filtered tables
  const getFilteredTables = () => {
    if (!placeholderTables[selectedModel]) return [];
    
    return placeholderTables[selectedModel].filter(table => 
      table.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      table.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Load visualizer only after initial render to prevent white screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadVisualizer(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6 bg-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Data Lineage</h1>
        <div className="flex space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search tables..."
              className="pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-md text-gray-800 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 bg-gray-100 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-200">
            <Filter className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Model selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {lineageModels.map(model => (
          <button
            key={model.id}
            className={`p-4 rounded-lg border ${
              selectedModel === model.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
            onClick={() => setSelectedModel(model.id)}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-md font-medium text-gray-800">{model.name}</h3>
              <div className="px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
                {model.tables} tables
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">{model.description}</p>
            <div className="text-xs text-gray-500">
              Updated: {model.lastUpdated}
            </div>
          </button>
        ))}
      </div>

      {/* View type selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { id: 'table', name: 'Table Lineage', icon: <Table className="h-5 w-5 text-blue-500" />, description: 'Table-level data flow' },
          { id: 'column', name: 'Column Lineage', icon: <LineChart className="h-5 w-5 text-green-500" />, description: 'Column-level lineage' },
          { id: 'impact', name: 'Impact Analysis', icon: <GitFork className="h-5 w-5 text-purple-500" />, description: 'Change impact analysis' },
          { id: 'deps', name: 'Dependencies', icon: <BarChart className="h-5 w-5 text-orange-500" />, description: 'Dependency explorer' }
        ].map(viewType => (
          <button
            key={viewType.id}
            className={`p-4 rounded-lg border ${
              selectedViewType === viewType.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
            onClick={() => setSelectedViewType(viewType.id)}
          >
            <div className="flex items-center justify-center mb-2">
              {viewType.icon}
            </div>
            <h3 className="text-sm font-medium text-gray-800 text-center mb-1">{viewType.name}</h3>
            <p className="text-xs text-gray-500 text-center">{viewType.description}</p>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tables panel */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-800">Tables</h2>
            <p className="text-sm text-gray-500">{lineageModels.find(m => m.id === selectedModel)?.description}</p>
          </div>
          
          <div className="p-2">
            {getFilteredTables().map(table => (
              <Link
                key={table.id}
                to={`/dashboard/lineage/table/${table.id}`}
                className="block p-3 mb-2 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      table.type === 'source' ? 'bg-blue-500' :
                      table.type === 'staging' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <span className="font-medium text-gray-800">{table.name}</span>
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {table.type}
                  </div>
                </div>
                <p className="text-xs text-gray-600 truncate">{table.description}</p>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>{table.columns} columns</span>
                  <span>{table.relationships} relationships</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Lineage graph panel */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-800">
                {selectedModel === 'customer' ? 'Customer Data Lineage' : 'Order Processing Lineage'}
              </h2>
            </div>
            
            {/* Lineage graph with error boundary */}
            <div className="h-[500px] bg-gray-50 rounded-b-lg">
              <ErrorBoundary>
                {loadVisualizer ? (
                  <React.Suspense fallback={
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-3 text-sm text-gray-500">Loading visualization...</p>
                      </div>
                    </div>
                  }>
                    <LazyLineageGraph />
                  </React.Suspense>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-3 text-sm text-gray-500">Initializing...</p>
                    </div>
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>
          
          {/* Lineage explanation panel */}
          <div className="mt-6 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h3 className="text-md font-medium text-gray-800 mb-3">Understanding Data Lineage</h3>
            <p className="text-sm text-gray-600 mb-4">
              Data lineage visualizes the flow of data from source systems through transformations to final consumption.
              It helps track data origin, what happens to it, and where it moves over time.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center mb-2">
                  <Database className="h-4 w-4 text-blue-500 mr-2" />
                  <h4 className="text-sm font-medium text-blue-700">Source Tables</h4>
                </div>
                <p className="text-xs text-blue-600">Raw data imported from source systems before any transformations.</p>
              </div>
              
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center mb-2">
                  <GitBranch className="h-4 w-4 text-yellow-500 mr-2" />
                  <h4 className="text-sm font-medium text-yellow-700">Staging Tables</h4>
                </div>
                <p className="text-xs text-yellow-600">Intermediate tables with cleaned and transformed data ready for modeling.</p>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center mb-2">
                  <Table className="h-4 w-4 text-green-500 mr-2" />
                  <h4 className="text-sm font-medium text-green-700">Mart Tables</h4>
                </div>
                <p className="text-xs text-green-600">Final dimension and fact tables optimized for analytics and reporting.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}