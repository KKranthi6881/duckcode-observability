import { useState, useEffect } from 'react';
import { Search, Target, X } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  type: string;
  upstreamCount: number;
  downstreamCount: number;
}

interface ModelSelectorProps {
  connectionId: string;
  onModelSelect: (modelId: string, modelName: string) => void;
  selectedModel?: string;
}

export default function ModelSelector({ connectionId, onModelSelect, selectedModel }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && models.length === 0) {
      fetchModels();
    }
  }, [isOpen]);

  const fetchModels = async () => {
    setLoading(true);
    try {
      // Fetch all models from the connection
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/metadata/lineage/model/${connectionId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const modelList = data.nodes.map((node: any) => ({
          id: node.id,
          name: node.name,
          type: node.type,
          upstreamCount: node.stats?.upstreamCount || 0,
          downstreamCount: node.stats?.downstreamCount || 0
        }));
        setModels(modelList);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedModelData = models.find(m => m.id === selectedModel);

  return (
    <div className="relative">
      {/* Selected Model Display / Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-colors min-w-[280px]"
      >
        <Target className="w-5 h-5 text-blue-600" />
        <div className="flex-1 text-left">
          {selectedModelData ? (
            <>
              <div className="text-sm font-semibold text-gray-900">
                {selectedModelData.name}
              </div>
              <div className="text-xs text-gray-500">
                ↑{selectedModelData.upstreamCount} upstream · ↓{selectedModelData.downstreamCount} downstream
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-600">
              Select a model to explore lineage
            </div>
          )}
        </div>
        <div className="text-xs text-blue-600 font-medium">Change</div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border-2 border-blue-200 z-30 max-h-[500px] flex flex-col">
            {/* Search Header */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search models..."
                  className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {filteredModels.length} models available
              </div>
            </div>

            {/* Model List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading models...
                </div>
              ) : filteredModels.length > 0 ? (
                <div className="p-2">
                  {filteredModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        onModelSelect(model.id, model.name);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`w-full p-3 rounded-lg text-left hover:bg-blue-50 transition-colors mb-1 ${
                        model.id === selectedModel ? 'bg-blue-100 border-2 border-blue-400' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900">
                            {model.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 capitalize">
                            {model.type}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-3">
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                            ↑{model.upstreamCount}
                          </span>
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                            ↓{model.downstreamCount}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No models found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
