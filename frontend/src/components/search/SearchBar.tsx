import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Command } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SearchResults } from './SearchResults';
import { useDebounce } from '@/hooks/useDebounce';
import axios from 'axios';
import { supabase } from '@/config/supabaseClient';

interface SearchBarProps {
  organizationId: string;
  onSelectObject?: (objectId: string) => void;
}

interface SearchResult {
  object_id: string;
  name: string;
  full_name?: string;
  description?: string;
  object_type: string;
  file_path?: string;
  repository_name?: string;
  confidence_score: number;
  score: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({ organizationId, onSelectObject }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);
  
  // Use backend hybrid search endpoint (searches both metadata and files!)
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const SEARCH_URL = `${API_URL}/api/search/hybrid`;

  // Keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        setResults([]);
        setSuggestions([]);
        setIsLoading(false);
        return;
      }
      
      const headers = {
        'Authorization': `Bearer ${token}`
      };
      
      // Get hybrid search results (metadata + files!)
      const searchResponse = await axios.get(SEARCH_URL, {
        params: {
          q: searchQuery,
          metadata_limit: 5,
          files_limit: 5
        },
        headers
      });
      
      // Combine metadata and file results
      const metadataResults = searchResponse.data.results?.metadata?.items || [];
      const fileResults = searchResponse.data.results?.files?.items || [];
      
      // Add a type indicator to each result
      const combinedResults = [
        ...metadataResults.map((r: any) => ({ ...r, resultType: 'metadata' })),
        ...fileResults.map((r: any) => ({ ...r, resultType: 'file', name: r.file_name || r.file_path }))
      ];
      
      console.log(`🔍 Hybrid search: ${metadataResults.length} metadata + ${fileResults.length} files = ${combinedResults.length} total`);
      
      setResults(combinedResults);
      setSuggestions([])
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, SEARCH_URL]);

  // Search when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      performSearch(debouncedQuery);
    } else {
      setResults([]);
      setSuggestions([]);
    }
  }, [debouncedQuery, performSearch]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleSelectResult = (objectId: string) => {
    setIsOpen(false);
    setQuery('');
    onSelectObject?.(objectId);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search tables, views, models..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-20 h-10 w-full"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded">
            <Command className="w-3 h-3" />
            K
          </kbd>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <Search className="w-3 h-3 text-gray-400" />
                  <span className="text-sm">{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="px-3 py-8 text-center text-sm text-gray-500">
              Searching...
            </div>
          )}

          {/* Results */}
          {!isLoading && results.length > 0 && (
            <SearchResults
              results={results}
              onSelect={handleSelectResult}
              query={query}
            />
          )}

          {/* No Results */}
          {!isLoading && query.length >= 2 && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-gray-500">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
