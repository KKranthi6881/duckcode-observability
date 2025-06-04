import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Code, 
  GitBranch, 
  GitFork, 
  Star, 
  Clock, 
  File, 
  Folder, 
  ChevronRight, 
  FileCode, 
  FilePlus, 
  Search,
  Users,
  Download,
  Copy,
  ExternalLink,
  BookOpen,
  GitCommit,
  BarChart,
  AlertCircle
} from 'lucide-react';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size?: string;
  lastUpdated?: string;
  content?: string; 
  items?: number; 
  children?: FileItem[]; 
  path?: string; 
}

interface Repository {
  id: number;
  name: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  lastUpdated: string;
  owner: string;
  visibility: string;
  localPath: string;
  files: FileItem[];
}

const repositoriesData: Repository[] = [
  {
    id: 1,
    name: 'Keppel Analytics',
    description: 'dbt models for Keppel data analytics',
    stars: 24,
    forks: 8,
    language: 'SQL',
    languageColor: '#FF4500',
    lastUpdated: '2 days ago',
    owner: 'data-team',
    visibility: 'internal',
    localPath: '/Users/Kranthi/projects/duckcode-observability/dbt-example-keppel',
    files: []
  },
  {
    id: 2,
    name: 'ML Pipeline',
    description: 'Machine learning pipeline for predictive analytics',
    stars: 15,
    forks: 3,
    language: 'Python',
    languageColor: '#3572A5',
    lastUpdated: '3 days ago',
    owner: 'ml-team',
    visibility: 'internal',
    localPath: '/Users/Kranthi/projects/duckcode-observability/ml-pipeline-example',
    files: []
  }
];

export function CodeBase() {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(repositoriesData.length > 0 ? repositoriesData[0] : null);
  const [view, setView] = useState<'list' | 'code'>('list');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBranch, setActiveBranch] = useState('main'); 
  const [activeTab, setActiveTab] = useState<'code' | 'documentation' | 'lineage' | 'visual' | 'alerts'>('code'); 
  const brandColor = "#2AB7A9";

  const [currentDirectoryItems, setCurrentDirectoryItems] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocalDirectoryContents = async (basePath: string, relativePath: string): Promise<FileItem[]> => {
    console.log(`Fetching directory: ${basePath} / ${relativePath}`);
    setError(null);
    
    try {
      // Try to make an API call to the backend
      try {
        const response = await fetch(`/api/fs/list?basePath=${encodeURIComponent(basePath)}&relativePath=${encodeURIComponent(relativePath)}`);
        
        if (response.ok) {
          const data = await response.json();
          
          // Sort directories first, then files alphabetically
          return data.sort((a: FileItem, b: FileItem) => {
            if (a.type === b.type) {
              return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
          });
        }
      } catch (apiError) {
        console.warn('API call failed, using mock data instead:', apiError);
        // Continue to mock data if API call fails
      }
      
      // Fallback to mock data if API call fails
      console.log('Using mock data for directory:', relativePath);
      
      // For now, let's simulate a more comprehensive directory structure
      let result: FileItem[] = [];
      
      // Root directory structure
      if (relativePath === '') {
        result = [
          { name: '.github', type: 'directory', items: 1, path: '.github' },
          { name: 'analyses', type: 'directory', items: 2, path: 'analyses' },
          { name: 'macros', type: 'directory', items: 3, path: 'macros' },
          { name: 'models', type: 'directory', items: 5, path: 'models' },
          { name: 'seeds', type: 'directory', items: 1, path: 'seeds' },
          { name: 'tests', type: 'directory', items: 2, path: 'tests' },
          { name: '.gitignore', type: 'file', size: '0.5KB', path: '.gitignore' },
          { name: 'dbt_project.yml', type: 'file', size: '2KB', path: 'dbt_project.yml' },
          { name: 'packages.yml', type: 'file', size: '0.5KB', path: 'packages.yml' },
          { name: 'README.md', type: 'file', size: '1KB', path: 'README.md' },
        ];
      } 
      // Models directory
      else if (relativePath === 'models') {
        result = [
          { name: 'demo_examples', type: 'directory', items: 2, path: 'models/demo_examples' },
          { name: 'marts', type: 'directory', items: 3, path: 'models/marts' },
          { name: 'staging', type: 'directory', items: 4, path: 'models/staging' },
          { name: 'utils', type: 'directory', items: 1, path: 'models/utils' },
          { name: 'overview.md', type: 'file', size: '1KB', path: 'models/overview.md' },
        ];
      }
      // Marts models
      else if (relativePath === 'models/marts') {
        result = [
          { name: 'aggregates', type: 'directory', items: 2, path: 'models/marts/aggregates' },
          { name: 'core', type: 'directory', items: 3, path: 'models/marts/core' },
          { name: 'intermediate', type: 'directory', items: 2, path: 'models/marts/intermediate' },
        ];
      }
      // Staging models
      else if (relativePath === 'models/staging') {
        result = [
          { name: 'tpch', type: 'directory', items: 10, path: 'models/staging/tpch' },
        ];
      }
      // TPCH staging models
      else if (relativePath === 'models/staging/tpch') {
        result = [
          { name: 'stg_tpch_customers.sql', type: 'file', size: '1.2KB', path: 'models/staging/tpch/stg_tpch_customers.sql' },
          { name: 'stg_tpch_line_items.sql', type: 'file', size: '1.5KB', path: 'models/staging/tpch/stg_tpch_line_items.sql' },
          { name: 'stg_tpch_nations.sql', type: 'file', size: '1.3KB', path: 'models/staging/tpch/stg_tpch_nations.sql' },
          { name: 'stg_tpch_orders.sql', type: 'file', size: '1.4KB', path: 'models/staging/tpch/stg_tpch_orders.sql' },
          { name: 'stg_tpch_part_suppliers.sql', type: 'file', size: '1.2KB', path: 'models/staging/tpch/stg_tpch_part_suppliers.sql' },
          { name: 'stg_tpch_parts.sql', type: 'file', size: '1.3KB', path: 'models/staging/tpch/stg_tpch_parts.sql' },
          { name: 'stg_tpch_regions.sql', type: 'file', size: '0.8KB', path: 'models/staging/tpch/stg_tpch_regions.sql' },
          { name: 'stg_tpch_suppliers.sql', type: 'file', size: '1.1KB', path: 'models/staging/tpch/stg_tpch_suppliers.sql' },
          { name: 'stg_tpch.md', type: 'file', size: '0.7KB', path: 'models/staging/tpch/stg_tpch.md' },
          { name: 'stg_tpch.yml', type: 'file', size: '2KB', path: 'models/staging/tpch/stg_tpch.yml' },
          { name: 'tpch_sources.yml', type: 'file', size: '1.5KB', path: 'models/staging/tpch/tpch_sources.yml' },
        ];
      }
      // Core mart models
      else if (relativePath === 'models/marts/core') {
        result = [
          { name: 'dim_customers.sql', type: 'file', size: '2.3KB', path: 'models/marts/core/dim_customers.sql' },
          { name: 'dim_suppliers.sql', type: 'file', size: '2.1KB', path: 'models/marts/core/dim_suppliers.sql' },
          { name: 'fct_orders.sql', type: 'file', size: '3.1KB', path: 'models/marts/core/fct_orders.sql' },
          { name: 'core.yml', type: 'file', size: '1.5KB', path: 'models/marts/core/core.yml' },
        ];
      }
      // Intermediate mart models
      else if (relativePath === 'models/marts/intermediate') {
        result = [
          { name: 'int_orders.sql', type: 'file', size: '2.2KB', path: 'models/marts/intermediate/int_orders.sql' },
          { name: 'int_customer_orders.sql', type: 'file', size: '1.9KB', path: 'models/marts/intermediate/int_customer_orders.sql' },
          { name: 'intermediate.yml', type: 'file', size: '1.1KB', path: 'models/marts/intermediate/intermediate.yml' },
        ];
      }
      // Aggregates mart models
      else if (relativePath === 'models/marts/aggregates') {
        result = [
          { name: 'agg_order_items.sql', type: 'file', size: '1.7KB', path: 'models/marts/aggregates/agg_order_items.sql' },
          { name: 'agg_daily_sales.sql', type: 'file', size: '1.5KB', path: 'models/marts/aggregates/agg_daily_sales.sql' },
          { name: 'aggregates.yml', type: 'file', size: '1.0KB', path: 'models/marts/aggregates/aggregates.yml' },
        ];
      }
      // Utils models
      else if (relativePath === 'models/utils') {
        result = [
          { name: 'date_spine.sql', type: 'file', size: '0.8KB', path: 'models/utils/date_spine.sql' },
          { name: 'fiscal_periods.sql', type: 'file', size: '1.2KB', path: 'models/utils/fiscal_periods.sql' },
          { name: 'utils.yml', type: 'file', size: '0.6KB', path: 'models/utils/utils.yml' },
        ];
      }
      // Demo examples
      else if (relativePath === 'models/demo_examples') {
        result = [
          { name: 'simple_query.sql', type: 'file', size: '0.5KB', path: 'models/demo_examples/simple_query.sql' },
          { name: 'advanced_query.sql', type: 'file', size: '1.0KB', path: 'models/demo_examples/advanced_query.sql' },
          { name: 'demo_examples.yml', type: 'file', size: '0.7KB', path: 'models/demo_examples/demo_examples.yml' },
        ];
      }
      // Analyses
      else if (relativePath === 'analyses') {
        result = [
          { name: 'customer_lifetime_value.sql', type: 'file', size: '2.5KB', path: 'analyses/customer_lifetime_value.sql' },
          { name: 'order_patterns.sql', type: 'file', size: '1.8KB', path: 'analyses/order_patterns.sql' },
        ];
      }
      // Macros
      else if (relativePath === 'macros') {
        result = [
          { name: 'generate_schema_name.sql', type: 'file', size: '0.7KB', path: 'macros/generate_schema_name.sql' },
          { name: 'date_spine.sql', type: 'file', size: '1.2KB', path: 'macros/date_spine.sql' },
          { name: 'utils', type: 'directory', items: 2, path: 'macros/utils' },
        ];
      }
      // Macro utils
      else if (relativePath === 'macros/utils') {
        result = [
          { name: 'surrogate_key.sql', type: 'file', size: '0.9KB', path: 'macros/utils/surrogate_key.sql' },
          { name: 'grant_select.sql', type: 'file', size: '0.6KB', path: 'macros/utils/grant_select.sql' },
        ];
      }
      // Tests
      else if (relativePath === 'tests') {
        result = [
          { name: 'assert_positive_value.sql', type: 'file', size: '0.5KB', path: 'tests/assert_positive_value.sql' },
          { name: 'assert_unique_key.sql', type: 'file', size: '0.6KB', path: 'tests/assert_unique_key.sql' },
        ];
      }
      // Seeds
      else if (relativePath === 'seeds') {
        result = [
          { name: 'country_codes.csv', type: 'file', size: '5KB', path: 'seeds/country_codes.csv' },
          { name: 'region_codes.csv', type: 'file', size: '3KB', path: 'seeds/region_codes.csv' },
        ];
      }
      // GitHub
      else if (relativePath === '.github') {
        result = [
          { name: 'workflows', type: 'directory', items: 1, path: '.github/workflows' },
        ];
      }
      // GitHub workflows
      else if (relativePath === '.github/workflows') {
        result = [
          { name: 'dbt_run.yml', type: 'file', size: '1.2KB', path: '.github/workflows/dbt_run.yml' },
          { name: 'dbt_test.yml', type: 'file', size: '1.0KB', path: '.github/workflows/dbt_test.yml' },
        ];
      }
      // Fallback for any other directory
      else {
        result = [
          { name: 'example1.sql', type: 'file', size: '1KB', path: `${relativePath}/example1.sql` },
          { name: 'example2.sql', type: 'file', size: '2KB', path: `${relativePath}/example2.sql` },
          { name: 'example.yml', type: 'file', size: '0.5KB', path: `${relativePath}/example.yml` },
        ];
      }
      
      // Sort directories first, then files alphabetically
      return result.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error) {
      console.error('Error fetching directory contents:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch directory contents');
      return [];
    }
  };

  const fetchLocalFileContent = async (basePath: string, filePath: string): Promise<string> => {
    console.log(`Fetching file: ${basePath} / ${filePath}`);
    
    try {
      // Try to make an API call to the backend
      try {
        const response = await fetch(`/api/fs/read?basePath=${encodeURIComponent(basePath)}&filePath=${encodeURIComponent(filePath)}`);
        
        if (response.ok) {
          const content = await response.text();
          
          // Check if the response contains HTML with React refresh code, which indicates it's not the actual file content
          if (content.includes('injectIntoGlobalHook') || content.includes('$RefreshReg$') || content.includes('<!doctype html>')) {
            console.warn('API returned HTML instead of file content, using mock data instead');
            throw new Error('Invalid content type received');
          }
          
          return content;
        }
      } catch (apiError) {
        console.warn('API call failed, using mock data instead:', apiError);
        // Continue to mock data if API call fails
      }
      
      // Fallback to mock data if API call fails
      console.log('Using mock data for file:', filePath);
      
      // Generate mock content based on file extension
      const extension = filePath.split('.').pop()?.toLowerCase();
      
      // SQL files
      if (extension === 'sql') {
        if (filePath === 'models/staging/tpch/stg_tpch_line_items.sql') {
          return `-- models/staging/tpch/stg_tpch_line_items.sql
-- Staging model for TPC-H line items

WITH source AS (
    SELECT * FROM {{ source('tpch', 'lineitem') }}
),

renamed AS (
    SELECT
        l_orderkey AS order_key,
        l_partkey AS part_key,
        l_suppkey AS supplier_key,
        l_linenumber AS line_number,
        l_quantity AS quantity,
        l_extendedprice AS extended_price,
        l_discount AS discount,
        l_tax AS tax_rate,
        l_returnflag AS return_flag,
        l_linestatus AS status_code,
        l_shipdate AS ship_date,
        l_commitdate AS commit_date,
        l_receiptdate AS receipt_date,
        l_shipinstruct AS ship_instructions,
        l_shipmode AS ship_mode,
        l_comment AS comment,
        -- Calculate actual price with discount applied
        (l_extendedprice * (1 - l_discount)) AS discounted_price,
        -- Calculate final price with tax
        (l_extendedprice * (1 - l_discount) * (1 + l_tax)) AS final_price
    FROM source
)

SELECT * FROM renamed`;
        }
        return `-- Mock SQL content for ${filePath}
SELECT 
  customers.customer_id,
  customers.name,
  customers.email,
  orders.order_id,
  orders.order_date,
  orders.total_amount
FROM customers
JOIN orders ON customers.customer_id = orders.customer_id
WHERE orders.order_date > '2023-01-01'
ORDER BY orders.order_date DESC
LIMIT 100;`;
      }
      
      // Python files
      if (extension === 'py') {
        return `# Mock Python content for ${filePath}
import pandas as pd
import numpy as np

def process_data(input_file, output_file):
    """
    Process the input data and save to output file
    
    Args:
        input_file (str): Path to input file
        output_file (str): Path to output file
    """
    # Read data
    df = pd.read_csv(input_file)
    
    # Process data
    df['processed'] = df['value'].apply(lambda x: x * 2)
    
    # Save results
    df.to_csv(output_file, index=False)
    
    return df

if __name__ == "__main__":
    process_data("input.csv", "output.csv")`;
      }
      
      // YAML/YML files
      if (extension === 'yml' || extension === 'yaml') {
        return `# Mock YAML content for ${filePath}
version: 2

models:
  - name: customers
    description: Customer data
    columns:
      - name: customer_id
        description: Primary key
        tests:
          - unique
          - not_null
      - name: name
        description: Customer name
      - name: email
        description: Customer email address
        tests:
          - not_null`;
      }
      
      // Markdown files
      if (extension === 'md') {
        return `# Mock Markdown content for ${filePath}

## Overview
This is a mock markdown file for demonstration purposes.

### Features
- Feature 1
- Feature 2
- Feature 3

### Usage
\`\`\`bash
$ dbt run --models example
\`\`\``;
      }
      
      // CSV files
      if (extension === 'csv') {
        return `id,name,country,region
1,Customer A,US,North America
2,Customer B,CA,North America
3,Customer C,UK,Europe
4,Customer D,DE,Europe
5,Customer E,FR,Europe`;
      }
      
      // Default content for any other file
      return `// Mock content for ${filePath}
This is a simulated file content for demonstration purposes.
In a real implementation, this would be the actual content of the file at:
${basePath}/${filePath}`;
    } catch (error) {
      console.error('Error fetching file content:', error);
      return `Error loading file content for ${filePath}`;
    }
  };

  // Load directory contents
  const loadDirectory = async (path: string[] = []) => {
    if (!selectedRepo) return;
    
    setIsLoading(true);
    setCurrentPath(path);
    setSelectedFile(null);
    
    try {
      const relativePath = path.join('/');
      const contents = await fetchLocalDirectoryContents(selectedRepo.localPath, relativePath);
      setCurrentDirectoryItems(contents);
    } catch (err) {
      console.error('Error loading directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file or directory click
  const handleFileClick = async (file: FileItem) => {
    if (file.type === 'directory') {
      // Navigate into the directory
      const newPath = [...currentPath, file.name];
      loadDirectory(newPath);
    } else {
      // Load file content
      setIsLoading(true);
      setSelectedFile(file);
      
      try {
        const content = await fetchLocalFileContent(selectedRepo!.localPath, file.path || '');
        setSelectedFile({ ...file, content });
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Load initial directory when repository changes
  useEffect(() => {
    if (selectedRepo) {
      loadDirectory([]);
    }
  }, [selectedRepo]);

  // Navigate to parent directory
  const goToParentDirectory = () => {
    if (currentPath.length > 0) {
      const newPath = [...currentPath];
      newPath.pop();
      loadDirectory(newPath);
    }
  };

  // Navigate to specific path in breadcrumb
  const navigateToPath = (index: number) => {
    const newPath = currentPath.slice(0, index + 1);
    loadDirectory(newPath);
  };

  const handleRepoClick = (repo: Repository) => {
    setSelectedRepo(repo);
    setCurrentPath([]);
    setSelectedFile(null);
    setView('list');
  };

  const getCurrentDirectoryContents = (): FileItem[] => {
    if (!selectedRepo) return [];
    
    // Filter by search query if provided
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      return currentDirectoryItems.filter(item => 
        item.name.toLowerCase().includes(lowerQuery)
      );
    }
    
    return currentDirectoryItems;
  };

  const getLanguageBadge = (language?: string, color?: string) => {
    if (!language) return null;
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" 
        style={{ backgroundColor: color ? `${color}20` : '#e2e8f0', color: color || '#64748b' }}>
        {language}
      </span>
    );
  };

  // Helper function to get syntax highlighting class based on file extension
  const getSyntaxClass = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch(extension) {
      case 'sql': return 'language-sql';
      case 'py': return 'language-python';
      case 'js': return 'language-javascript';
      case 'ts': return 'language-typescript';
      case 'tsx': return 'language-tsx';
      case 'jsx': return 'language-jsx';
      case 'json': return 'language-json';
      case 'yml': 
      case 'yaml': return 'language-yaml';
      case 'md': return 'language-markdown';
      case 'css': return 'language-css';
      case 'html': return 'language-html';
      case 'csv': return 'language-csv';
      default: return 'language-plaintext';
    }
  };

  // Helper function to get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch(extension) {
      case 'sql': return <FileCode className="h-4 w-4 mr-2 text-blue-500" />;
      case 'py': return <FileCode className="h-4 w-4 mr-2 text-green-500" />;
      case 'js': 
      case 'ts': 
      case 'tsx': 
      case 'jsx': return <FileCode className="h-4 w-4 mr-2 text-yellow-500" />;
      case 'json': return <FileCode className="h-4 w-4 mr-2 text-orange-500" />;
      case 'yml': 
      case 'yaml': return <FileCode className="h-4 w-4 mr-2 text-purple-500" />;
      case 'md': return <File className="h-4 w-4 mr-2 text-gray-500" />;
      case 'csv': return <FileCode className="h-4 w-4 mr-2 text-green-600" />;
      default: return <FileCode className="h-4 w-4 mr-2 text-gray-500" />;
    }
  };

  // File content display component
  const FileContentDisplay = ({ content }: { content: string }) => {
    return (
      <div className="overflow-x-auto">
        <pre className="p-4 bg-gray-50 rounded text-sm whitespace-pre-wrap font-mono">
          {content}
        </pre>
      </div>
    );
  };

  const formatCodeWithLineNumbers = (content: string): JSX.Element => {
    // Clean the content to remove any React refresh code or other unwanted content
    const cleanContent = content.replace(/window\.\$RefreshReg\$[\s\S]*?\);/g, '')
                               .replace(/injectIntoGlobalHook[\s\S]*?;/g, '')
                               .replace(/<meta[\s\S]*?>/g, '');
    
    const lines = cleanContent.split('\n');
    const fileExtension = selectedFile?.path?.split('.').pop()?.toLowerCase() || '';
    
    // Determine language for syntax highlighting
    let language = '';
    if (fileExtension === 'sql') {
      language = 'language-sql';
    } else if (fileExtension === 'py') {
      language = 'language-python';
    } else if (fileExtension === 'js' || fileExtension === 'jsx') {
      language = 'language-javascript';
    } else if (fileExtension === 'ts' || fileExtension === 'tsx') {
      language = 'language-typescript';
    } else if (fileExtension === 'json') {
      language = 'language-json';
    } else if (fileExtension === 'yml' || fileExtension === 'yaml') {
      language = 'language-yaml';
    } else if (fileExtension === 'md') {
      language = 'language-markdown';
    } else if (fileExtension === 'css') {
      language = 'language-css';
    } else if (fileExtension === 'html') {
      language = 'language-html';
    } else if (fileExtension === 'csv') {
      language = 'language-csv';
    } else {
      language = 'language-plaintext';
    }
    
    // Apply basic syntax highlighting for SQL
    const highlightSQL = (line: string): JSX.Element => {
      // SQL keywords
      const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'UNION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'VIEW', 'INDEX', 'AS', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'DISTINCT', 'ALL', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
      
      // Replace SQL keywords with highlighted spans
      let highlightedLine = line;
      
      // Handle strings (in single quotes)
      highlightedLine = highlightedLine.replace(/'([^']*)'/g, '<span class="string">\'$1\'</span>');
      
      // Handle numbers
      highlightedLine = highlightedLine.replace(/\b(\d+)\b/g, '<span class="number">$1</span>');
      
      // Handle SQL keywords (case insensitive)
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        highlightedLine = highlightedLine.replace(regex, `<span class="keyword">$&</span>`);
      });
      
      // Handle functions
      highlightedLine = highlightedLine.replace(/([A-Za-z0-9_]+)\(/g, '<span class="function">$1</span>(');
      
      // Handle comments
      highlightedLine = highlightedLine.replace(/--(.*)$/g, '<span class="comment">--$1</span>');
      
      return <span dangerouslySetInnerHTML={{ __html: highlightedLine }} />;
    };
    
    // Apply basic syntax highlighting for Python
    const highlightPython = (line: string): JSX.Element => {
      // Python keywords
      const keywords = ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'break', 'continue', 'pass', 'raise', 'in', 'is', 'not', 'and', 'or', 'True', 'False', 'None', 'lambda', 'nonlocal', 'global', 'assert'];
      
      // Replace Python keywords with highlighted spans
      let highlightedLine = line;
      
      // Handle strings (in single or double quotes)
      highlightedLine = highlightedLine.replace(/'([^']*)'/g, '<span class="string">\'$1\'</span>');
      highlightedLine = highlightedLine.replace(/"([^"]*)"/g, '<span class="string">"$1"</span>');
      
      // Handle numbers
      highlightedLine = highlightedLine.replace(/\b(\d+)\b/g, '<span class="number">$1</span>');
      
      // Handle Python keywords
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        highlightedLine = highlightedLine.replace(regex, `<span class="keyword">$&</span>`);
      });
      
      // Handle functions
      highlightedLine = highlightedLine.replace(/([A-Za-z0-9_]+)\(/g, '<span class="function">$1</span>(');
      
      // Handle comments
      highlightedLine = highlightedLine.replace(/#(.*)$/g, '<span class="comment">#$1</span>');
      
      return <span dangerouslySetInnerHTML={{ __html: highlightedLine }} />;
    };
    
    // Render code with line numbers
    return (
      <div className="flex overflow-x-auto font-mono text-sm">
        <div className="line-numbers pr-4 text-right text-gray-400 select-none border-r border-gray-200 mr-4">
          {lines.map((_, i) => (
            <div key={i} className="leading-6 text-xs py-0.5">
              {i + 1}
            </div>
          ))}
        </div>
        <div className={`code-content flex-1 ${language}`}>
          {lines.map((line, i) => (
            <div key={i} className="leading-6 text-xs py-0.5">
              {fileExtension === 'sql' ? highlightSQL(line) : 
               fileExtension === 'py' ? highlightPython(line) : 
               line}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Function to copy code to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Code copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
  };

  const getMockDocumentation = (filePath: string) => {
    if (filePath === 'models/staging/tpch/stg_tpch_line_items.sql') {
      return `
        <div class="prose max-w-none">
          <h1 class="text-2xl font-bold text-indigo-700 mb-6">stg_tpch_line_items.sql</h1>
          
          <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p class="text-sm text-blue-700">
              <strong>Model Type:</strong> Staging<br/>
              <strong>Database:</strong> TPC-H<br/>
              <strong>Purpose:</strong> Clean and standardize raw line item data
            </p>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">📄 Overview</h2>
          <p class="text-gray-700 leading-relaxed mb-6">
            This staging model transforms raw line item data from the TPC-H dataset into a structured format 
            with standardized naming conventions and business calculations. It's a foundational model that serves
            as a building block for intermediate and core analytics models.
          </p>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">🔄 Data Flow</h2>
          <div class="bg-gray-100 p-4 rounded-md mb-6">
            <p class="text-sm font-mono mb-2">Raw Source → Staging → Intermediate → Marts</p>
            <p class="text-gray-600 italic text-sm">This model is in the <strong>Staging</strong> layer</p>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">📊 Source Data</h2>
          <p class="text-gray-700 mb-4">
            This model sources data from the <code>lineitem</code> table in the <code>tpch</code> schema, 
            which contains the raw line item data from the TPC-H benchmark dataset.
          </p>
          
          <div class="bg-gray-800 rounded-md p-4 mb-6 overflow-auto">
            <pre class="text-green-400 text-sm"><code>{{ source('tpch', 'lineitem') }}</code></pre>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">🧩 Code Structure</h2>
          
          <h3 class="text-lg font-medium text-gray-700 mt-6 mb-3">1. Source CTE</h3>
          <p class="text-gray-700 mb-3">
            The first CTE pulls in all columns from the source table. This is a common pattern in dbt that allows for 
            easy reference to the source data.
          </p>
          <div class="bg-gray-800 rounded-md p-4 mb-6 overflow-auto">
            <pre class="text-white text-sm"><code>WITH <span class="text-blue-400">source</span> AS (
    SELECT * FROM {{ source('tpch', 'lineitem') }}
),</code></pre>
          </div>
          
          <h3 class="text-lg font-medium text-gray-700 mt-6 mb-3">2. Renamed CTE</h3>
          <p class="text-gray-700 mb-3">
            The second CTE transforms the raw column names into business-friendly names and adds calculated fields.
            This improves readability and adds business logic.
          </p>
          <div class="bg-gray-800 rounded-md p-4 mb-6 overflow-auto">
            <pre class="text-white text-sm"><code><span class="text-blue-400">renamed</span> AS (
    SELECT
        <span class="text-yellow-400">l_orderkey</span> AS <span class="text-green-400">order_key</span>,
        <span class="text-yellow-400">l_partkey</span> AS <span class="text-green-400">part_key</span>,
        <span class="text-yellow-400">l_suppkey</span> AS <span class="text-green-400">supplier_key</span>,
        <span class="text-yellow-400">l_linenumber</span> AS <span class="text-green-400">line_number</span>,
        ...
        <span class="text-gray-400">-- Calculate actual price with discount applied</span>
        (<span class="text-yellow-400">l_extendedprice</span> * (1 - <span class="text-yellow-400">l_discount</span>)) AS <span class="text-green-400">discounted_price</span>,
        <span class="text-gray-400">-- Calculate final price with tax</span>
        (<span class="text-yellow-400">l_extendedprice</span> * (1 - <span class="text-yellow-400">l_discount</span>) * (1 + <span class="text-yellow-400">l_tax</span>)) AS <span class="text-green-400">final_price</span>
    FROM source
)</code></pre>
          </div>
          
          <h3 class="text-lg font-medium text-gray-700 mt-6 mb-3">3. Final Select</h3>
          <p class="text-gray-700 mb-3">
            The final SELECT statement returns all columns from the renamed CTE, making this a clean, transformed version of the source data.
          </p>
          <div class="bg-gray-800 rounded-md p-4 mb-6 overflow-auto">
            <pre class="text-white text-sm"><code>SELECT * FROM <span class="text-blue-400">renamed</span></code></pre>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">🧮 Key Transformations</h2>
          <div class="border-l-4 border-indigo-500 pl-4 mb-6">
            <h3 class="text-lg font-medium text-gray-700 mb-2">Column Renaming</h3>
            <p class="text-gray-700 mb-4">
              All columns are renamed from the source format (e.g., <code>l_orderkey</code>) to a more readable format (e.g., <code>order_key</code>).
              This establishes a consistent naming convention across the entire project.
            </p>
            
            <h3 class="text-lg font-medium text-gray-700 mb-2">Discount Calculation</h3>
            <p class="text-gray-700 mb-4">
              <strong>discounted_price</strong> = extended_price × (1 - discount)
            </p>
            <div class="bg-gray-800 rounded-md p-4 mb-4">
              <pre class="text-white text-sm"><code>(<span class="text-yellow-400">l_extendedprice</span> * (1 - <span class="text-yellow-400">l_discount</span>)) AS <span class="text-green-400">discounted_price</span></code></pre>
            </div>
            <p class="text-gray-600 text-sm italic mb-4">
              This calculates the actual price after applying the discount percentage.
            </p>
            
            <h3 class="text-lg font-medium text-gray-700 mb-2">Final Price Calculation</h3>
            <p class="text-gray-700 mb-4">
              <strong>final_price</strong> = extended_price × (1 - discount) × (1 + tax)
            </p>
            <div class="bg-gray-800 rounded-md p-4 mb-4">
              <pre class="text-white text-sm"><code>(<span class="text-yellow-400">l_extendedprice</span> * (1 - <span class="text-yellow-400">l_discount</span>) * (1 + <span class="text-yellow-400">l_tax</span>)) AS <span class="text-green-400">final_price</span></code></pre>
            </div>
            <p class="text-gray-600 text-sm italic mb-4">
              This calculates the total price after applying both discount and tax.
            </p>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">📋 Output Fields</h2>
          <div class="overflow-x-auto mb-6">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Name</th>
                  <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">order_key</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">integer</td>
                  <td class="px-6 py-4 text-sm text-gray-500">Foreign key to orders table, identifies which order this line item belongs to</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">part_key</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">integer</td>
                  <td class="px-6 py-4 text-sm text-gray-500">Foreign key to parts table, identifies the product being ordered</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">supplier_key</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">integer</td>
                  <td class="px-6 py-4 text-sm text-gray-500">Foreign key to suppliers table, identifies who's supplying the part</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">quantity</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">numeric</td>
                  <td class="px-6 py-4 text-sm text-gray-500">Number of units ordered</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">extended_price</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">numeric</td>
                  <td class="px-6 py-4 text-sm text-gray-500">Base price (unit price × quantity)</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">discounted_price</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">numeric</td>
                  <td class="px-6 py-4 text-sm text-gray-500">Extended price with discount applied</td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">final_price</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">numeric</td>
                  <td class="px-6 py-4 text-sm text-gray-500">Final price with tax applied</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">🔗 Dependencies</h2>
          <div class="flex flex-col space-y-4 mb-6">
            <div class="flex items-center space-x-2 border border-gray-200 rounded-md p-3">
              <div class="bg-blue-100 text-blue-800 rounded-md px-2 py-1 text-xs font-medium">SOURCE</div>
              <code class="text-sm">source('tpch', 'lineitem')</code>
              <span class="text-xs text-gray-500">Raw line item data</span>
            </div>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">🔄 Used By</h2>
          <div class="flex flex-col space-y-4 mb-6">
            <div class="flex items-center space-x-2 border border-gray-200 rounded-md p-3">
              <div class="bg-yellow-100 text-yellow-800 rounded-md px-2 py-1 text-xs font-medium">INTERMEDIATE</div>
              <code class="text-sm">int_order_items</code>
              <span class="text-xs text-gray-500">Joins line items with order data</span>
            </div>
            <div class="flex items-center space-x-2 border border-gray-200 rounded-md p-3">
              <div class="bg-orange-100 text-orange-800 rounded-md px-2 py-1 text-xs font-medium">MART</div>
              <code class="text-sm">fct_orders</code>
              <span class="text-xs text-gray-500">Fact table for completed orders</span>
            </div>
          </div>
          
          <h2 class="text-xl font-semibold text-gray-800 mt-8 mb-4">💡 Usage Notes</h2>
          <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <h3 class="text-lg font-medium text-yellow-800 mb-2">Best Practices</h3>
            <ul class="list-disc pl-5 text-yellow-800">
              <li class="mb-2">Always join to this model using <code>order_key</code> rather than directly to the source table</li>
              <li class="mb-2">Use <code>discounted_price</code> for most price calculations rather than calculating it yourself</li>
              <li class="mb-2">This model handles all the cleaning and transformation of the raw source data</li>
            </ul>
          </div>
          
          <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-medium text-indigo-800 mb-2">📘 Learning Resources</h3>
            <ul class="space-y-2">
              <li>
                <a href="#" class="text-indigo-600 hover:text-indigo-800">dbt Best Practices Guide</a>
                <p class="text-sm text-gray-600">Learn more about standard dbt patterns</p>
              </li>
              <li>
                <a href="#" class="text-indigo-600 hover:text-indigo-800">TPC-H Schema Reference</a>
                <p class="text-sm text-gray-600">Documentation for the TPC-H dataset</p>
              </li>
            </ul>
          </div>
        </div>
      `;
    }
    
    // Default documentation for other files
    return `
      <h1>Documentation for ${filePath}</h1>
      <p>This is a sample documentation for the file ${filePath}</p>
    `;
  };

  const getMockLineageData = (filePath: string) => {
    if (filePath === 'models/staging/tpch/stg_tpch_line_items.sql') {
      return [
        {
          id: 1,
          name: 'tpch.lineitem',
          type: 'source',
          columns: ['l_orderkey', 'l_partkey', 'l_suppkey', 'l_linenumber', 'l_quantity', 'l_extendedprice', 'l_discount', 'l_tax', 'l_returnflag', 'l_linestatus', 'l_shipdate', 'l_commitdate', 'l_receiptdate', 'l_shipinstruct', 'l_shipmode', 'l_comment']
        },
        {
          id: 2,
          name: 'stg_tpch_line_items',
          type: 'staging',
          columns: ['order_key', 'part_key', 'supplier_key', 'line_number', 'quantity', 'extended_price', 'discount', 'tax_rate', 'return_flag', 'status_code', 'ship_date', 'commit_date', 'receipt_date', 'ship_instructions', 'ship_mode', 'comment', 'discounted_price', 'final_price']
        },
        {
          id: 3,
          name: 'int_order_items',
          type: 'intermediate',
          columns: ['order_key', 'order_date', 'customer_key', 'line_number', 'part_key', 'supplier_key', 'quantity', 'extended_price', 'discounted_price', 'final_price']
        },
        {
          id: 4,
          name: 'fct_orders',
          type: 'mart',
          columns: ['order_key', 'order_date', 'customer_key', 'status', 'total_price', 'item_count', 'priority']
        }
      ];
    }
    
    // Default lineage data for other files
    return [
      {
        id: 1,
        name: 'Table A',
        type: 'table',
        columns: ['id', 'name', 'email']
      },
      {
        id: 2,
        name: 'Table B',
        type: 'table',
        columns: ['id', 'order_id', 'product_id']
      },
      {
        id: 3,
        name: 'View C',
        type: 'view',
        columns: ['id', 'name', 'email', 'order_id', 'product_id']
      }
    ];
  };

  const getMockVisualData = (filePath: string) => {
    // Simulate visual data
    return [
      {
        id: 1,
        name: 'Chart A',
        type: 'chart',
        data: [
          { x: '2022-01-01', y: 100 },
          { x: '2022-01-02', y: 120 },
          { x: '2022-01-03', y: 150 }
        ]
      },
      {
        id: 2,
        name: 'Chart B',
        type: 'chart',
        data: [
          { x: '2022-01-01', y: 50 },
          { x: '2022-01-02', y: 70 },
          { x: '2022-01-03', y: 90 }
        ]
      }
    ];
  };

  const getMockAlerts = (filePath: string) => {
    // Simulate alerts
    return [
      {
        id: 1,
        message: 'Alert 1',
        severity: 'critical',
        status: 'active',
        timestamp: new Date().toISOString()
      },
      {
        id: 2,
        message: 'Alert 2',
        severity: 'high',
        status: 'resolved',
        timestamp: new Date().toISOString()
      }
    ];
  };

  const renderLineage = (lineageData: any[]) => {
    // Enhanced lineage diagram rendering with column relationships
    if (lineageData.length > 0 && lineageData[0].name === 'tpch.lineitem') {
      return (
        <div className="p-6 bg-white rounded shadow">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Data Lineage Visualization</h2>
          
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              This interactive diagram shows how data flows through the data pipeline, from source tables to final analytics models.
              <span className="block mt-2 font-medium">Hover over any column or connection to see details. Click on a column to highlight its full data path.</span>
            </p>
          </div>
          
          {/* Interactive Column Flow Diagram */}
          <div className="column-flow-diagram bg-white border border-gray-200 rounded-lg p-6 mb-8 overflow-x-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Column Flow Diagram</h3>
              <div className="flex items-center space-x-4">
                <button className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm hover:bg-blue-100 transition-colors">
                  <span className="mr-1">🔍</span> Zoom In
                </button>
                <button className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-sm hover:bg-blue-100 transition-colors">
                  <span className="mr-1">👁️</span> Reset View
                </button>
                <select className="text-sm border rounded px-2 py-1 bg-white">
                  <option value="all">Show All Columns</option>
                  <option value="keys">Show Only Keys</option>
                  <option value="calculated">Show Calculated Fields</option>
                </select>
              </div>
            </div>
            
            <div className="legend flex flex-wrap gap-3 mb-4 border-b pb-3">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-sm mr-2" style={{background: '#E3F2FD', border: '1px solid #90CAF9'}}></div>
                <span className="text-sm">Source</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-sm mr-2" style={{background: '#E8F5E9', border: '1px solid #A5D6A7'}}></div>
                <span className="text-sm">Staging</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-sm mr-2" style={{background: '#FFF8E1', border: '1px solid #FFE082'}}></div>
                <span className="text-sm">Intermediate</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-sm mr-2" style={{background: '#FBE9E7', border: '1px solid #FFAB91'}}></div>
                <span className="text-sm">Mart</span>
              </div>
              <div className="border-l border-gray-300 h-5 mx-2"></div>
              <div className="flex items-center">
                <div className="inline-block w-8 h-0 mr-2" style={{borderTop: '2px solid #2AB7A9'}}></div>
                <span className="text-sm">Direct mapping</span>
              </div>
              <div className="flex items-center">
                <div className="inline-block w-8 h-0 mr-2" style={{borderTop: '2px dashed #4F46E5'}}></div>
                <span className="text-sm">Calculation</span>
              </div>
              <div className="flex items-center">
                <div className="inline-block w-8 h-0 mr-2" style={{borderTop: '2px dashed #EF4444'}}></div>
                <span className="text-sm">Aggregation</span>
              </div>
              <div className="flex items-center">
                <div className="inline-block w-8 h-0 mr-2" style={{borderTop: '2px solid #F59E0B'}}></div>
                <span className="text-sm">Join</span>
              </div>
            </div>
            
            <div className="relative min-w-[900px]" style={{ height: '550px' }}>
              <style jsx>{`
                .model-column {
                  position: absolute;
                  padding: 8px 12px;
                  border-radius: 6px;
                  font-size: 0.8rem;
                  z-index: 10;
                  white-space: nowrap;
                  border: 1px solid rgba(0,0,0,0.1);
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  cursor: pointer;
                  transition: all 0.2s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
                .model-column:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                  z-index: 20;
                }
                .model-column.active {
                  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5), 0 4px 8px rgba(0,0,0,0.15);
                }
                .source-column {
                  background-color: #E3F2FD;
                  border-color: #90CAF9;
                  width: 120px;
                }
                .staging-column {
                  background-color: #E8F5E9;
                  border-color: #A5D6A7;
                  left: 270px;
                  width: 140px;
                }
                .intermediate-column {
                  background-color: #FFF8E1;
                  border-color: #FFE082;
                  left: 530px;
                  width: 140px;
                }
                .mart-column {
                  background-color: #FBE9E7;
                  border-color: #FFAB91;
                  left: 790px;
                  width: 120px;
                }
                .connector-line {
                  stroke-width: 2;
                  fill: none;
                }
                .connector-direct {
                  stroke: #2AB7A9;
                }
                .connector-calculated {
                  stroke: #4F46E5;
                }
                .connector-join {
                  stroke: #F59E0B;
                }
                .connector-aggregation {
                  stroke: #EF4444;
                }
                @keyframes flow {
                  from {
                    stroke-dashoffset: 100;
                  }
                  to {
                    stroke-dashoffset: 0;
                  }
                }
                .connector-label {
                  position: absolute;
                  background: white;
                  padding: 3px 8px;
                  border-radius: 6px;
                  font-size: 0.75rem;
                  border: 1px solid #e0e0e0;
                  white-space: nowrap;
                  z-index: 15;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                  opacity: 0;
                  transition: opacity 0.2s ease;
                  max-width: 200px;
                }
                .connector-label.visible {
                  opacity: 1;
                }
                .model-label {
                  position: absolute;
                  top: -40px;
                  transform: translateX(-50%);
                  font-weight: bold;
                  color: #424242;
                  background-color: #f9fafb;
                  padding: 4px 12px;
                  border-radius: 4px;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .source-label { left: 120px; }
                .staging-label { left: 340px; }
                .intermediate-label { left: 600px; }
                .mart-label { left: 850px; }
                .path-highlight {
                  stroke-dasharray: 5;
                  animation: dash 1s linear infinite;
                  stroke-width: 3;
                  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
                }
                @keyframes dash {
                  to {
                    stroke-dashoffset: -10;
                  }
                }
                .tooltip {
                  position: absolute;
                  background: white;
                  border: 1px solid #e0e0e0;
                  border-radius: 4px;
                  padding: 8px 12px;
                  font-size: 0.75rem;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  z-index: 30;
                  pointer-events: none;
                  max-width: 250px;
                  transition: opacity 0.2s ease;
                }
                .column-path {
                  cursor: pointer;
                  transition: stroke-width 0.2s ease;
                  stroke-dasharray: 1000;
                  stroke-dashoffset: 1000;
                  animation: drawLine 1.5s forwards ease-in-out;
                }
                @keyframes drawLine {
                  to {
                    stroke-dashoffset: 0;
                  }
                }
                .column-path:hover {
                  stroke-width: 3;
                }
                .relation-explanation {
                  font-size: 0.7rem;
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  border-radius: 4px;
                  padding: 2px 4px;
                  position: absolute;
                  z-index: 12;
                }
              `}</style>
              
              {/* Model Labels */}
              <div className="model-label source-label">Source: tpch.lineitem</div>
              <div className="model-label staging-label">Staging: stg_tpch_line_items</div>
              <div className="model-label intermediate-label">Intermediate: int_order_items</div>
              <div className="model-label mart-label">Mart: fct_orders</div>
              
              {/* Source Columns */}
              <div className="model-column source-column" style={{ top: '50px', left: '60px' }} 
                   title="Primary key from orders table"
                   onClick={() => {
                     const paths = document.querySelectorAll('.order-key-path');
                     paths.forEach(path => {
                       const p = path as HTMLElement;
                       p.style.opacity = '1';
                       setTimeout(() => { p.style.opacity = '0'; }, 2000);
                     });
                   }}>
                l_orderkey
              </div>
              <div className="model-column source-column" style={{ top: '90px', left: '60px' }}
                   title="Foreign key reference to parts">
                l_partkey
              </div>
              <div className="model-column source-column" style={{ top: '130px', left: '60px' }}
                   title="Foreign key reference to suppliers">
                l_suppkey
              </div>
              <div className="model-column source-column" style={{ top: '170px', left: '60px' }}
                   title="Base price without discount (unit_price × quantity)">
                l_extendedprice
              </div>
              <div className="model-column source-column" style={{ top: '210px', left: '60px' }}
                   title="Discount percentage (0-1 range)">
                l_discount
              </div>
              <div className="model-column source-column" style={{ top: '250px', left: '60px' }}
                   title="Tax rate (0-1 range)">
                l_tax
              </div>
              <div className="model-column source-column" style={{ top: '290px', left: '60px' }}
                   title="Number of items ordered">
                l_quantity
              </div>
              
              {/* Staging Columns */}
              <div className="model-column staging-column" style={{ top: '50px' }}
                   title="Renamed from l_orderkey">
                order_key
              </div>
              <div className="model-column staging-column" style={{ top: '90px' }}
                   title="Renamed from l_partkey">
                part_key
              </div>
              <div className="model-column staging-column" style={{ top: '130px' }}
                   title="Renamed from l_suppkey">
                supplier_key
              </div>
              <div className="model-column staging-column" style={{ top: '170px' }}
                   title="Renamed from l_extendedprice">
                extended_price
              </div>
              <div className="model-column staging-column" style={{ top: '210px' }}
                   title="Renamed from l_discount">
                discount
              </div>
              <div className="model-column staging-column" style={{ top: '250px' }}
                   title="Renamed from l_tax">
                tax_rate
              </div>
              <div className="model-column staging-column" style={{ top: '290px' }}
                   title="Renamed from l_quantity">
                quantity
              </div>
              <div className="model-column staging-column" style={{ top: '350px' }}
                   title="Calculated: extended_price × (1 - discount)">
                discounted_price
              </div>
              <div className="model-column staging-column" style={{ top: '410px' }}
                   title="Calculated: extended_price × (1 - discount) × (1 + tax_rate)">
                final_price
              </div>
              
              {/* Intermediate Columns */}
              <div className="model-column intermediate-column" style={{ top: '50px' }}
                   title="From staging: order_key">
                order_key
              </div>
              <div className="model-column intermediate-column" style={{ top: '90px' }}
                   title="From staging: part_key">
                part_key
              </div>
              <div className="model-column intermediate-column" style={{ top: '130px' }}
                   title="From staging: supplier_key">
                supplier_key
              </div>
              <div className="model-column intermediate-column" style={{ top: '290px' }}
                   title="From staging: quantity">
                quantity
              </div>
              <div className="model-column intermediate-column" style={{ top: '350px' }}
                   title="From staging: discounted_price">
                discounted_price
              </div>
              <div className="model-column intermediate-column" style={{ top: '410px' }}
                   title="From staging: final_price">
                final_price
              </div>
              
              {/* Mart Columns */}
              <div className="model-column mart-column" style={{ top: '50px' }}
                   title="Primary key from intermediate: order_key">
                order_key
              </div>
              <div className="model-column mart-column" style={{ top: '170px' }}
                   title="Aggregated: SUM(final_price) GROUP BY order_key">
                total_price
              </div>
              <div className="model-column mart-column" style={{ top: '230px' }}
                   title="Aggregated: COUNT(*) GROUP BY order_key">
                item_count
              </div>
              
              {/* SVG Connectors */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none' }}>
                <defs>
                  <marker id="arrowhead-direct" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#2AB7A9" />
                  </marker>
                  <marker id="arrowhead-calculated" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#4F46E5" />
                  </marker>
                  <marker id="arrowhead-aggregation" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
                  </marker>
                  <marker id="arrowhead-join" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
                  </marker>
                </defs>
                
                {/* Source to Staging Direct Mappings */}
                <path className="column-path connector-direct order-key-path" 
                      d="M180,60 C220,60 240,60 270,60" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)"
                      onMouseOver={() => document.getElementById('tooltip-rename1')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('tooltip-rename1')?.classList.remove('visible')} />
                      
                <path className="column-path connector-direct" 
                      d="M180,100 C220,100 240,100 270,100" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M180,140 C220,140 240,140 270,140" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M180,180 C220,180 240,180 270,180" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M180,220 C220,220 240,220 270,220" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M180,260 C220,260 240,260 270,260" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M180,300 C220,300 240,300 270,300" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                
                {/* Multiple source columns to calculated columns */}
                <path className="column-path connector-calculated" 
                      d="M180,180 C220,220 240,330 270,350" 
                      stroke="#4F46E5" strokeWidth="2" fill="none" 
                      strokeDasharray="5,5"
                      markerEnd="url(#arrowhead-calculated)"
                      onMouseOver={() => document.getElementById('calculation1')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('calculation1')?.classList.remove('visible')} />
                      
                <path className="column-path connector-calculated" 
                      d="M180,220 C220,240 240,330 270,350" 
                      stroke="#4F46E5" strokeWidth="2" fill="none" 
                      strokeDasharray="5,5"
                      markerEnd="url(#arrowhead-calculated)"
                      onMouseOver={() => document.getElementById('calculation1')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('calculation1')?.classList.remove('visible')} />
                      
                <path className="column-path connector-calculated" 
                      d="M180,180 C220,220 240,390 270,410" 
                      stroke="#4F46E5" strokeWidth="2" fill="none" 
                      strokeDasharray="5,5"
                      markerEnd="url(#arrowhead-calculated)"
                      onMouseOver={() => document.getElementById('calculation2')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('calculation2')?.classList.remove('visible')} />
                      
                <path className="column-path connector-calculated" 
                      d="M180,220 C220,240 240,390 270,410" 
                      stroke="#4F46E5" strokeWidth="2" fill="none" 
                      strokeDasharray="5,5"
                      markerEnd="url(#arrowhead-calculated)"
                      onMouseOver={() => document.getElementById('calculation2')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('calculation2')?.classList.remove('visible')} />
                      
                <path className="column-path connector-calculated" 
                      d="M180,260 C220,280 240,390 270,410" 
                      stroke="#4F46E5" strokeWidth="2" fill="none" 
                      strokeDasharray="5,5"
                      markerEnd="url(#arrowhead-calculated)"
                      onMouseOver={() => document.getElementById('calculation2')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('calculation2')?.classList.remove('visible')} />
                
                {/* Staging to Intermediate Connectors */}
                <path className="column-path connector-direct order-key-path" 
                      d="M410,60 C460,60 480,60 530,60" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M410,100 C460,100 480,100 530,100" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M410,140 C460,140 480,140 530,140" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M410,300 C460,300 480,300 530,300" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M410,360 C460,360 480,360 530,360" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-direct" 
                      d="M410,420 C460,420 480,420 530,420" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                
                {/* Intermediate to Mart Connectors */}
                <path className="column-path connector-direct order-key-path" 
                      d="M670,60 C730,60 750,60 790,60" 
                      stroke="#2AB7A9" strokeWidth="2" fill="none" 
                      markerEnd="url(#arrowhead-direct)" />
                      
                <path className="column-path connector-aggregation" 
                      d="M670,420 C700,350 730,180 790,180" 
                      stroke="#EF4444" strokeWidth="2" fill="none"
                      strokeDasharray="5,5"
                      markerEnd="url(#arrowhead-aggregation)"
                      onMouseOver={() => document.getElementById('aggregation1')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('aggregation1')?.classList.remove('visible')} />
                      
                <path className="column-path connector-aggregation" 
                      d="M670,300 C700,280 730,240 790,240" 
                      stroke="#EF4444" strokeWidth="2" fill="none"
                      strokeDasharray="5,5"
                      markerEnd="url(#arrowhead-aggregation)"
                      onMouseOver={() => document.getElementById('aggregation2')?.classList.add('visible')} 
                      onMouseOut={() => document.getElementById('aggregation2')?.classList.remove('visible')} />
                
                {/* Example of highlighted path for order_key - initially invisible but can be triggered to show */}
                <path className="path-highlight order-key-path" 
                      d="M180,60 C220,60 240,60 270,60" 
                      stroke="#2196F3" strokeWidth="3" fill="none" 
                      style={{opacity: 0}} />
                <path className="path-highlight order-key-path" 
                      d="M410,60 C460,60 480,60 530,60" 
                      stroke="#2196F3" strokeWidth="3" fill="none" 
                      style={{opacity: 0}} />
                <path className="path-highlight order-key-path" 
                      d="M670,60 C730,60 750,60 790,60" 
                      stroke="#2196F3" strokeWidth="3" fill="none" 
                      style={{opacity: 0}} />
              </svg>
              
              {/* Relation Explanations */}
              <div className="relation-explanation" style={{top: '45px', left: '222px'}}>
                Simple rename
              </div>
              <div className="relation-explanation" style={{top: '90px', left: '222px'}}>
                Simple rename
              </div>
              <div className="relation-explanation" style={{top: '135px', left: '222px'}}>
                Simple rename
              </div>
              <div className="relation-explanation" style={{top: '45px', left: '464px'}}>
                Direct pass-through
              </div>
              <div className="relation-explanation" style={{top: '309px', left: '330px', maxWidth: '140px', textAlign: 'center'}}>
                Calculation: discounted price based on discount %
              </div>
              <div className="relation-explanation" style={{top: '370px', left: '330px', maxWidth: '140px', textAlign: 'center'}}>
                Calculation: final price including tax
              </div>
              <div className="relation-explanation" style={{top: '170px', left: '670px', maxWidth: '120px', transform: 'rotate(-25deg)'}}>
                Aggregation: SUM by order
              </div>
              <div className="relation-explanation" style={{top: '260px', left: '700px', maxWidth: '100px'}}>
                Count of items
              </div>
              
              {/* Transformation Labels */}
              <div id="tooltip-rename1" className="connector-label" style={{ top: '35px', left: '200px' }}>
                <div className="font-semibold text-xs mb-1">Direct Mapping</div>
                Simple rename: l_orderkey → order_key
              </div>
              <div id="calculation1" className="connector-label" style={{ top: '330px', left: '190px' }}>
                <div className="font-semibold text-xs mb-1">Calculation</div>
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">extended_price * (1 - discount)</code>
                <div className="text-xs mt-1 text-gray-600">Calculates discounted price before tax</div>
              </div>
              <div id="calculation2" className="connector-label" style={{ top: '390px', left: '190px' }}>
                <div className="font-semibold text-xs mb-1">Calculation</div>
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">extended_price * (1 - discount) * (1 + tax_rate)</code>
                <div className="text-xs mt-1 text-gray-600">Calculates final price with tax applied</div>
              </div>
              <div id="aggregation1" className="connector-label" style={{ top: '180px', left: '700px' }}>
                <div className="font-semibold text-xs mb-1">Aggregation</div>
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">SUM(final_price) GROUP BY order_key</code>
                <div className="text-xs mt-1 text-gray-600">Aggregates all line items to get total order price</div>
              </div>
              <div id="aggregation2" className="connector-label" style={{ top: '240px', left: '700px' }}>
                <div className="font-semibold text-xs mb-1">Aggregation</div>
                <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">COUNT(*) GROUP BY order_key</code>
                <div className="text-xs mt-1 text-gray-600">Counts items in each order</div>
              </div>
              
              {/* Tooltip with detailed column info - appears on hover */}
              <div className="tooltip" style={{opacity: 0, top: '50px', left: '50px'}}>
                <h4 className="font-semibold mb-1">order_key</h4>
                <p className="mb-1 text-xs">Integer - Primary key from orders table</p>
                <div className="text-xs text-gray-600 border-t pt-1 mt-1">
                  Used in join conditions with orders table
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-500 italic text-center">
              Hover over columns and connections for details. Click on a column to highlight its data path.
            </div>
          </div>
        </div>
      );
    }
    
    // Default lineage rendering for other files
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">No detailed lineage available</h2>
        <p className="text-gray-600">Lineage information is not available for this file type.</p>
      </div>
    );
  };

  const renderVisual = (visualData: any[]) => {
    // Render visual data
    return (
      <div>
        <h2>Visual</h2>
        <ul>
          {visualData.map((item, index) => (
            <li key={index}>
              <span>{item.name}</span>
              <span className="ml-2">{item.type}</span>
              <div>
                {item.data.map((dataPoint, index) => (
                  <div key={index}>
                    <span>{dataPoint.x}</span>
                    <span className="ml-2">{dataPoint.y}</span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderSeverityBadge = (severity: string) => {
    // Render severity badge
    return (
      <span className={`px-2 py-0.5 rounded-full ${
        severity === 'critical' ? 'bg-red-100 text-red-800' : 
        severity === 'high' ? 'bg-orange-100 text-orange-800' : 
        severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
        'bg-green-100 text-green-800'
      }`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
          <Code className="h-6 w-6 mr-2 text-[#2AB7A9]" />
          Code Repository
        </h1>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search files..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#2AB7A9] focus:border-[#2AB7A9] text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {selectedRepo && (
            <div className="flex items-center bg-gray-100 rounded-lg px-3 py-1.5 text-sm text-gray-700">
              <GitBranch className="h-4 w-4 mr-1.5 text-gray-500" />
              <span>{activeBranch}</span>
            </div>
          )}
        </div>
      </div>

      {!selectedRepo ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Select a Repository</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {repositoriesData.map((repo) => (
              <div 
                key={repo.id} 
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleRepoClick(repo)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center">
                      <h3 className="text-base font-medium text-gray-900">{repo.name}</h3>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                        {repo.visibility}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{repo.description}</p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        <span>{repo.owner}</span>
                      </div>
                      {repo.stars > 0 && (
                        <div className="flex items-center">
                          <Star className="h-4 w-4 mr-1" />
                          <span>{repo.stars}</span>
                        </div>
                      )}
                      {repo.forks > 0 && (
                        <div className="flex items-center">
                          <GitFork className="h-4 w-4 mr-1" />
                          <span>{repo.forks}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{repo.lastUpdated}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {getLanguageBadge(repo.language, repo.languageColor)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Repository Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <button 
                className="mr-3 text-gray-500 hover:text-[#2AB7A9]"
                onClick={() => setSelectedRepo(null)}
              >
                <ChevronRight className="h-5 w-5 transform rotate-180" />
              </button>
              <h2 className="text-lg font-medium text-gray-900">{selectedRepo.name}</h2>
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                {selectedRepo.visibility}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              {getLanguageBadge(selectedRepo.language, selectedRepo.languageColor)}
            </div>
          </div>

          {/* GitHub-like Split View Layout */}
          <div className="flex border-t border-gray-200">
            {/* Left Side - File Navigation */}
            <div className="w-1/4 border-r border-gray-200 bg-gray-50">
              {/* Breadcrumb Navigation */}
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-100 flex items-center text-sm">
                <span 
                  className="cursor-pointer text-gray-600 hover:text-[#2AB7A9]"
                  onClick={() => setCurrentPath([])}
                >
                  {selectedRepo.name.split(' ')[0]}
                </span>
                {currentPath.map((path, index) => (
                  <div key={index} className="flex items-center">
                    <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
                    <span 
                      className="cursor-pointer text-gray-600 hover:text-[#2AB7A9]"
                      onClick={() => navigateToPath(index)}
                    >
                      {path}
                    </span>
                  </div>
                ))}
              </div>

              {/* Directory Listing */}
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                {isLoading && !selectedFile ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : error ? (
                  <div className="p-4 text-center text-red-500">{error}</div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {currentPath.length > 0 && (
                      <li 
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center text-gray-600"
                        onClick={goToParentDirectory}
                      >
                        <ChevronRight className="h-4 w-4 mr-2 transform rotate-180" />
                        <span>..</span>
                      </li>
                    )}
                    {getCurrentDirectoryContents().map((file, index) => (
                      <li 
                        key={index} 
                        className={`px-4 py-2 hover:bg-gray-100 cursor-pointer ${selectedFile?.name === file.name ? 'bg-blue-50' : ''}`}
                        onClick={() => handleFileClick(file)}
                      >
                        <div className="flex items-center">
                          {file.type === 'directory' ? (
                            <Folder className="h-4 w-4 mr-2 text-blue-500" />
                          ) : (
                            getFileIcon(file.name)
                          )}
                          <span className={`text-sm ${selectedFile?.name === file.name ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                            {file.name}
                          </span>
                        </div>
                      </li>
                    ))}
                    {getCurrentDirectoryContents().length === 0 && !isLoading && (
                      <li className="px-4 py-3 text-center text-gray-500 text-sm">
                        Directory is empty or not accessible.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Right Side - File Content */}
            <div className="w-3/4">
              {selectedFile && selectedFile.type === 'file' ? (
                /* File Content View */
                <div className="h-full flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-100 flex items-center justify-between">
                    <div className="flex items-center">
                      {getFileIcon(selectedFile.name)}
                      <span className="text-sm font-medium text-gray-700">{selectedFile.name}</span>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700">
                        {selectedFile.name.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-gray-500">
                        {selectedFile.size || ''} {selectedFile.lastUpdated && `• Last updated ${selectedFile.lastUpdated}`}
                      </div>
                      <button 
                        className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                        onClick={() => selectedFile.content && copyToClipboard(selectedFile.content)}
                        title="Copy code"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button 
                        className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-auto flex-grow bg-gray-50" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                    {isLoading ? (
                      <div className="p-4 text-center text-gray-500">Loading file content...</div>
                    ) : (
                      <div className="p-0">
                        {/* Tab Navigation */}
                        <div className="flex items-center border-b border-gray-200">
                          <button 
                            className={`px-4 py-3 text-sm font-medium flex items-center ${activeTab === 'code' ? 'text-[#2AB7A9] border-b-2 border-[#2AB7A9]' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'} transition-colors`}
                            onClick={() => setActiveTab('code')}
                          >
                            <FileCode className="h-4 w-4 mr-2" />
                            Code
                          </button>
                          <button 
                            className={`px-4 py-3 text-sm font-medium flex items-center ${activeTab === 'documentation' ? 'text-[#2AB7A9] border-b-2 border-[#2AB7A9]' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'} transition-colors`}
                            onClick={() => setActiveTab('documentation')}
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Documentation
                          </button>
                          <button 
                            className={`px-4 py-3 text-sm font-medium flex items-center ${activeTab === 'lineage' ? 'text-[#2AB7A9] border-b-2 border-[#2AB7A9]' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'} transition-colors`}
                            onClick={() => setActiveTab('lineage')}
                          >
                            <GitCommit className="h-4 w-4 mr-2" />
                            Lineage
                          </button>
                          <button 
                            className={`px-4 py-3 text-sm font-medium flex items-center ${activeTab === 'visual' ? 'text-[#2AB7A9] border-b-2 border-[#2AB7A9]' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'} transition-colors`}
                            onClick={() => setActiveTab('visual')}
                          >
                            <BarChart className="h-4 w-4 mr-2" />
                            Visual
                          </button>
                          <button 
                            className={`px-4 py-3 text-sm font-medium flex items-center ${activeTab === 'alerts' ? 'text-[#2AB7A9] border-b-2 border-[#2AB7A9]' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'} transition-colors`}
                            onClick={() => setActiveTab('alerts')}
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Alerts
                            {getMockAlerts(selectedFile.path || '').filter(a => a.status === 'active').length > 0 && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                                {getMockAlerts(selectedFile.path || '').filter(a => a.status === 'active').length}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-0">
                          {activeTab === 'code' && (
                            <FileContentDisplay content={selectedFile.content || ''} />
                          )}
                          
                          {activeTab === 'documentation' && (
                            <div className="p-6">
                              <div className="bg-white p-6 rounded-lg border border-gray-200">
                                <div className="prose prose-sm max-w-none">
                                  <div dangerouslySetInnerHTML={{ __html: getMockDocumentation(selectedFile.path || '') }} />
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {activeTab === 'lineage' && (
                            <div className="p-6">
                              <div className="bg-white p-6 rounded-lg border border-gray-200">
                                {renderLineage(getMockLineageData(selectedFile.path || ''))}
                              </div>
                            </div>
                          )}
                          
                          {activeTab === 'visual' && (
                            <div className="p-6">
                              <div className="bg-white p-6 rounded-lg border border-gray-200">
                                {renderVisual(getMockVisualData(selectedFile.path || ''))}
                              </div>
                            </div>
                          )}
                          
                          {activeTab === 'alerts' && (
                            <div className="p-6">
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                {getMockAlerts(selectedFile.path || '').length > 0 ? (
                                  <div className="divide-y divide-gray-200">
                                    {getMockAlerts(selectedFile.path || '').map((alert, index) => (
                                      <div key={index} className="p-4">
                                        <div className="flex items-center mb-2">
                                          <AlertCircle className={`h-5 w-5 mr-2 ${
                                            alert.severity === 'critical' ? 'text-red-500' : 
                                            alert.severity === 'high' ? 'text-orange-500' : 
                                            alert.severity === 'medium' ? 'text-yellow-500' : 
                                            'text-green-500'
                                          }`} />
                                          <div className="mr-2">
                                            {renderSeverityBadge(alert.severity)}
                                          </div>
                                          <span className="text-sm font-medium text-gray-700">{alert.message}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                          <span>
                                            {new Date(alert.timestamp).toLocaleString()}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded-full ${
                                            alert.status === 'active' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                          }`}>
                                            {alert.status}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-6 text-center text-gray-500">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                    <p>No alerts found for this file</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Empty state / Welcome message when no file is selected */
                <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-gray-50">
                  <div className="max-w-md">
                    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                      <FileCode className="h-16 w-16 mx-auto mb-4 text-[#2AB7A9]" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">Select a file to view its contents</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Choose a file from the directory tree on the left to view its contents here.
                      </p>
                      {currentPath.length > 0 && (
                        <div className="mt-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <span className="text-gray-500">Currently browsing:</span> 
                          <div className="font-mono text-xs mt-1 p-2 bg-gray-100 rounded text-gray-700 overflow-x-auto whitespace-nowrap">
                            {selectedRepo?.localPath}/{currentPath.join('/')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
