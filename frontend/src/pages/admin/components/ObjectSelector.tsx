/**
 * ObjectSelector Component
 * Allows admins to select metadata objects for documentation generation
 */

import { useState, useEffect } from 'react';
import { Search, Database, Table, FileCode, Check, AlertCircle } from 'lucide-react';
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
  const [filterSchema, setFilterSchema] = useState<string>('all');

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

  // Extract unique schemas from objects
  const schemas = Array.from(new Set(objects.map(o => o.schema_name).filter(Boolean))).sort();

  const filteredObjects = objects.filter(obj => {
    // Search filter
    const matchesSearch = obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         obj.schema_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Schema filter
    const matchesSchema = filterSchema === 'all' || obj.schema_name === filterSchema;

    return matchesSearch && matchesSchema;
  });

  // Selection limits
  const BATCH_LIMIT = 50;

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


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AB7A9]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Schema Filter */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search objects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-[#2AB7A9] transition-all text-sm"
          />
        </div>

        {/* Schema Dropdown - Simple and Clean */}
        {schemas.length > 0 && (
          <select
            value={filterSchema}
            onChange={(e) => setFilterSchema(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-[#2AB7A9] transition-all text-sm font-medium text-gray-700"
          >
            <option value="all">All Schemas</option>
            {schemas.map(schema => (
              <option key={schema} value={schema}>{schema}</option>
            ))}
          </select>
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

        {/* Selection Summary */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={handleSelectAll}
            className="text-sm text-[#2AB7A9] hover:text-[#238F85] font-medium transition-colors"
          >
            {selectedIds.length === filteredObjects.length && filteredObjects.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm font-medium text-gray-700">
            {selectedIds.length} of {filteredObjects.length} selected
          </span>
        </div>
      </div>

      {/* Objects List */}
      <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
        {filteredObjects.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No objects found</p>
            <p className="text-xs mt-1">Try adjusting your search or filters</p>
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
                  group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  ${isSelected 
                    ? 'border-[#2AB7A9] bg-[#2AB7A9]/5 shadow-sm' 
                    : 'border-gray-200 hover:border-[#2AB7A9]/50 hover:shadow-sm'
                  }
                `}
              >
                {/* Checkbox */}
                <div className={`
                  flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                  ${isSelected ? 'bg-[#2AB7A9] border-[#2AB7A9]' : 'border-gray-300 group-hover:border-[#2AB7A9]/50'}
                `}>
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>

                {/* Icon */}
                <div className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                  isSelected ? 'bg-[#2AB7A9]/10' : 'bg-gray-100 group-hover:bg-[#2AB7A9]/10'
                }`}>
                  <Icon className={`h-4 w-4 ${
                    isSelected ? 'text-[#2AB7A9]' : 'text-gray-600 group-hover:text-[#2AB7A9]'
                  }`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {obj.name}
                    </p>
                    {obj.has_documentation && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {obj.schema_name} · {obj.object_type}
                  </p>
                </div>

                {/* View Button for documented objects */}
                {obj.has_documentation && onViewDocumentation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDocumentation(obj.id, obj.name);
                    }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-[#2AB7A9] hover:bg-[#2AB7A9] hover:text-white border border-[#2AB7A9] rounded-lg transition-all"
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
