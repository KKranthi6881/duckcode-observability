import React from 'react';
import { Network, Brain, Sparkles } from 'lucide-react';

interface KnowledgeGraphViewerProps {
  filePath: string;
}

export const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({ filePath }) => {
  return (
    <div className="p-8 text-center bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Network className="h-12 w-12 text-purple-600" />
            <Brain className="h-6 w-6 text-pink-500 absolute -top-1 -right-1" />
            <Sparkles className="h-4 w-4 text-yellow-500 absolute -bottom-1 -left-1" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Knowledge Graph</h3>
        <p className="text-gray-600 mb-6">
          Explore the semantic relationships and knowledge network for <strong>{filePath}</strong>. 
          Discover connections between concepts, entities, and business logic.
        </p>
        <div className="bg-white rounded-lg p-6 border border-purple-100 mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Planned Features:</h4>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            <li>• Interactive knowledge network</li>
            <li>• Entity relationship mapping</li>
            <li>• Concept clustering</li>
            <li>• Semantic search</li>
            <li>• Business rule connections</li>
            <li>• AI-powered insights</li>
          </ul>
        </div>
        <div className="text-sm text-purple-600 font-medium">
          🧠 AI-Powered Knowledge Graph Coming Soon
        </div>
      </div>
    </div>
  );
}; 