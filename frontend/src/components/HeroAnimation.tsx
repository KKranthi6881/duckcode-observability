import { useEffect, useState } from 'react';
import { 
  Database, 
  GitBranch, 
  FileText, 
  Users, 
  BarChart3,
  Code2,
  TrendingDown
} from 'lucide-react';
import { SiSnowflake, SiDbt, SiApacheairflow } from 'react-icons/si';

interface Node {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  position: { x: number; y: number };
  color: string;
  type: 'input' | 'output' | 'center';
}

interface Connection {
  from: string;
  to: string;
  delay: number;
}

export function HeroAnimation() {
  const [activeConnections, setActiveConnections] = useState<string[]>([]);

  // Define nodes with better spacing
  const nodes: Node[] = [
    // Center - DuckCode Product
    {
      id: 'center',
      icon: Code2,
      label: 'DuckCode AI',
      position: { x: 50, y: 50 },
      color: 'from-[#ff6a3c] to-[#d94a1e]',
      type: 'center'
    },
    // Input nodes (left side) - better vertical spacing
    {
      id: 'sql',
      icon: Database,
      label: 'SQL',
      position: { x: 18, y: 20 },
      color: 'from-blue-400 to-blue-500',
      type: 'input'
    },
    {
      id: 'snowflake',
      icon: SiSnowflake,
      label: 'Snowflake',
      position: { x: 12, y: 45 },
      color: 'from-[#29b5e8] to-[#1e8cc7]',
      type: 'input'
    },
    {
      id: 'dbt',
      icon: SiDbt,
      label: 'dbt',
      position: { x: 18, y: 70 },
      color: 'from-[#ff6a3c] to-[#d94a1e]',
      type: 'input'
    },
    {
      id: 'airflow',
      icon: SiApacheairflow,
      label: 'Airflow',
      position: { x: 32, y: 12 },
      color: 'from-[#0094ce] to-[#007ab8]',
      type: 'input'
    },
    // Output nodes (right side) - better vertical spacing
    {
      id: 'docs',
      icon: FileText,
      label: 'Auto Docs',
      position: { x: 82, y: 15 },
      color: 'from-emerald-400 to-emerald-500',
      type: 'output'
    },
    {
      id: 'lineage',
      icon: GitBranch,
      label: 'Lineage',
      position: { x: 88, y: 35 },
      color: 'from-purple-400 to-purple-500',
      type: 'output'
    },
    {
      id: 'analytics',
      icon: BarChart3,
      label: 'Observability',
      position: { x: 88, y: 65 },
      color: 'from-amber-400 to-amber-500',
      type: 'output'
    },
    {
      id: 'team',
      icon: Users,
      label: 'Team Sync',
      position: { x: 82, y: 85 },
      color: 'from-pink-400 to-pink-500',
      type: 'output'
    },
    {
      id: 'cost',
      icon: TrendingDown,
      label: 'Cost Savings',
      position: { x: 68, y: 88 },
      color: 'from-green-400 to-green-500',
      type: 'output'
    }
  ];

  // Define connections
  const connections: Connection[] = [
    // Inputs to center
    { from: 'sql', to: 'center', delay: 0 },
    { from: 'snowflake', to: 'center', delay: 0.3 },
    { from: 'dbt', to: 'center', delay: 0.6 },
    { from: 'airflow', to: 'center', delay: 0.9 },
    // Center to outputs
    { from: 'center', to: 'docs', delay: 1.2 },
    { from: 'center', to: 'lineage', delay: 1.5 },
    { from: 'center', to: 'analytics', delay: 1.8 },
    { from: 'center', to: 'team', delay: 2.1 },
    { from: 'center', to: 'cost', delay: 2.4 }
  ];

  useEffect(() => {
    // Animate connections in sequence
    const timeouts: NodeJS.Timeout[] = [];
    
    connections.forEach(({ from, to, delay }) => {
      const timeout = setTimeout(() => {
        setActiveConnections(prev => [...prev, `${from}-${to}`]);
      }, delay * 1000);
      timeouts.push(timeout);
    });

    // Reset animation after complete cycle
    const resetTimeout = setTimeout(() => {
      setActiveConnections([]);
    }, 4000);

    // Loop animation
    const loopInterval = setInterval(() => {
      setActiveConnections([]);
      connections.forEach(({ from, to, delay }) => {
        setTimeout(() => {
          setActiveConnections(prev => [...prev, `${from}-${to}`]);
        }, delay * 1000);
      });
    }, 5000);

    return () => {
      timeouts.forEach(t => clearTimeout(t));
      clearTimeout(resetTimeout);
      clearInterval(loopInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getNodeById = (id: string) => nodes.find(n => n.id === id);

  const renderConnection = (from: string, to: string) => {
    const fromNode = getNodeById(from);
    const toNode = getNodeById(to);
    if (!fromNode || !toNode) return null;

    const isActive = activeConnections.includes(`${from}-${to}`);
    
    // Calculate control point for curved path
    const midX = (fromNode.position.x + toNode.position.x) / 2;
    const midY = (fromNode.position.y + toNode.position.y) / 2;
    
    return (
      <g key={`${from}-${to}`}>
        {/* Connection line with curve */}
        <path
          d={`M ${fromNode.position.x} ${fromNode.position.y} Q ${midX} ${midY} ${toNode.position.x} ${toNode.position.y}`}
          stroke={isActive ? '#ff6a3c' : '#d6d2c9'}
          strokeWidth={isActive ? '3' : '2'}
          fill="none"
          strokeLinecap="round"
          className="transition-all duration-500"
          style={{ opacity: isActive ? 1 : 0.3 }}
        />
        
        {/* Arrow marker */}
        <defs>
          <marker
            id={`arrowhead-${from}-${to}`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill={isActive ? '#ff6a3c' : '#d6d2c9'}
              className="transition-all duration-500"
            />
          </marker>
        </defs>
        
        <path
          d={`M ${fromNode.position.x} ${fromNode.position.y} Q ${midX} ${midY} ${toNode.position.x} ${toNode.position.y}`}
          stroke="transparent"
          strokeWidth="3"
          fill="none"
          markerEnd={`url(#arrowhead-${from}-${to})`}
        />
        
        {/* Animated particle */}
        {isActive && (
          <>
            <circle r="5" fill="#ff6a3c" className="drop-shadow-lg">
              <animateMotion
                dur="1.5s"
                repeatCount="1"
                path={`M ${fromNode.position.x} ${fromNode.position.y} Q ${midX} ${midY} ${toNode.position.x} ${toNode.position.y}`}
              />
            </circle>
            <circle r="8" fill="#ff6a3c" opacity="0.3" className="drop-shadow-lg">
              <animateMotion
                dur="1.5s"
                repeatCount="1"
                path={`M ${fromNode.position.x} ${fromNode.position.y} Q ${midX} ${midY} ${toNode.position.x} ${toNode.position.y}`}
              />
            </circle>
          </>
        )}
      </g>
    );
  };

  return (
    <div className="relative h-full w-full">
      {/* Background Flow Zones */}
      <div className="absolute left-[2%] top-[15%] h-[75%] w-[28%] rounded-3xl border-2 border-dashed border-blue-200/50 bg-blue-50/30"></div>
      <div className="absolute left-1/2 top-[15%] h-[75%] w-[20%] -translate-x-1/2 rounded-3xl border-2 border-[#ff6a3c]/30 bg-gradient-to-br from-[#fff4ee] to-[#ffe8dc]"></div>
      <div className="absolute right-[2%] top-[15%] h-[75%] w-[28%] rounded-3xl border-2 border-dashed border-emerald-200/50 bg-emerald-50/30"></div>
      
      {/* Flow Direction Labels */}
      <div className="absolute left-[8%] top-[5%] text-center">
        <div className="rounded-lg border border-blue-200 bg-white px-4 py-2 shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Data Sources</p>
          <p className="text-[10px] text-[#a39c92]">Your Stack</p>
        </div>
      </div>
      
      <div className="absolute left-1/2 top-[5%] -translate-x-1/2 text-center">
        <div className="rounded-lg bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-4 py-2 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-white">AI Processing</p>
          <p className="text-[10px] text-white/80">Local & Fast</p>
        </div>
      </div>
      
      <div className="absolute right-[8%] top-[5%] text-center">
        <div className="rounded-lg border border-emerald-200 bg-white px-4 py-2 shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Outputs</p>
          <p className="text-[10px] text-[#a39c92]">Team Insights</p>
        </div>
      </div>

      {/* SVG for connections */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff6a3c" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#d94a1e" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        
        {connections.map(({ from, to }) => renderConnection(from, to))}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => {
        const Icon = node.icon;
        const isCenter = node.type === 'center';
        const size = isCenter ? 'w-24 h-24' : 'w-20 h-20';
        const iconSize = isCenter ? 'h-12 w-12' : 'h-9 w-9';
        const isActive = activeConnections.some(conn => 
          conn.startsWith(node.id) || conn.endsWith(node.id)
        );
        
        return (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transform"
            style={{
              left: `${node.position.x}%`,
              top: `${node.position.y}%`
            }}
          >
            {/* Icon container with glow effect */}
            <div
              className={`
                ${size} 
                relative 
                flex items-center justify-center 
                rounded-2xl 
                bg-gradient-to-br ${node.color} 
                shadow-lg
                ${isCenter ? 'animate-pulse-slow shadow-[0_0_50px_rgba(255,106,60,0.6)]' : 'shadow-[0_10px_30px_rgba(0,0,0,0.15)]'}
                ${isActive ? 'scale-110 shadow-[0_15px_40px_rgba(255,106,60,0.4)]' : ''}
                transition-all duration-500 hover:scale-110
              `}
            >
              <Icon className={`${iconSize} text-white drop-shadow-md`} />
              
              {/* Rotating ring for center node */}
              {isCenter && (
                <>
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#ff6a3c]/30 animate-spin-slow" />
                  <div className="absolute -inset-3 rounded-2xl border border-[#ff6a3c]/20 animate-pulse-slow" />
                </>
              )}

              {/* Active pulse ring */}
              {isActive && !isCenter && (
                <div className="absolute -inset-2 rounded-2xl border-2 border-white/50 animate-ping" />
              )}
            </div>

            {/* Label with better styling */}
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <div className={`
                rounded-full px-3 py-1
                ${isCenter 
                  ? 'bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] text-white shadow-lg' 
                  : 'bg-white border-2 border-[#e1dcd3] text-[#161413] shadow-sm'
                }
              `}>
                <span className="text-xs font-bold">
                  {node.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
