import { useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { toPng, toSvg } from 'html-to-image';
import { saveAs } from 'file-saver';
import { Node, Edge } from 'reactflow';

interface LineageExportProps {
  nodes: Node[];
  edges: Edge[];
  connectionName: string;
}

export default function LineageExport({ nodes, edges, connectionName }: LineageExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportToPng = async () => {
    try {
      setExporting(true);
      const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
      if (!reactFlowElement) return;

      const dataUrl = await toPng(reactFlowElement, {
        backgroundColor: '#f9fafb',
        quality: 1.0,
        pixelRatio: 2
      });

      saveAs(dataUrl, `${connectionName}-lineage-${Date.now()}.png`);
    } catch (error) {
      console.error('Failed to export PNG:', error);
      alert('Failed to export image. Please try again.');
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  const exportToSvg = async () => {
    try {
      setExporting(true);
      const reactFlowElement = document.querySelector('.react-flow') as HTMLElement;
      if (!reactFlowElement) return;

      const dataUrl = await toSvg(reactFlowElement, {
        backgroundColor: '#f9fafb',
      });

      saveAs(dataUrl, `${connectionName}-lineage-${Date.now()}.svg`);
    } catch (error) {
      console.error('Failed to export SVG:', error);
      alert('Failed to export SVG. Please try again.');
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  const exportToJson = () => {
    try {
      setExporting(true);
      const data = {
        metadata: {
          exportedAt: new Date().toISOString(),
          connection: connectionName,
          totalNodes: nodes.length,
          totalEdges: edges.length
        },
        nodes: nodes.map(node => ({
          id: node.id,
          name: node.data.name,
          type: node.data.type,
          position: node.position,
          upstreamCount: node.data.stats?.upstreamCount || 0,
          downstreamCount: node.data.stats?.downstreamCount || 0,
          columns: node.data.columns || []
        })),
        edges: edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          label: edge.label,
          type: edge.type
        }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      saveAs(blob, `${connectionName}-lineage-${Date.now()}.json`);
    } catch (error) {
      console.error('Failed to export JSON:', error);
      alert('Failed to export JSON. Please try again.');
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  const exportToMarkdown = () => {
    try {
      setExporting(true);
      let markdown = `# Data Lineage: ${connectionName}\n\n`;
      markdown += `**Exported:** ${new Date().toLocaleString()}\n\n`;
      markdown += `**Statistics:**\n`;
      markdown += `- Models: ${nodes.length}\n`;
      markdown += `- Dependencies: ${edges.length}\n\n`;

      markdown += `## Models\n\n`;
      nodes.forEach(node => {
        markdown += `### ${node.data.name}\n`;
        markdown += `- Type: \`${node.data.type}\`\n`;
        markdown += `- Upstream: ${node.data.stats?.upstreamCount || 0} models\n`;
        markdown += `- Downstream: ${node.data.stats?.downstreamCount || 0} models\n`;
        
        if (node.data.columns && node.data.columns.length > 0) {
          markdown += `- Columns:\n`;
          node.data.columns.forEach((col: any) => {
            markdown += `  - \`${col.name}\` (${col.data_type || 'unknown'})\n`;
          });
        }
        markdown += `\n`;
      });

      markdown += `## Dependencies\n\n`;
      markdown += `| Source | Target |\n`;
      markdown += `|--------|--------|\n`;
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        markdown += `| ${sourceNode?.data.name || edge.source} | ${targetNode?.data.name || edge.target} |\n`;
      });

      const blob = new Blob([markdown], { type: 'text/markdown' });
      saveAs(blob, `${connectionName}-lineage-${Date.now()}.md`);
    } catch (error) {
      console.error('Failed to export Markdown:', error);
      alert('Failed to export Markdown. Please try again.');
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {exporting ? (
          <>
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>

      {isOpen && !exporting && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={exportToPng}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="text-lg">📷</span>
              <span>PNG Image</span>
            </button>
            <button
              onClick={exportToSvg}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="text-lg">🎨</span>
              <span>SVG Vector</span>
            </button>
            <button
              onClick={exportToJson}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="text-lg">📊</span>
              <span>JSON Data</span>
            </button>
            <button
              onClick={exportToMarkdown}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="text-lg">📝</span>
              <span>Markdown</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
