import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  GitFork,
  Star,
  Lock,
  CheckCircle,
  Loader2,
  Wand,
  Clock,
  AlertCircle,
  GitBranch,
  Calendar,
  GitCommit,
  Eye,
  Shield,
  Network,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  BarChart3,
  TrendingUp,
  Zap,
  FileText,
  Brain
} from 'lucide-react';
import { SequentialProcessingCard } from './SequentialProcessingCard';
import { useProcessingStatus } from '../context/ProcessingStatusContext';
import { sequentialProcessingService } from '../services/sequential-processing.service';
import { supabase } from '../config/supabaseClient';

interface ModernRepositoryCardProps {
  repo: any;
  summaryStatus?: { hasSummaries: boolean; summaryCount: number; lastSummaryDate?: string };
  repoStatus?: any;
  isProcessing: boolean;
  isQueued: boolean;
  isGeneratingSummary: boolean;
  brandColor: string;
  onRepoClick: (repo: any) => void;
  onAnalyze: () => void;
  onStatusCheck: () => void;
}

export const ModernRepositoryCard: React.FC<ModernRepositoryCardProps> = ({
  repo,
  summaryStatus,
  repoStatus,
  isProcessing,
  isQueued,
  isGeneratingSummary,
  brandColor,
  onRepoClick,
  onAnalyze,
  onStatusCheck,
}) => {
  const navigate = useNavigate();
  const { processingStatuses } = useProcessingStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [sequentialStatus, setSequentialStatus] = useState<any>(null);
  const [isLoadingSequential, setIsLoadingSequential] = useState(false);
  
  const isAnalyzing = isProcessing || isQueued || isGeneratingSummary;
  const hasDocumentation = summaryStatus?.hasSummaries;
  const processingStatus = processingStatuses[repo.full_name];

  // Check for sequential processing status
  useEffect(() => {
    if (repoStatus?.sequentialStatus) {
      setSequentialStatus({
        status: repoStatus.sequentialStatus,
        currentPhase: repoStatus.sequentialCurrentPhase || 'documentation',
        overallProgress: calculateOverallProgress(repoStatus.sequentialPhases),
        phases: repoStatus.sequentialPhases || {}
      });
    }
  }, [repoStatus]);

  const calculateOverallProgress = (phases: any) => {
    if (!phases) return 0;
    const phaseList = ['documentation', 'vectors', 'lineage', 'dependencies', 'analysis'];
    const totalProgress = phaseList.reduce((sum, phase) => {
      return sum + (phases[phase]?.progress || 0);
    }, 0);
    return Math.round(totalProgress / phaseList.length);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const getStatusBadge = () => {
    if (sequentialStatus?.status === 'completed') {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
        >
          <CheckCircle className="w-3 h-3" />
          Complete
        </motion.div>
      );
    }
    
    if (sequentialStatus?.status === 'processing') {
      return (
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          Phase {getPhaseNumber(sequentialStatus.currentPhase)}/5
        </motion.div>
      );
    }

    if (isAnalyzing) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
          <Clock className="w-3 h-3" />
          Processing
        </div>
      );
    }

    if (hasDocumentation) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Analyzed
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
        <Clock className="w-3 h-3" />
        Ready
      </div>
    );
  };

  const getPhaseNumber = (phase: string) => {
    const phaseMap: { [key: string]: number } = {
      'documentation': 1, '1': 1,
      'vectors': 2, '2': 2,
      'lineage': 3, '3': 3,
      'dependencies': 4, '4': 4,
      'analysis': 5, '5': 5
    };
    return phaseMap[phase] || 1;
  };

  const handleStartSequentialProcessing = async () => {
    try {
      setIsLoadingSequential(true);
      
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session found. Please log in again.');
      }

      // Navigate to analysis setup page with the correct route
      const [owner, repoName] = repo.full_name.split('/');
      navigate(`/dashboard/code/analyze/${owner}/${repoName}`);
      
    } catch (error) {
      console.error('Error starting sequential processing:', error);
    } finally {
      setIsLoadingSequential(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300"
    >
      {/* Main Repository Card */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <motion.h3 
                className="text-lg font-bold text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => onRepoClick(repo)}
                whileHover={{ scale: 1.02 }}
              >
                {repo.name}
              </motion.h3>
              {repo.private && <Lock className="w-4 h-4 text-gray-400" />}
              {getStatusBadge()}
            </div>
            
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {repo.description || 'No description available'}
            </p>

            {/* Repository Stats */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {repo.stargazers_count?.toLocaleString() || 0}
              </div>
              <div className="flex items-center gap-1">
                <GitFork className="w-3 h-3" />
                {repo.forks_count?.toLocaleString() || 0}
              </div>
              <div className="flex items-center gap-1">
                <GitCommit className="w-3 h-3" />
                {formatDate(repo.updated_at)}
              </div>
              {repo.language && (
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: brandColor }}
                  />
                  {repo.language}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Progress Overview */}
        {sequentialStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Sequential Processing</span>
              <span className="text-sm font-bold text-blue-600">
                {sequentialStatus.overallProgress}%
              </span>
            </div>
            <div className="bg-white/50 rounded-full h-2 mb-2">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-full h-2"
                initial={{ width: 0 }}
                animate={{ width: `${sequentialStatus.overallProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Phase {getPhaseNumber(sequentialStatus.currentPhase)}/5</span>
              <span className="capitalize">{sequentialStatus.currentPhase}</span>
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {sequentialStatus?.status === 'processing' ? (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <BarChart3 className="w-4 h-4" />
              View Progress
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </motion.button>
          ) : sequentialStatus?.status === 'completed' ? (
            <motion.button
              onClick={() => {
                const [owner, repoName] = repo.full_name.split('/');
                navigate(`/dashboard/code/results/${owner}/${repoName}`);
              }}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Eye className="w-4 h-4" />
              View Results
            </motion.button>
          ) : isAnalyzing ? (
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                const [owner, repoName] = repo.full_name.split('/');
                navigate(`/dashboard/code/status/${owner}/${repoName}`);
              }}
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Clock className="w-4 h-4" />
              View Status
            </motion.button>
          ) : (
            <motion.button
              onClick={handleStartSequentialProcessing}
              disabled={isLoadingSequential}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoadingSequential ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              Analyze Repository
            </motion.button>
          )}

          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="px-3 py-2 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </motion.button>
        </div>
      </div>

      {/* Expanded Sequential Processing View */}
      <AnimatePresence>
        {isExpanded && sequentialStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-gray-100"
          >
            <div className="p-6">
              <SequentialProcessingCard
                repositoryName={repo.full_name}
                currentPhase={sequentialStatus.currentPhase}
                overallProgress={sequentialStatus.overallProgress}
                status={sequentialStatus.status}
                phases={sequentialStatus.phases}
                onStart={sequentialStatus.status === 'pending' ? handleStartSequentialProcessing : undefined}
                className="shadow-none border-0"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}; 