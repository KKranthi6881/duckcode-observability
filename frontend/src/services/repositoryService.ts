/**
 * Repository Service
 * Fetches admin-connected GitHub repositories for the organization
 * All users (admins + members) can view these repositories
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Repository {
  id: string;
  repository_name: string;
  repository_owner: string;
  repository_url: string;
  branch: string;
  status: 'connected' | 'extracting' | 'completed' | 'error' | 'failed';
  created_at: string;
  last_extraction_at?: string;
  total_files?: number;
  total_objects?: number;
  total_columns?: number;
  extraction_quality_score?: number;
  manifest_uploaded?: boolean;
}

export interface RepositoryStats {
  id: string;
  name: string;
  fullName: string;
  language: string;
  lastProcessed?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  stats: {
    files: number;
    documentation: number;
    vectors: number;
    lineage: number;
    dependencies: number;
  };
}

/**
 * Get all repositories connected by admin for the organization
 * Available to all users in the organization
 */
export const getOrganizationRepositories = async (token: string): Promise<Repository[]> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/repositories`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching organization repositories:', error);
    throw error;
  }
};

/**
 * Get repository statistics for dashboard display
 */
export const getRepositoryStats = async (
  repositoryId: string,
  token: string
): Promise<RepositoryStats> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/repositories/${repositoryId}/stats`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching stats for repository ${repositoryId}:`, error);
    throw error;
  }
};

export interface MetadataObject {
  id: string;
  name: string;
  object_type: string;
  schema_name?: string;
  database_name?: string;
  [key: string]: unknown;
}

/**
 * Get metadata objects for a repository
 */
export const getRepositoryMetadata = async (
  repositoryId: string,
  token: string
): Promise<MetadataObject[]> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/repositories/${repositoryId}/metadata`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching metadata for repository ${repositoryId}:`, error);
    throw error;
  }
};

/**
 * Transform admin repository to dashboard format
 */
export const transformRepositoryForDashboard = (repo: Repository): RepositoryStats => {
  // Determine status
  let status: 'pending' | 'processing' | 'completed' | 'error' = 'pending';
  if (repo.status === 'extracting') status = 'processing';
  else if (repo.status === 'completed') status = 'completed';
  else if (repo.status === 'error' || repo.status === 'failed') status = 'error';
  
  // Determine language from repository name or default to 'dbt'
  const language = repo.repository_name.includes('dbt') ? 'dbt' : 
                   repo.repository_name.includes('python') ? 'python' : 
                   repo.repository_name.includes('sql') ? 'sql' : 'unknown';
  
  return {
    id: repo.id,
    name: repo.repository_name,
    fullName: `${repo.repository_owner}/${repo.repository_name}`,
    language,
    lastProcessed: repo.last_extraction_at,
    status,
    stats: {
      files: repo.total_files || 0,
      documentation: repo.total_objects || 0,
      vectors: repo.total_objects || 0,
      lineage: repo.total_columns || 0,
      dependencies: 0 // Will be calculated from metadata
    }
  };
};

export default {
  getOrganizationRepositories,
  getRepositoryStats,
  getRepositoryMetadata,
  transformRepositoryForDashboard
};
