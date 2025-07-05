import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Zap,
  Network,
  GitBranch,
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  PlayCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Database,
  Brain,
  Activity,
  Cpu,
  Eye,
  Target,
  Layers
} from 'lucide-react';

interface Phase {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  isActive: boolean;
  completed?: number;
  total?: number;
  details?: string;
  processingType?: 'edge-function' | 'llm-analysis' | 'backend-processing';
  llmModel?: string;
  estimatedTime?: string;
}

interface SequentialProcessingCardProps {
  repositoryName: string;
  currentPhase: string;
  overallProgress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  phases: {
    documentation?: { status: string; progress: number; completed?: number; total?: number; details?: string };
    vectors?: { status: string; progress: number; completed?: number; total?: number; details?: string };
    lineage?: { status: string; progress: number; completed?: number; total?: number; details?: string };
    dependencies?: { status: string; progress: number; completed?: number; total?: number; details?: string };
    analysis?: { status: string; progress: number; completed?: number; total?: number; details?: string };
  };
  onStart?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const SequentialProcessingCard: React.FC<SequentialProcessingCardProps> = ({
  repositoryName,
  currentPhase,
  overallProgress,
  status,
  phases,
  onStart,
  onCancel,
  className = ''
}) => {
  const [animationKey, setAnimationKey] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Define the 5 phases with enhanced descriptions and processing info
  const phaseDefinitions: Phase[] = [
    {
      id: 'documentation',
      name: 'Documentation Analysis',
      description: 'AI-powered code analysis and documentation generation',
      icon: <FileText className="w-5 h-5" />,
      status: phases.documentation?.status as any || 'pending',
      progress: phases.documentation?.progress || 0,
      isActive: currentPhase === 'documentation' || currentPhase === '1',
      completed: phases.documentation?.completed,
      total: phases.documentation?.total,
      details: phases.documentation?.details || (phases.documentation?.completed ? `${phases.documentation.completed} files analyzed` : undefined),
      processingType: 'edge-function',
      llmModel: 'GPT-4o-mini',
      estimatedTime: '2-5 minutes'
    },
    {
      id: 'vectors',
      name: 'Vector Generation',
      description: 'Creating semantic embeddings for intelligent code search',
      icon: <Zap className="w-5 h-5" />,
      status: phases.vectors?.status as any || 'pending',
      progress: phases.vectors?.progress || 0,
      isActive: currentPhase === 'vectors' || currentPhase === '2',
      completed: phases.vectors?.completed,
      total: phases.vectors?.total,
      details: phases.vectors?.details || (phases.vectors?.completed ? `${phases.vectors.completed} vectors generated` : undefined),
      processingType: 'edge-function',
      llmModel: 'OpenAI Embeddings',
      estimatedTime: '1-3 minutes'
    },
    {
      id: 'lineage',
      name: 'Lineage Extraction',
      description: 'LLM-powered data flow and dependency mapping',
      icon: <Network className="w-5 h-5" />,
      status: phases.lineage?.status as any || 'pending',
      progress: phases.lineage?.progress || 0,
      isActive: currentPhase === 'lineage' || currentPhase === '3',
      completed: phases.lineage?.completed,
      total: phases.lineage?.total,
      details: phases.lineage?.details || (phases.lineage?.completed ? `${phases.lineage.completed} lineage paths traced` : undefined),
      processingType: 'llm-analysis',
      llmModel: 'GPT-4o-mini',
      estimatedTime: '3-7 minutes'
    },
    {
      id: 'dependencies',
      name: 'Dependency Analysis',
      description: 'AI-enhanced cross-file dependency and risk analysis',
      icon: <GitBranch className="w-5 h-5" />,
      status: phases.dependencies?.status as any || 'pending',
      progress: phases.dependencies?.progress || 0,
      isActive: currentPhase === 'dependencies' || currentPhase === '4',
      completed: phases.dependencies?.completed,
      total: phases.dependencies?.total,
      details: phases.dependencies?.details || (phases.dependencies?.completed ? `Dependency analysis completed` : undefined),
      processingType: 'llm-analysis',
      llmModel: 'GPT-4o-mini',
      estimatedTime: '2-4 minutes'
    },
    {
      id: 'analysis',
      name: 'Impact Analysis',
      description: 'Comprehensive business impact and strategic recommendations',
      icon: <BarChart3 className="w-5 h-5" />,
      status: phases.analysis?.status as any || 'pending',
      progress: phases.analysis?.progress || 0,
      isActive: currentPhase === 'analysis' || currentPhase === '5',
      completed: phases.analysis?.completed,
      total: phases.analysis?.total,
      details: phases.analysis?.details || (phases.analysis?.completed ? `Executive insights generated` : undefined),
      processingType: 'llm-analysis',
      llmModel: 'GPT-4o-mini',
      estimatedTime: '3-5 minutes'
    }
  ];

  // Trigger animation when phase changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [currentPhase]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getStatusIcon = (phase: Phase) => {
    switch (phase.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'processing': return 'bg-blue-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getProcessingTypeIcon = (type: string) => {
    switch (type) {
      case 'edge-function': return <Activity className="w-4 h-4" />;
      case 'llm-analysis': return <Brain className="w-4 h-4" />;
      case 'backend-processing': return <Cpu className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getProcessingTypeColor = (type: string) => {
    switch (type) {
      case 'edge-function': return 'text-purple-600 bg-purple-50';
      case 'llm-analysis': return 'text-orange-600 bg-orange-50';
      case 'backend-processing': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const currentActivePhase = phaseDefinitions.find(p => p.isActive);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden ${className}`}
    >
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Brain className="w-8 h-8" />
              {status === 'processing' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold">
                AI-Powered Sequential Processing
              </h3>
              <p className="text-blue-100 mt-1 flex items-center gap-2">
                <Database className="w-4 h-4" />
                {repositoryName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {Math.round(overallProgress)}%
            </div>
            <div className="text-sm text-blue-100">
              Overall Progress
            </div>
          </div>
        </div>
        
        {/* Enhanced Overall Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-blue-100">
              Phase {currentPhase === 'completed' ? '5' : currentPhase || '1'} of 5
            </span>
            <span className="text-sm text-blue-100">
              {currentActivePhase?.estimatedTime && `Est. ${currentActivePhase.estimatedTime}`}
            </span>
          </div>
          <div className="bg-white/20 rounded-full h-3 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-white to-blue-200 rounded-full h-3 relative"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {status === 'processing' && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
              )}
            </motion.div>
          </div>
        </div>

        {/* Current Phase Indicator */}
        {currentActivePhase && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-white/10 rounded-lg backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  {currentActivePhase.icon}
                </div>
                <div>
                  <div className="font-semibold">{currentActivePhase.name}</div>
                  <div className="text-sm text-blue-100">{currentActivePhase.description}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-blue-100">
                  {getProcessingTypeIcon(currentActivePhase.processingType || 'backend-processing')}
                  <span>{currentActivePhase.llmModel}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Enhanced Phase List */}
      <div className="p-6">
        <div className="space-y-4">
          {phaseDefinitions.map((phase, index) => (
            <motion.div
              key={`${phase.id}-${animationKey}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                phase.isActive 
                  ? 'border-blue-200 bg-blue-50 shadow-lg' 
                  : phase.status === 'completed'
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Phase Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    phase.status === 'completed' 
                      ? 'bg-green-100 text-green-600'
                      : phase.isActive 
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {phase.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProcessingTypeColor(phase.processingType || 'backend-processing')}`}>
                        {getProcessingTypeIcon(phase.processingType || 'backend-processing')}
                        <span className="ml-1">{phase.llmModel}</span>
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{phase.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(phase)}
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(phase.status)}`}>
                    {phase.status}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">
                    {phase.details || `${phase.progress}% complete`}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {phase.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className={`h-2 rounded-full ${getProgressBarColor(phase.status)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${phase.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* File Count (if available) */}
              {phase.total && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>
                    {phase.id === 'lineage' ? 'SQL files processed: ' : 
                     phase.id === 'dependencies' ? (phase.total && phase.total > 10 ? 'Dependency chunks: ' : 'Dependency analysis: ') :
                     phase.id === 'analysis' ? (phase.total && phase.total > 10 ? 'Analysis chunks: ' : 'Impact analysis: ') :
                     'Files processed: '}
                    {phase.completed || 0} / {phase.total}
                    {phase.id === 'lineage' && (
                      <span className="ml-1 text-xs text-blue-600">(SQL only)</span>
                    )}
                    {phase.id === 'dependencies' && (
                      <span className="ml-1 text-xs text-green-600">
                        {phase.total && phase.total > 10 ? '(Chunked)' : '(Comprehensive)'}
                      </span>
                    )}
                    {phase.id === 'analysis' && (
                      <span className="ml-1 text-xs text-purple-600">
                        {phase.total && phase.total > 10 ? '(Chunked)' : '(Impact Report)'}
                      </span>
                    )}
                  </span>
                  <span>Est. time: {phase.estimatedTime}</span>
                </div>
              )}

              {/* Active Processing Indicator */}
              {phase.isActive && phase.status === 'processing' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-2 right-2"
                >
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-between items-center">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          
          <div className="flex space-x-3">
            {status === 'pending' && onStart && (
              <button
                onClick={onStart}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <PlayCircle className="w-5 h-5" />
                Start Processing
              </button>
            )}
            
            {status === 'processing' && onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <AlertTriangle className="w-5 h-5" />
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Details Section */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-4 bg-gray-50 rounded-lg"
            >
              <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Processing Architecture
              </h5>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h6 className="font-medium text-gray-700 mb-2">Edge Function Processing</h6>
                    <ul className="space-y-1 text-gray-600">
                      <li>• Phase 1: Documentation Analysis</li>
                      <li>• Phase 2: Vector Generation</li>
                    </ul>
                  </div>
                  <div>
                    <h6 className="font-medium text-gray-700 mb-2">LLM-Enhanced Analysis</h6>
                    <ul className="space-y-1 text-gray-600">
                      <li>• Phase 3: Lineage Extraction</li>
                      <li>• Phase 4: Dependency Analysis</li>
                      <li>• Phase 5: Impact Analysis</li>
                    </ul>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-gray-600">
                    <strong>Data Flow:</strong> Each phase builds upon the previous phase's data, 
                    ensuring comprehensive analysis and intelligent insights generation.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}; 