import React from 'react';

export const formatCodeWithSyntaxHighlighting = (code: string, fileName?: string): React.ReactNode => {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  const lines = code.split('\n');
  
  const highlightLine = (line: string): React.ReactNode => {
    if (!line.trim()) return <span>&nbsp;</span>;
    
    // Simple word-based highlighting that works reliably
    const words = line.split(/(\s+)/); // Split on whitespace but keep the whitespace
    
    return (
      <span>
        {words.map((word, i) => {
          const trimmedWord = word.trim();
          
          // JavaScript/TypeScript keywords
          if ((extension === 'js' || extension === 'jsx' || extension === 'ts' || extension === 'tsx') && 
              ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'extends', 'implements', 'interface', 'type', 'enum'].includes(trimmedWord)) {
            return <span key={i} style={{color: '#ff79c6'}}>{word}</span>;
          }
          
          // SQL keywords
          if (extension === 'sql' && 
              ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'UNION', 'ALL', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'EXISTS', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'].includes(trimmedWord.toUpperCase())) {
            return <span key={i} style={{color: '#ff79c6'}}>{word}</span>;
          }
          
          // Python keywords
          if (extension === 'py' && 
              ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'import', 'from', 'as', 'return', 'yield', 'lambda', 'with', 'assert', 'break', 'continue', 'pass', 'global', 'nonlocal', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'].includes(trimmedWord)) {
            return <span key={i} style={{color: '#ff79c6'}}>{word}</span>;
          }
          
          // Strings (simple detection)
          if ((trimmedWord.startsWith('"') && trimmedWord.endsWith('"')) ||
              (trimmedWord.startsWith("'") && trimmedWord.endsWith("'")) ||
              (trimmedWord.startsWith('`') && trimmedWord.endsWith('`'))) {
            return <span key={i} style={{color: '#f1fa8c'}}>{word}</span>;
          }
          
          // Comments
          if (trimmedWord.startsWith('//') || trimmedWord.startsWith('#') || trimmedWord.startsWith('--')) {
            return <span key={i} style={{color: '#6272a4', fontStyle: 'italic'}}>{word}</span>;
          }
          
          // Numbers
          if (/^\d+\.?\d*$/.test(trimmedWord)) {
            return <span key={i} style={{color: '#bd93f9'}}>{word}</span>;
          }
          
          // Default
          return <span key={i}>{word}</span>;
        })}
      </span>
    );
  };
  
  return lines.map((line, index) => (
    <div key={index}>
      {highlightLine(line)}
    </div>
  ));
}; 