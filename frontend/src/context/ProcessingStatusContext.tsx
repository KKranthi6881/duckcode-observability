import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getProcessingStatus } from '../services/githubService';

interface ProcessingStatus {
  progress: number;
  totalFiles: number;
  completed: number;
  failed: number;
  pending: number;
  detailedStatus?: any[];
  isPolling: boolean;
  lastUpdated: string;
  startedAt: string;
  completedAt?: string;
  // New comprehensive status fields
  overallProgress?: number;
  overallCompleted?: number;
  documentation?: {
    completed: number;
    failed: number;
    pending: number;
    progress: number;
  };
  vectors?: {
    completed: number;
    failed: number;
    pending: number;
    progress: number;
  };
  lineage?: {
    completed: number;
    failed: number;
    pending: number;
    progress: number;
    eligible?: number;
  } | null;
}

interface ProcessingStatusContextType {
  processingStatuses: Record<string, ProcessingStatus>;
  startProcessing: (repoFullName: string) => void;
  stopProcessing: (repoFullName: string) => void;
  getStatus: (repoFullName: string) => ProcessingStatus | null;
  clearStatus: (repoFullName: string) => void;
  clearAllStatuses: () => void;
}

const ProcessingStatusContext = createContext<ProcessingStatusContextType | undefined>(undefined);

const STORAGE_KEY = 'duckcode-processing-status';
const POLL_INTERVAL = 2000; // 2 seconds

export const ProcessingStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [processingStatuses, setProcessingStatuses] = useState<Record<string, ProcessingStatus>>({});
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Persist statuses to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(processingStatuses));
  }, [processingStatuses]);

  // Load persisted statuses from localStorage on mount
  useEffect(() => {
    console.log('ProcessingStatusContext: Loading persisted statuses from localStorage');
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('ProcessingStatusContext: Loaded statuses:', parsed);
        setProcessingStatuses(parsed);
        
        // Resume polling for any incomplete processes
        Object.entries(parsed).forEach(([repoFullName, status]) => {
          const typedStatus = status as ProcessingStatus;
          if (typedStatus.isPolling && typedStatus.progress < 100) {
            console.log(`Resuming polling for ${repoFullName}`);
            setTimeout(() => startPollingInternal(repoFullName), 1000);
          }
        });
      } catch (error) {
        console.error('Error loading processing statuses:', error);
      }
    } else {
      console.log('ProcessingStatusContext: No persisted statuses found');
    }
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach(interval => clearInterval(interval));
    };
  }, []);

  const startPollingInternal = (repoFullName: string) => {
    console.log(`Starting internal polling for ${repoFullName}`);
    
    // Clear any existing interval
    if (intervalsRef.current[repoFullName]) {
      clearInterval(intervalsRef.current[repoFullName]);
    }

    let pollCount = 0;

    const pollStatus = async () => {
      try {
        pollCount++;
        console.log(`Polling ${repoFullName} (attempt #${pollCount})`);
        
        const status = await getProcessingStatus(repoFullName);
        console.log(`Status received for ${repoFullName}:`, status);
        
        setProcessingStatuses(prev => {
          const updated = {
            ...prev,
            [repoFullName]: {
              ...prev[repoFullName],
              // Legacy fields for backward compatibility
              progress: status.progress || status.overallProgress || 0,
              totalFiles: status.totalFiles || 0,
              completed: status.completed || status.overallCompleted || 0,
              failed: status.failed || 0,
              pending: status.pending || 0,
              detailedStatus: status.detailedStatus || [],
              // New comprehensive fields
              overallProgress: status.overallProgress,
              overallCompleted: status.overallCompleted,
              documentation: status.documentation,
              vectors: status.vectors,
              lineage: status.lineage,
              // Metadata
              lastUpdated: new Date().toISOString(),
              isPolling: true
            }
          };
          console.log(`Updated status for ${repoFullName}:`, updated[repoFullName]);
          return updated;
        });

        // Check if processing is complete
        const isComplete = status.progress >= 100 || (status.totalFiles > 0 && status.pending === 0);
        if (isComplete) {
          console.log(`Processing complete for ${repoFullName}. Stopping polling.`);
          
          // Clear interval
          if (intervalsRef.current[repoFullName]) {
            clearInterval(intervalsRef.current[repoFullName]);
            delete intervalsRef.current[repoFullName];
          }
          
          // Mark as completed
          setProcessingStatuses(prev => ({
            ...prev,
            [repoFullName]: {
              ...prev[repoFullName],
              progress: 100,
              pending: 0,
              isPolling: false,
              completedAt: new Date().toISOString(),
              lastUpdated: new Date().toISOString()
            }
          }));
        }
      } catch (error) {
        console.error(`Error polling status for ${repoFullName}:`, error);
        
        // Continue polling for 404 errors (repository not ready yet)
        if (error instanceof Error && (error.message.includes('No files found') || error.message.includes('404'))) {
          console.log(`Repository ${repoFullName} not ready yet, continuing to poll...`);
          return;
        }
        
        // For other errors, update last updated time but continue polling
        setProcessingStatuses(prev => ({
          ...prev,
          [repoFullName]: {
            ...prev[repoFullName],
            lastUpdated: new Date().toISOString()
          }
        }));
      }
    };

    // Start polling immediately, then every POLL_INTERVAL
    pollStatus();
    const interval = setInterval(pollStatus, POLL_INTERVAL);
    intervalsRef.current[repoFullName] = interval;
  };

  const startProcessing = useCallback((repoFullName: string) => {
    console.log(`Starting processing tracking for ${repoFullName}`);
    
    // Initialize status
    setProcessingStatuses(prev => ({
      ...prev,
      [repoFullName]: {
        progress: 0,
        totalFiles: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        isPolling: true,
        lastUpdated: new Date().toISOString(),
        startedAt: new Date().toISOString()
      }
    }));

    // Start polling
    startPollingInternal(repoFullName);
  }, []);

  const stopProcessing = useCallback((repoFullName: string) => {
    console.log(`Stopping processing tracking for ${repoFullName}`);
    
    if (intervalsRef.current[repoFullName]) {
      clearInterval(intervalsRef.current[repoFullName]);
      delete intervalsRef.current[repoFullName];
    }

    setProcessingStatuses(prev => ({
      ...prev,
      [repoFullName]: {
        ...prev[repoFullName],
        isPolling: false,
        lastUpdated: new Date().toISOString()
      }
    }));
  }, []);

  const getStatus = useCallback((repoFullName: string): ProcessingStatus | null => {
    return processingStatuses[repoFullName] || null;
  }, [processingStatuses]);

  const clearStatus = useCallback((repoFullName: string) => {
    console.log(`Clearing processing status for ${repoFullName}`);
    
    // Stop polling
    if (intervalsRef.current[repoFullName]) {
      clearInterval(intervalsRef.current[repoFullName]);
      delete intervalsRef.current[repoFullName];
    }

    // Remove from state
    setProcessingStatuses(prev => {
      const newStatuses = { ...prev };
      delete newStatuses[repoFullName];
      return newStatuses;
    });
  }, []);

  const clearAllStatuses = useCallback(() => {
    console.log('Clearing all processing statuses');
    
    // Stop all polling
    Object.values(intervalsRef.current).forEach(interval => clearInterval(interval));
    intervalsRef.current = {};
    
    // Clear all statuses
    setProcessingStatuses({});
  }, []);

  const value: ProcessingStatusContextType = {
    processingStatuses,
    startProcessing,
    stopProcessing,
    getStatus,
    clearStatus,
    clearAllStatuses
  };

  return (
    <ProcessingStatusContext.Provider value={value}>
      {children}
    </ProcessingStatusContext.Provider>
  );
};

export const useProcessingStatus = () => {
  const context = useContext(ProcessingStatusContext);
  if (context === undefined) {
    throw new Error('useProcessingStatus must be used within a ProcessingStatusProvider');
  }
  return context;
};

export default ProcessingStatusContext; 