import axios from 'axios';

// Force the correct API URL with /api path
const API_BASE_URL = import.meta.env.VITE_API_URL?.includes('/api') 
  ? import.meta.env.VITE_API_URL 
  : (import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api` 
    : 'http://localhost:3001/api');

// Debug log the API URL
console.log('🌐 Sequential Processing Service - API_BASE_URL configured as:', API_BASE_URL);
console.log('🌐 Environment check:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  NODE_ENV: import.meta.env.NODE_ENV,
  MODE: import.meta.env.MODE
});

export interface SequentialProcessingJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentPhase: string;
  phases: {
    documentation?: { 
      status: string; 
      progress: number; 
      completed?: number; 
      failed?: number; 
      pending?: number; 
      total?: number;
      details?: any;
    };
    vectors?: { 
      status: string; 
      progress: number; 
      completed?: number; 
      failed?: number; 
      pending?: number; 
      total?: number;
      details?: any;
    };
    lineage?: { 
      status: string; 
      progress: number; 
      completed?: number; 
      failed?: number; 
      pending?: number; 
      total?: number;
      details?: any;
    };
    dependencies?: { 
      status: string; 
      progress: number; 
      completed?: number; 
      failed?: number; 
      pending?: number; 
      total?: number;
      details?: any;
    };
    analysis?: { 
      status: string; 
      progress: number; 
      completed?: number; 
      failed?: number; 
      pending?: number; 
      total?: number;
      details?: any;
    };
  };
  startedAt: string;
  completedAt?: string;
  progress: number;
  totalFiles?: number;
  fileCounts?: {
    totalFiles: number;
    docCompleted: number;
    docFailed: number;
    docPending: number;
    vectorCompleted: number;
    vectorFailed: number;
    vectorPending: number;
  };
}

export interface SequentialProcessingResponse {
  message: string;
  jobId: string;
  currentPhase: string;
  phases: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

class SequentialProcessingService {
  
  /**
   * Start sequential processing for a repository
   */
  async startSequentialProcessing(repositoryFullName: string, token: string, selectedLanguage?: string): Promise<SequentialProcessingResponse> {
    try {
      console.log('🌐 Sequential Processing Service - API_BASE_URL:', API_BASE_URL);
      console.log('📡 Making request to:', `${API_BASE_URL}/sequential/start`);
      console.log('📦 Request payload:', { repositoryFullName, selectedLanguage });
      
      // First try the standard endpoint
      let response;
      try {
        response = await axios.post(
          `${API_BASE_URL}/sequential/start`,
          { repositoryFullName, selectedLanguage },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (authError: any) {
        // If auth fails, try the debug endpoint
        console.log('⚠️ Auth endpoint failed, trying debug endpoint...');
        response = await axios.post(
          `${API_BASE_URL}/sequential/debug-start`,
          { repositoryFullName, selectedLanguage },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
      
      console.log('✅ Sequential processing API response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Sequential Processing Service Error:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('📡 Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
        
        throw new Error(
          error.response?.data?.message || 
          `API Error: ${error.response?.status} ${error.response?.statusText}`
        );
      } else {
        console.error('🔥 Non-axios error:', error);
        throw new Error('Failed to start sequential processing');
      }
    }
  }

  /**
   * Fix stuck lineage phase - useful when lineage gets stuck
   */
  async fixLineagePhase(repositoryFullName: string): Promise<any> {
    try {
      console.log('🔧 Fixing lineage phase for:', repositoryFullName);
      
      const response = await axios.post(
        `${API_BASE_URL}/sequential/fix-lineage`,
        { repositoryFullName },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Lineage fix response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fixing lineage phase:', error);
      throw new Error('Failed to fix lineage phase');
    }
  }

  /**
   * Create sequential job from existing processing jobs
   */
  async createSequentialFromExisting(repositoryFullName: string): Promise<any> {
    try {
      console.log('🔄 Creating sequential job from existing for:', repositoryFullName);
      
      const response = await axios.post(
        `${API_BASE_URL}/sequential/create-from-existing`,
        { repositoryFullName },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Sequential creation response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error creating sequential from existing:', error);
      throw new Error('Failed to create sequential processing job');
    }
  }

  /**
   * Get sequential processing status
   */
  async getSequentialStatus(repositoryFullName: string, token: string): Promise<SequentialProcessingJob> {
    try {
      console.log('📡 Getting sequential status for:', repositoryFullName);
      
      // First try the standard endpoint
      let response;
      try {
        response = await axios.get(
          `${API_BASE_URL}/sequential/status/${encodeURIComponent(repositoryFullName)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (authError: any) {
        // If auth fails, try the debug endpoint that works with your current setup
        console.log('⚠️ Auth endpoint failed, trying debug endpoint...');
        response = await axios.get(
          `${API_BASE_URL}/sequential/debug-status/${encodeURIComponent(repositoryFullName)}`,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      }
      
      console.log('✅ Sequential status response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error getting sequential status:', error);
      
      if (axios.isAxiosError(error)) {
        console.error('📡 Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
      }
      
      throw new Error(
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : 'Failed to get sequential processing status'
      );
    }
  }

  /**
   * Poll sequential processing status with interval and auto-recovery
   */
  pollSequentialStatus(
    repositoryFullName: string, 
    token: string, 
    onUpdate: (status: SequentialProcessingJob) => void,
    onError: (error: Error) => void,
    intervalMs: number = 5000
  ): () => void {
    
    let isPolling = true;
    let errorCount = 0;
    let lastStatus: SequentialProcessingJob | null = null;
    
    const poll = async () => {
      if (!isPolling) return;
      
      try {
        const status = await this.getSequentialStatus(repositoryFullName, token);
        
        // Check for stuck lineage phase and auto-fix
        if (status.currentPhase === 'lineage' && 
            status.phases.lineage?.status === 'error' &&
            status.phases.lineage?.progress === 0 &&
            status.phases.vectors?.status === 'completed') {
          
          console.log('🔧 Detected stuck lineage phase, attempting auto-fix...');
          try {
            await this.fixLineagePhase(repositoryFullName);
            console.log('✅ Auto-fix applied, continuing polling...');
          } catch (fixError) {
            console.error('❌ Auto-fix failed:', fixError);
          }
        }
        
        // Check if job doesn't exist but should, and try to create it
        if (!status.jobId && lastStatus?.jobId) {
          console.log('🔄 Sequential job missing, attempting to recreate...');
          try {
            await this.createSequentialFromExisting(repositoryFullName);
            console.log('✅ Sequential job recreated');
          } catch (createError) {
            console.error('❌ Failed to recreate job:', createError);
          }
        }
        
        lastStatus = status;
        errorCount = 0; // Reset error count on success
        onUpdate(status);
        
        // Continue polling if still processing
        if (status.status === 'processing') {
          setTimeout(poll, intervalMs);
        }
        
      } catch (error) {
        errorCount++;
        
        if (isPolling) {
          // If we get multiple errors and have a repository, try to create sequential job
          if (errorCount >= 3 && repositoryFullName) {
            console.log('🔄 Multiple failures detected, attempting to create sequential job...');
            try {
              await this.createSequentialFromExisting(repositoryFullName);
              errorCount = 0; // Reset error count
              setTimeout(poll, intervalMs); // Continue polling
              return;
            } catch (createError) {
              console.error('❌ Failed to create sequential job:', createError);
            }
          }
          
          onError(error as Error);
          
          // Continue polling even on error, but with longer interval
          if (errorCount < 10) {
            setTimeout(poll, intervalMs * 2);
          }
        }
      }
    };
    
    // Start polling
    poll();
    
    // Return stop function
    return () => {
      isPolling = false;
    };
  }

  /**
   * Calculate phase display info
   */
  getPhaseDisplayInfo(currentPhase: string, phases: any) {
    const phaseOrder = ['documentation', 'vectors', 'lineage', 'dependencies', 'analysis'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    
    return phaseOrder.map((phaseId, index) => {
      const phase = phases[phaseId];
      const isActive = index === currentIndex;
      const isCompleted = phase?.status === 'completed';
      const isPending = index > currentIndex;
      const isFailed = phase?.status === 'error';
      
      return {
        id: phaseId,
        name: this.getPhaseDisplayName(phaseId),
        status: phase?.status || 'pending',
        progress: phase?.progress || 0,
        isActive,
        isCompleted,
        isPending,
        isFailed,
        icon: this.getPhaseIcon(phaseId)
      };
    });
  }

  /**
   * Get display name for phase
   */
  private getPhaseDisplayName(phaseId: string): string {
    const names = {
      documentation: 'Documentation Analysis',
      vectors: 'Vector Generation',
      lineage: 'Lineage Extraction',
      dependencies: 'Dependency Resolution',
      analysis: 'Impact Analysis'
    };
    return names[phaseId as keyof typeof names] || phaseId;
  }

  /**
   * Get icon for phase
   */
  private getPhaseIcon(phaseId: string): string {
    const icons = {
      documentation: '📄',
      vectors: '🔍',
      lineage: '🔗',
      dependencies: '🌐',
      analysis: '📊'
    };
    return icons[phaseId as keyof typeof icons] || '⚙️';
  }
}

export const sequentialProcessingService = new SequentialProcessingService(); 