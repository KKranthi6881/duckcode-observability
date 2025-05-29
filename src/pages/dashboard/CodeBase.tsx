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
          { name: 'models', type: 'directory', items: 4, path: 'models' },
          { name: 'analyses', type: 'directory', items: 2, path: 'analyses' },
          { name: 'macros', type: 'directory', items: 3, path: 'macros' },
          { name: 'tests', type: 'directory', items: 2, path: 'tests' },
          { name: 'seeds', type: 'directory', items: 1, path: 'seeds' },
          { name: 'dbt_project.yml', type: 'file', size: '2KB', path: 'dbt_project.yml' },
          { name: 'README.md', type: 'file', size: '1KB', path: 'README.md' },
          { name: 'packages.yml', type: 'file', size: '0.5KB', path: 'packages.yml' },
        ];
      } 
      // Models directory
      else if (relativePath === 'models') {
        result = [
          { name: 'staging', type: 'directory', items: 3, path: 'models/staging' },
          { name: 'intermediate', type: 'directory', items: 2, path: 'models/intermediate' },
          { name: 'marts', type: 'directory', items: 4, path: 'models/marts' },
          { name: 'README.md', type: 'file', size: '1KB', path: 'models/README.md' },
        ];
      }
      // Staging models
      else if (relativePath === 'models/staging') {
        result = [
          { name: 'schema.yml', type: 'file', size: '3KB', path: 'models/staging/schema.yml' },
          { name: 'stg_customers.sql', type: 'file', size: '1.2KB', path: 'models/staging/stg_customers.sql' },
          { name: 'stg_orders.sql', type: 'file', size: '1.5KB', path: 'models/staging/stg_orders.sql' },
        ];
      }
      // Intermediate models
      else if (relativePath === 'models/intermediate') {
        result = [
          { name: 'schema.yml', type: 'file', size: '2KB', path: 'models/intermediate/schema.yml' },
          { name: 'int_orders.sql', type: 'file', size: '2.1KB', path: 'models/intermediate/int_orders.sql' },
        ];
      }
      // Marts models
      else if (relativePath === 'models/marts') {
        result = [
          { name: 'core', type: 'directory', items: 2, path: 'models/marts/core' },
          { name: 'marketing', type: 'directory', items: 2, path: 'models/marts/marketing' },
          { name: 'schema.yml', type: 'file', size: '1.8KB', path: 'models/marts/schema.yml' },
        ];
      }
      // Core mart models
      else if (relativePath === 'models/marts/core') {
        result = [
          { name: 'dim_customers.sql', type: 'file', size: '2.3KB', path: 'models/marts/core/dim_customers.sql' },
          { name: 'fct_orders.sql', type: 'file', size: '3.1KB', path: 'models/marts/core/fct_orders.sql' },
        ];
      }
      // Marketing mart models
      else if (relativePath === 'models/marts/marketing') {
        result = [
          { name: 'customer_segmentation.sql', type: 'file', size: '1.9KB', path: 'models/marts/marketing/customer_segmentation.sql' },
          { name: 'campaign_performance.sql', type: 'file', size: '2.2KB', path: 'models/marts/marketing/campaign_performance.sql' },
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
          // Return the raw text content
          return await response.text();
        }
      } catch (apiError) {
        console.warn('API call failed, using mock data instead:', apiError);
        // Continue to mock data if API call fails
      }
      
      // Fallback to mock data if API call fails
      console.log('Using mock data for file:', filePath);
      
      // For demonstration, return simulated content based on file path/extension
      const fileExtension = filePath.split('.').pop()?.toLowerCase();
      
      if (filePath === 'dbt_project.yml') {
        return `name: 'keppel_analytics'
version: '1.0.0'
config-version: 2

profile: 'keppel_analytics'

model-paths: ["models"]
analysis-paths: ["analyses"]
test-paths: ["tests"]
seed-paths: ["seeds"]
macro-paths: ["macros"]

target-path: "target"
clean-targets:
  - "target"
  - "dbt_packages"

models:
  keppel_analytics:
    staging:
      +materialized: view
    intermediate:
      +materialized: view
    marts:
      +materialized: table`;
      }
      
      if (filePath === 'README.md') {
        return `# Keppel Analytics dbt Project

This dbt project transforms raw data from our data warehouse into analytics-ready models.

## Structure
- **staging**: Clean and standardize source data
- **intermediate**: Join and transform staging models
- **marts**: Business-specific transformations for reporting

## Getting Started
1. Install dbt
2. Configure profiles.yml
3. Run \`dbt deps\`
4. Run \`dbt run\``;
      }
      
      if (fileExtension === 'sql') {
        if (filePath.includes('staging')) {
          return `-- Staging model for ${filePath.split('/').pop()?.replace('.sql', '')}
WITH source AS (
    SELECT * FROM {{ source('raw_data', '${filePath.split('/').pop()?.replace('stg_', '').replace('.sql', '')}') }}
),

renamed AS (
    SELECT
        id,
        name,
        created_at,
        updated_at
    FROM source
)

SELECT * FROM renamed`;
        }
        
        if (filePath.includes('intermediate')) {
          return `-- Intermediate model for transformed data
WITH orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
),

customers AS (
    SELECT * FROM {{ ref('stg_customers') }}
),

joined AS (
    SELECT
        o.id as order_id,
        o.order_date,
        o.status,
        c.id as customer_id,
        c.name as customer_name,
        c.email as customer_email
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
)

SELECT * FROM joined`;
        }
        
        if (filePath.includes('marts')) {
          return `-- Mart model for business reporting
WITH order_data AS (
    SELECT * FROM {{ ref('int_orders') }}
),

final AS (
    SELECT
        order_id,
        customer_id,
        customer_name,
        order_date,
        status,
        -- Additional business logic and metrics
        CASE 
            WHEN status = 'completed' THEN 'Successful'
            WHEN status = 'returned' THEN 'Returned'
            ELSE 'In Process' 
        END as order_status_category
    FROM order_data
)

SELECT * FROM final`;
        }
        
        if (filePath.includes('tests')) {
          return `-- Test to ensure values are positive
SELECT
    *
FROM {{ ref('fct_orders') }}
WHERE order_amount <= 0`;
        }
      }
      
      if (fileExtension === 'yml') {
        return `version: 2

models:
  - name: ${filePath.split('/').pop()?.replace('.yml', '')}
    description: "This schema file describes the ${filePath.split('/')[1]} models"
    columns:
      - name: id
        description: "Primary key"
        tests:
          - unique
          - not_null
      - name: name
        description: "Name field"
      - name: created_at
        description: "Timestamp when record was created"`;
      }
      
      if (fileExtension === 'csv') {
        return `country_code,country_name,region
US,United States,North America
CA,Canada,North America
UK,United Kingdom,Europe
DE,Germany,Europe
FR,France,Europe
JP,Japan,Asia
CN,China,Asia
AU,Australia,Oceania
BR,Brazil,South America
ZA,South Africa,Africa`;
      }
      
      // Default content for any other file
      return `// Content for ${filePath}
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

  const formatCodeWithLineNumbers = (content: string): JSX.Element => {
    const lines = content.split('\n');
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
    } else if (fileExtension === 'yml' || fileExtension === 'yaml') {
      language = 'language-yaml';
    } else if (fileExtension === 'json') {
      language = 'language-json';
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
      <div className="flex">
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
    // Simulate documentation content
    return `
      <h1>Documentation for ${filePath}</h1>
      <p>This is a sample documentation for the file ${filePath}</p>
    `;
  };

  const getMockLineageData = (filePath: string) => {
    // Simulate lineage data
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
    // Render lineage data
    return (
      <div>
        <h2>Lineage</h2>
        <ul>
          {lineageData.map((item, index) => (
            <li key={index}>
              <span>{item.name}</span>
              <span className="ml-2">{item.type}</span>
              <ul>
                {item.columns.map((column, index) => (
                  <li key={index}>
                    <span>{column}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
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
                            <div className="code-container">
                              <style jsx>{`
                                .code-container {
                                  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
                                  font-size: 13px;
                                  line-height: 1.5;
                                  tab-size: 2;
                                }
                                
                                /* SQL Syntax Highlighting */
                                .language-sql .keyword { color: #0550AE; font-weight: bold; }
                                .language-sql .function { color: #6F42C1; }
                                .language-sql .string { color: #24292F; }
                                .language-sql .number { color: #0550AE; }
                                .language-sql .operator { color: #CF222E; }
                                .language-sql .comment { color: #6A737D; font-style: italic; }
                                
                                /* Python Syntax Highlighting */
                                .language-python .keyword { color: #0550AE; font-weight: bold; }
                                .language-python .function { color: #6F42C1; }
                                .language-python .string { color: #0A3069; }
                                .language-python .number { color: #0550AE; }
                                .language-python .comment { color: #6A737D; font-style: italic; }
                                
                                /* General Code Styling */
                                .code-block {
                                  padding: 1rem;
                                  background-color: #F6F8FA;
                                  border-radius: 0.375rem;
                                  overflow-x: auto;
                                }
                              `}</style>
                              
                              <div className="code-block">
                                {formatCodeWithLineNumbers(selectedFile.content || '')}
                              </div>
                            </div>
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
