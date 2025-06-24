import React from 'react';
import { Copy } from 'lucide-react';

interface CodeViewerProps {
  selectedFileContent: string;
  fileName?: string;
  onCopy: (content: string) => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  selectedFileContent,
  fileName,
  onCopy,
}) => {
  const getLanguageColors = (fileExtension?: string) => {
    switch (fileExtension) {
      case 'sql':
        return {
          keywords: 'text-blue-400 font-semibold',
          functions: 'text-purple-400 font-medium',
          operators: 'text-red-400 font-medium',
          strings: 'text-green-300',
          numbers: 'text-orange-400 font-medium',
          comments: 'text-gray-500 italic',
          identifiers: 'text-cyan-300',
          types: 'text-yellow-400 font-medium'
        };
      case 'py':
      case 'ipynb':
        return {
          keywords: 'text-blue-400 font-semibold',
          functions: 'text-yellow-300 font-medium',
          strings: 'text-green-300',
          numbers: 'text-orange-400 font-medium',
          comments: 'text-gray-500 italic',
          decorators: 'text-pink-400 font-medium',
          booleans: 'text-purple-400 font-medium',
          operators: 'text-red-400'
        };
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return {
          keywords: 'text-blue-400 font-semibold',
          functions: 'text-yellow-300 font-medium',
          strings: 'text-green-300',
          numbers: 'text-orange-400 font-medium',
          comments: 'text-gray-500 italic',
          booleans: 'text-purple-400 font-medium',
          operators: 'text-red-400',
          types: 'text-cyan-400 font-medium'
        };
      case 'json':
        return {
          keys: 'text-blue-300 font-medium',
          strings: 'text-green-300',
          numbers: 'text-orange-400 font-medium',
          booleans: 'text-purple-400 font-medium',
          comments: 'text-gray-500 italic'
        };
      default:
        return {
          keywords: 'text-blue-400 font-semibold',
          strings: 'text-green-300',
          comments: 'text-gray-500 italic',
          numbers: 'text-orange-400 font-medium',
          operators: 'text-red-400',
          functions: 'text-yellow-300 font-medium',
          identifiers: 'text-cyan-300'
        };
    }
  };

  const formatCodeWithSyntaxHighlighting = (code: string, fileName?: string) => {
    const lines = code.split('\n');
    const fileExtension = fileName?.split('.').pop()?.toLowerCase();
    const colors = getLanguageColors(fileExtension);
    
    const highlightSyntax = (line: string, lineNumber: number) => {
      if (line.trim() === '') {
        return <span>&nbsp;</span>;
      }

      // Handle different comment types - return styled JSX directly
      if (line.trim().startsWith('--') || line.trim().startsWith('#') || line.trim().startsWith('//')) {
        return <span className={colors.comments}>{line}</span>;
      }
      
      // Handle block comments
      if (line.includes('/*') || line.includes('*/') || line.includes('"""') || line.includes("'''")) {
        return <span className={colors.comments}>{line}</span>;
      }

      // Enhanced tokenization with better operator handling
      const tokens = line.split(/(\s+|[().,;=<>!+\-*/%]|['"``].*?['"``])/);
      
      return (
        <span>
          {tokens.map((token, index) => {
            if (!token.trim()) {
              return <span key={index}>{token}</span>;
            }

            // SQL Highlighting
            if (fileExtension === 'sql') {
              // SQL Keywords (blue)
              const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'ON', 'GROUP', 'ORDER', 'BY', 'HAVING', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'DISTINCT', 'TOP', 'LIMIT', 'OFFSET', 'FETCH', 'FIRST', 'WITH', 'RECURSIVE', 'CTE'];
              if (sqlKeywords.includes(token.toUpperCase())) {
                return <span key={index} className={colors.keywords}>{token}</span>;
              }
              
              // SQL Functions (purple)
              const sqlFunctions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'SQRT', 'POWER', 'LEN', 'LENGTH', 'SUBSTRING', 'SUBSTR', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'CONCAT', 'COALESCE', 'ISNULL', 'NULLIF', 'CAST', 'CONVERT', 'DATEPART', 'DATEDIFF', 'GETDATE', 'NOW', 'CURRENT_TIMESTAMP', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE'];
              if (sqlFunctions.includes(token.toUpperCase())) {
                return <span key={index} className={colors.functions}>{token}</span>;
              }
              
              // SQL Operators (red)
              const sqlOperators = ['=', '>', '<', '>=', '<=', '!=', '<>', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', '+', '-', '*', '/', '%'];
              if (sqlOperators.includes(token.toUpperCase()) || ['=', '>', '<', '>=', '<=', '!=', '<>', '+', '-', '*', '/', '%'].includes(token)) {
                return <span key={index} className={colors.operators}>{token}</span>;
              }
              
              // SQL Data Types (yellow)
              const sqlTypes = ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'VARCHAR', 'CHAR', 'TEXT', 'NVARCHAR', 'NCHAR', 'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'TIMESTAMP', 'BOOLEAN', 'BIT', 'BINARY', 'VARBINARY', 'UUID', 'UNIQUEIDENTIFIER'];
              if (sqlTypes.includes(token.toUpperCase())) {
                return <span key={index} className={colors.types}>{token}</span>;
              }
              
              // SQL Identifiers (table.column format) (cyan)
              if (token.includes('.') && !token.startsWith('.') && !token.endsWith('.')) {
                return <span key={index} className={colors.identifiers}>{token}</span>;
              }
            }
            
            // Python Highlighting
            else if (fileExtension === 'py' || fileExtension === 'ipynb') {
              // Python Keywords (blue)
              const pythonKeywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'break', 'continue', 'pass', 'raise', 'assert', 'global', 'nonlocal', 'lambda', 'async', 'await'];
              if (pythonKeywords.includes(token)) {
                return <span key={index} className={colors.keywords}>{token}</span>;
              }
              
              // Python Booleans/None (purple)
              const pythonBooleans = ['True', 'False', 'None'];
              if (pythonBooleans.includes(token)) {
                return <span key={index} className={colors.booleans}>{token}</span>;
              }
              
              // Python Decorators (pink)
              if (token.startsWith('@')) {
                return <span key={index} className={colors.decorators}>{token}</span>;
              }
              
              // Python Operators (red)
              const pythonOperators = ['+', '-', '*', '/', '//', '%', '**', '=', '==', '!=', '<', '>', '<=', '>=', 'and', 'or', 'not', 'in', 'is'];
              if (pythonOperators.includes(token)) {
                return <span key={index} className={colors.operators}>{token}</span>;
              }
            }
            
            // JavaScript/TypeScript Highlighting
            else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension || '')) {
              // JS/TS Keywords (blue)
              const jsKeywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'typeof', 'instanceof', 'class', 'extends', 'import', 'export', 'from', 'as', 'async', 'await', 'Promise'];
              if (jsKeywords.includes(token)) {
                return <span key={index} className={colors.keywords}>{token}</span>;
              }
              
              // JS/TS Booleans (purple)
              const jsBooleans = ['true', 'false', 'null', 'undefined'];
              if (jsBooleans.includes(token)) {
                return <span key={index} className={colors.booleans}>{token}</span>;
              }
              
              // JS/TS Types (cyan) - TypeScript specific
              const jsTypes = ['string', 'number', 'boolean', 'object', 'array', 'void', 'any', 'unknown', 'never', 'interface', 'type', 'enum'];
              if (jsTypes.includes(token) && (fileExtension === 'ts' || fileExtension === 'tsx')) {
                return <span key={index} className={colors.types}>{token}</span>;
              }
              
              // JS/TS Operators (red)
              const jsOperators = ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '%='];
              if (jsOperators.includes(token)) {
                return <span key={index} className={colors.operators}>{token}</span>;
              }
            }

            // JSON Highlighting
            else if (fileExtension === 'json') {
              // JSON Keys (blue) - quoted strings followed by colon
              if (token.match(/^".*":$/)) {
                return <span key={index} className={colors.keys}>{token}</span>;
              }
              
              // JSON Booleans (purple)
              if (['true', 'false', 'null'].includes(token)) {
                return <span key={index} className={colors.booleans}>{token}</span>;
              }
            }

            // Universal patterns for all languages
            
            // Strings (green) - enhanced detection
            if ((token.startsWith('"') && token.endsWith('"')) || 
                (token.startsWith("'") && token.endsWith("'")) || 
                (token.startsWith('`') && token.endsWith('`'))) {
              return <span key={index} className={colors.strings}>{token}</span>;
            }

            // Numbers (orange) - enhanced detection
            if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(token)) {
              return <span key={index} className={colors.numbers}>{token}</span>;
            }

            // Function calls (yellow) - words followed by parentheses
            if (colors.functions && /^[a-zA-Z_][a-zA-Z0-9_]*(?=\()/.test(token)) {
              return <span key={index} className={colors.functions}>{token}</span>;
            }

            // Default: return token as-is
            return <span key={index}>{token}</span>;
          })}
        </span>
      );
    };

    return (
      <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-sm text-gray-400 ml-4">{fileName || 'code'}</span>
          </div>
          <div className="text-xs text-gray-500">
            {fileExtension?.toUpperCase() || 'TEXT'}
          </div>
        </div>
        <pre className="text-xs font-mono leading-normal">
          {lines.map((line, index) => (
            <div key={index} className="flex hover:bg-gray-800/30 transition-colors">
              <span className="text-right pr-3 py-1 text-gray-400 select-none w-10 bg-gray-800/20 border-r border-gray-600 flex-shrink-0 text-xs font-medium">
                {index + 1}
              </span>
              <span className="flex-1 px-3 py-0.5 whitespace-pre-wrap">
                {line.trim() === '' ? ' ' : highlightSyntax(line, index + 1)}
              </span>
            </div>
          ))}
        </pre>
      </div>
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => onCopy(selectedFileContent)}
        className="absolute top-2 right-2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 hover:text-gray-800 transition-colors z-20"
        title="Copy code"
      >
        <Copy className="h-4 w-4" />
      </button>
      {formatCodeWithSyntaxHighlighting(selectedFileContent, fileName)}
    </div>
  );
}; 