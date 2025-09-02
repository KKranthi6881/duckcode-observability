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
    documentation?: { status: string; progress: number };
    vectors?: { status: string; progress: number };
    lineage?: { status: string; progress: number };
    dependencies?: { status: string; progress: number };
    analysis?: { status: string; progress: number };
  };
  startedAt: string;
  completedAt?: string;
  progress: number;
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
      
      const response = await axios.post(
        `${API_BASE_URL}/sequential/start`,
        { repositoryFullName, selectedLanguage },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
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
   * Get sequential processing status
   */
  async getSequentialStatus(repositoryFullName: string, token: string): Promise<SequentialProcessingJob> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/sequential/status/${encodeURIComponent(repositoryFullName)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Error getting sequential status:', error);
      throw new Error(
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : 'Failed to get sequential processing status'
      );
    }
  }

  /**
   * Poll sequential processing status with interval
   */
  pollSequentialStatus(
    repositoryFullName: string, 
    token: string, 
    onUpdate: (status: SequentialProcessingJob) => void,
    onError: (error: Error) => void,
    intervalMs: number = 5000
  ): () => void {
    
    let isPolling = true;
    
    const poll = async () => {
      if (!isPolling) return;
      
      try {
        const status = await this.getSequentialStatus(repositoryFullName, token);
        onUpdate(status);
        
        // Continue polling if still processing
        if (status.status === 'processing') {
          setTimeout(poll, intervalMs);
        }
        
      } catch (error) {
        if (isPolling) {
          onError(error as Error);
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