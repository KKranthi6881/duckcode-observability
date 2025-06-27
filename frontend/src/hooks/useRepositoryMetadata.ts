import { useState, useEffect } from 'react';
import { getRepositoryDetails } from '../services/githubService';

interface RepositoryMetadata {
  pushed_at?: string;
  updated_at?: string;
  created_at?: string;
  size?: number;
  open_issues_count?: number;
  license?: {
    key: string;
    name: string;
  };
  default_branch?: string;
  stargazers_count?: number;
  forks_count?: number;
  language?: string;
}

export const useRepositoryMetadata = (repoFullName: string | null) => {
  const [metadata, setMetadata] = useState<RepositoryMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoFullName) {
      setMetadata(null);
      return;
    }

    const fetchMetadata = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const [owner, repo] = repoFullName.split('/');
        const details = await getRepositoryDetails(owner, repo);
        
        // Map the GitHub repository data to our metadata interface
        const mappedMetadata: RepositoryMetadata = {
          pushed_at: details.pushed_at,
          updated_at: details.updated_at,
          created_at: details.created_at,
          size: details.size,
          open_issues_count: details.open_issues_count,
          license: details.license ? {
            key: details.license.key,
            name: details.license.name
          } : undefined,
          default_branch: details.default_branch,
          stargazers_count: details.stargazers_count,
          forks_count: details.forks_count,
          language: details.language || undefined
        };
        
        setMetadata(mappedMetadata);
      } catch (err: any) {
        console.error('Error fetching repository metadata:', err);
        setError(err.message || 'Failed to fetch repository metadata');
        setMetadata(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [repoFullName]);

  return { metadata, isLoading, error };
}; 