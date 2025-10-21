import { useState } from 'react';
import { Filter, ChevronDown } from 'lucide-react';

interface LineageFiltersProps {
  onFilterChange: (filters: FilterOptions) => void;
  totalNodes: number;
  filteredNodes: number;
}

export interface FilterOptions {
  confidenceThreshold: number;
  modelTypes: string[];
  showOnlyConnected: boolean;
  maxDepth: number;
}

const MODEL_TYPES = ['model', 'source', 'seed', 'snapshot', 'test'];

export default function LineageFilters({ onFilterChange, totalNodes, filteredNodes }: LineageFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    confidenceThreshold: 0,
    modelTypes: [],
    showOnlyConnected: false,
    maxDepth: 0 // 0 means no limit
  });

  const updateFilters = (newFilters: Partial<FilterOptions>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange(updated);
  };

  const resetFilters = () => {
    const reset = {
      confidenceThreshold: 0,
      modelTypes: [],
      showOnlyConnected: false,
      maxDepth: 0
    };
    setFilters(reset);
    onFilterChange(reset);
  };

  const hasActiveFilters = filters.confidenceThreshold > 0 || 
    filters.modelTypes.length > 0 || 
    filters.showOnlyConnected ||
    filters.maxDepth > 0;

  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
          hasActiveFilters
            ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Filter className="w-4 h-4" />
        Filters
        {hasActiveFilters && (
          <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
            {[
              filters.confidenceThreshold > 0 ? 1 : 0,
              filters.modelTypes.length,
              filters.showOnlyConnected ? 1 : 0,
              filters.maxDepth > 0 ? 1 : 0
            ].reduce((a, b) => a + b, 0)}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-20 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Filter Lineage</h3>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Reset all
                </button>
              )}
            </div>

            {/* Results Summary */}
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredNodes}</span> of{' '}
                <span className="font-semibold text-gray-900">{totalNodes}</span> models
              </div>
            </div>

            {/* Confidence Threshold */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Minimum Confidence
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.confidenceThreshold}
                  onChange={(e) => updateFilters({ confidenceThreshold: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">0%</span>
                  <span className="font-semibold text-blue-600">{filters.confidenceThreshold}%</span>
                  <span className="text-gray-500">100%</span>
                </div>
              </div>
            </div>

            {/* Model Types */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Model Types
              </label>
              <div className="space-y-2">
                {MODEL_TYPES.map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.modelTypes.includes(type)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...filters.modelTypes, type]
                          : filters.modelTypes.filter(t => t !== type);
                        updateFilters({ modelTypes: newTypes });
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-xs text-gray-700 capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Max Depth */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Max Lineage Depth
              </label>
              <select
                value={filters.maxDepth}
                onChange={(e) => updateFilters({ maxDepth: parseInt(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">No limit</option>
                <option value="1">1 level</option>
                <option value="2">2 levels</option>
                <option value="3">3 levels</option>
                <option value="4">4 levels</option>
                <option value="5">5 levels</option>
              </select>
            </div>

            {/* Show Only Connected */}
            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-medium text-gray-700">
                  Show only connected models
                </span>
                <input
                  type="checkbox"
                  checked={filters.showOnlyConnected}
                  onChange={(e) => updateFilters({ showOnlyConnected: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Hide models without any lineage connections
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
