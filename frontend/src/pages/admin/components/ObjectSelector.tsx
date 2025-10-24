/**
 * ObjectSelector Component
 * Allows admins to select metadata objects for documentation generation
 */

import { useState, useEffect } from 'react';
import { Search, Database, Table, FileCode, Check, FolderTree, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { supabase } from '../../../config/supabaseClient';

interface MetadataObject {
  id: string;
  name: string;
  object_type: string;
  schema_name: string;
  has_documentation: boolean;
  row_count?: number;
  file_path?: string;
}

interface ObjectSelectorProps {
  organizationId: string;
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onViewDocumentation?: (objectId: string, objectName: string) => void;
}

export function ObjectSelector({ organizationId, selectedIds, onSelectionChange, onViewDocumentation }: ObjectSelectorProps) {
  const [objects, setObjects] = useState<MetadataObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDocStatus, setFilterDocStatus] = useState<string>('all');
  const [filterSchema, setFilterSchema] = useState<string>('all');
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minRowCount, setMinRowCount] = useState<number>(0);

  useEffect(() => {
    fetchObjects();
  }, [organizationId]);

  const fetchObjects = async () => {
    try {
      setLoading(true);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No auth token found');
        setObjects([]);
        return;
      }

      // Fetch objects from API endpoint (not direct database access)
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${API_URL}/api/metadata-objects/organizations/${organizationId}/objects`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setObjects(data.objects || []);
    } catch (error) {
      console.error('Error fetching objects:', error);
      setObjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique schemas and folders from objects
  const schemas = Array.from(new Set(objects.map(o => o.schema_name).filter(Boolean)));
  const folders = Array.from(new Set(
    objects
      .map(o => o.file_path ? o.file_path.split('/').slice(0, -1).join('/') : null)
      .filter((f): f is string => f !== null)
  ));

  const filteredObjects = objects.filter(obj => {
    // Search filter
    const matchesSearch = obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         obj.schema_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         obj.file_path?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Type filter
    const matchesType = filterType === 'all' || obj.object_type === filterType;
    
    // Documentation status filter
    const matchesDocStatus = filterDocStatus === 'all' ||
                            (filterDocStatus === 'documented' && obj.has_documentation) ||
                            (filterDocStatus === 'undocumented' && !obj.has_documentation);

    // Schema filter
    const matchesSchema = filterSchema === 'all' || obj.schema_name === filterSchema;

    // Folder filter
    const matchesFolder = filterFolder === 'all' || 
                         (obj.file_path && obj.file_path.startsWith(filterFolder + '/'));

    // Row count filter (only for important/large tables)
    const matchesRowCount = !minRowCount || (obj.row_count && obj.row_count >= minRowCount);

    return matchesSearch && matchesType && matchesDocStatus && matchesSchema && matchesFolder && matchesRowCount;
  });

  // Selection limits
  const BATCH_LIMIT = 50;
  const canSelectMore = selectedIds.length < BATCH_LIMIT;

  const handleSelectAll = () => {
    if (selectedIds.length === filteredObjects.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filteredObjects.map(obj => obj.id));
    }
  };

  const handleToggle = (objectId: string) => {
    if (selectedIds.includes(objectId)) {
      // Always allow deselection
      onSelectionChange(selectedIds.filter(id => id !== objectId));
    } else {
      // Check batch limit before adding
      if (selectedIds.length >= BATCH_LIMIT) {
        alert(`Batch limit reached! Please process current batch (${BATCH_LIMIT} max) before selecting more objects.`);
        return;
      }
      onSelectionChange([...selectedIds, objectId]);
    }
  };

  const getObjectIcon = (type: string) => {
    switch (type) {
      case 'table': return Table;
      case 'view': return Database;
      case 'model': return FileCode;
      default: return Database;
    }
  };

  const objectTypes = Array.from(new Set(objects.map(o => o.object_type)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AB7A9]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search objects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent"
          />
        </div>

        {/* Basic Filters Row 1 */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm"
          >
            <option value="all">All Types</option>
            {objectTypes.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}s
              </option>
            ))}
          </select>

          <select
            value={filterDocStatus}
            onChange={(e) => setFilterDocStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm"
          >
            <option value="all">All Status</option>
            <option value="documented">Documented</option>
            <option value="undocumented">Undocumented</option>
          </select>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#2AB7A9] transition-colors"
        >
          {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>Advanced Filters</span>
          <span className="text-xs text-gray-500">
            (schema, folder, size)
          </span>
        </button>

        {/* Advanced Filters Row 2 */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            {/* Schema Filter */}
            <select
              value={filterSchema}
              onChange={(e) => setFilterSchema(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm bg-white"
            >
              <option value="all">All Schemas</option>
              {schemas.map(schema => (
                <option key={schema} value={schema}>{schema}</option>
              ))}
            </select>

            {/* Folder Filter */}
            {folders.length > 0 && (
              <select
                value={filterFolder}
                onChange={(e) => setFilterFolder(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm bg-white"
              >
                <option value="all">All Folders</option>
                {folders.sort().map(folder => (
                  <option key={folder} value={folder}>
                    <FolderTree className="inline h-3 w-3 mr-1" />
                    {folder}
                  </option>
                ))}
              </select>
            )}

            {/* Row Count Filter */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Minimum Row Count (focus on large/important tables)
              </label>
              <input
                type="number"
                value={minRowCount}
                onChange={(e) => setMinRowCount(Number(e.target.value))}
                placeholder="e.g., 1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm"
              />
            </div>
          </div>
        )}

        {/* Batch Limit Warning */}
        {selectedIds.length >= BATCH_LIMIT && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">Batch Limit Reached</p>
                <p className="text-xs text-yellow-700 mt-1">
                  You've selected {selectedIds.length} objects. For optimal performance, we recommend processing up to {BATCH_LIMIT} objects at a time.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Select All */}
        <div className="flex items-center justify-between py-2 border-b border-gray-200">
          <button
            onClick={handleSelectAll}
            className="text-sm text-[#2AB7A9] hover:text-[#238F85] font-medium"
          >
            {selectedIds.length === filteredObjects.length ? 'Deselect All' : 'Select All Filtered'}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {selectedIds.length} of {filteredObjects.length} selected
            </span>
            {selectedIds.length > 0 && (
              <span className={`text-xs px-2 py-1 rounded ${
                selectedIds.length > BATCH_LIMIT 
                  ? 'bg-red-100 text-red-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {selectedIds.length > BATCH_LIMIT ? 'Over limit' : 'Within limit'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Objects List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredObjects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No objects found</p>
          </div>
        ) : (
          filteredObjects.map((obj) => {
            const Icon = getObjectIcon(obj.object_type);
            const isSelected = selectedIds.includes(obj.id);

            return (
              <div
                key={obj.id}
                onClick={() => handleToggle(obj.id)}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected 
                    ? 'border-[#2AB7A9] bg-[#2AB7A9]/5' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                {/* Checkbox */}
                <div className={`
                  flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center
                  ${isSelected ? 'bg-[#2AB7A9] border-[#2AB7A9]' : 'border-gray-300'}
                `}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>

                {/* Icon */}
                <div className="flex-shrink-0">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {obj.name}
                    </p>
                    {obj.has_documentation && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Documented
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {obj.schema_name} · {obj.object_type}
                    {obj.row_count && ` · ${obj.row_count.toLocaleString()} rows`}
                  </p>
                </div>

                {/* View Button for documented objects */}
                {obj.has_documentation && onViewDocumentation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDocumentation(obj.id, obj.name);
                    }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-[#2AB7A9] hover:bg-[#2AB7A9] hover:text-white border border-[#2AB7A9] rounded transition-colors"
                  >
                    View
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
