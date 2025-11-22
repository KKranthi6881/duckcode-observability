import { motion } from 'framer-motion';
import Xarrow, { Xwrapper } from 'react-xarrows';
import { Database, FileText, GitBranch, BarChart3, Users, TrendingDown, Code2 } from 'lucide-react';
import { SiSnowflake, SiDbt, SiApacheairflow } from 'react-icons/si';

interface FlowNode {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  iconColor: string;
}

export function DataFlowDiagram() {
  const centerId = 'center-duckcode';

  const inputNodes: FlowNode[] = [
    { 
      id: 'snowflake', 
      icon: SiSnowflake, 
      label: 'Snowflake', 
      color: 'from-blue-400 to-blue-500',
      iconColor: 'text-[#29b5e8]'
    },
    { 
      id: 'dbt', 
      icon: SiDbt, 
      label: 'dbt', 
      color: 'from-orange-400 to-orange-500',
      iconColor: 'text-[#ff6a3c]'
    },
    { 
      id: 'sql', 
      icon: Database, 
      label: 'SQL', 
      color: 'from-indigo-400 to-indigo-500',
      iconColor: 'text-indigo-500'
    },
    { 
      id: 'airflow', 
      icon: SiApacheairflow, 
      label: 'Airflow', 
      color: 'from-cyan-400 to-cyan-500',
      iconColor: 'text-[#0094ce]'
    }
  ];

  const outputNodes: FlowNode[] = [
    { 
      id: 'docs', 
      icon: FileText, 
      label: 'Auto Docs', 
      color: 'from-emerald-400 to-emerald-500',
      iconColor: 'text-emerald-500'
    },
    { 
      id: 'lineage', 
      icon: GitBranch, 
      label: 'Lineage', 
      color: 'from-purple-400 to-purple-500',
      iconColor: 'text-purple-500'
    },
    { 
      id: 'analytics', 
      icon: BarChart3, 
      label: 'Catalog', 
      color: 'from-amber-400 to-amber-500',
      iconColor: 'text-amber-500'
    },
    { 
      id: 'team', 
      icon: Users, 
      label: 'Team Sync', 
      color: 'from-pink-400 to-pink-500',
      iconColor: 'text-pink-500'
    },
    { 
      id: 'cost', 
      icon: TrendingDown, 
      label: 'Cost Savings', 
      color: 'from-green-400 to-green-500',
      iconColor: 'text-green-500'
    }
  ];

  return (
    <Xwrapper>
      <div className="relative h-[600px] px-12 py-16">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-white to-emerald-50/30"></div>
      
      {/* Left Column - Inputs */}
      <div className="absolute left-12 top-16 z-10 flex w-56 flex-col gap-5">
        <div className="mb-3 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
          </motion.div>
        </div>
        {inputNodes.map((node, index) => (
          <motion.div
            key={node.id}
            id={`source-${node.id}`}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ 
              delay: index * 0.1, 
              duration: 0.6,
              type: "spring",
              stiffness: 100
            }}
            className="group relative"
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-4 shadow-lg backdrop-blur-sm transition-all hover:shadow-2xl"
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"></div>
              
              <div className="relative flex items-center gap-3">
                <div className={`rounded-xl bg-gradient-to-br ${node.color} p-3 shadow-md ring-2 ring-white/50`}>
                  <node.icon className="h-6 w-6 text-white drop-shadow-sm" />
                </div>
                <span className="text-sm font-bold text-gray-800">{node.label}</span>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* React-Xarrows Connections */}
      <div className="pointer-events-none">
        {inputNodes.map((node) => (
          <Xarrow
            key={`in-${node.id}`}
            start={`source-${node.id}`}
            end={centerId}
            startAnchor="right"
            endAnchor="left"
            path="smooth"
            curveness={0.7}
            color="#fb923c" // softer orange
            strokeWidth={2}
            headSize={0}
            dashness={{ strokeLen: 10, nonStrokeLen: 10 }}
            animateDrawing={false}
            zIndex={5}
          />
        ))}
        {outputNodes.map((node) => (
          <Xarrow
            key={`out-${node.id}`}
            start={centerId}
            end={`output-${node.id}`}
            startAnchor="right"
            endAnchor="left"
            path="smooth"
            curveness={0.7}
            color="#10b981"
            strokeWidth={3}
            headSize={0}
            dashness={{ strokeLen: 10, nonStrokeLen: 10 }}
            animateDrawing={false}
            zIndex={5}
          />
        ))}
      </div>

      {/* Center - DuckCode AI */}
      <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        {/* Center AI Node - Enhanced */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            duration: 1,
            type: "spring",
            stiffness: 80
          }}
          className="relative z-10"
        >
          {/* Outer glow ring */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -inset-6 rounded-full bg-gradient-to-br from-[#ff6a3c] to-[#d94a1e] blur-2xl"
          />
          
          {/* Main AI Node */}
          <motion.div
            id={centerId}
            animate={{
              boxShadow: [
                '0 16px 40px rgba(15,23,42,0.6)',
                '0 24px 60px rgba(15,23,42,0.8)',
                '0 16px 40px rgba(15,23,42,0.6)'
              ]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="relative rounded-[2rem] border border-white/10 bg-transparent px-0 py-0"
          >
            {/* Inner glow */}
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#0f172a] via-transparent to-[#020617]"></div>
            
            {/* IDE-style editor window */}
            <div className="relative w-[280px] rounded-2xl border border-white/10 bg-[#020617] shadow-xl overflow-hidden">
              {/* Editor header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/80"></span>
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80"></span>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></span>
                </div>
                <span className="text-[11px] font-medium text-slate-100">DuckCode IDE</span>
              </div>

              {/* Code content */}
              <div className="relative px-4 py-3 space-y-1.5 font-mono text-[11px] leading-relaxed">
                <div className="flex gap-3 text-slate-400">
                  <span className="w-4 text-right text-[10px] text-slate-600">1</span>
                  <span><span className="text-sky-400">SELECT</span> <span className="text-emerald-400">customer_id</span>, total_spend</span>
                </div>
                <div className="flex gap-3 text-slate-400">
                  <span className="w-4 text-right text-[10px] text-slate-600">2</span>
                  <span><span className="text-sky-400">FROM</span> analytics.customers</span>
                </div>
                <div className="relative flex gap-3 rounded-md bg-slate-800/70 px-2 py-1.5 text-slate-100">
                  <span className="w-4 text-right text-[10px] text-sky-400">3</span>
                  <span><span className="text-emerald-400">-- AI fix:</span> optimize filter and add safety limit</span>
                </div>
                <div className="flex gap-3 text-slate-400">
                  <span className="w-4 text-right text-[10px] text-slate-600">4</span>
                  <span><span className="text-sky-400">WHERE</span> last_order_at &gt; current_date - <span className="text-amber-300">interval '30 days'</span></span>
                </div>
                <div className="flex gap-3 text-slate-400">
                  <span className="w-4 text-right text-[10px] text-slate-600">5</span>
                  <span><span className="text-sky-400">LIMIT</span> <span className="text-emerald-400">500</span>;</span>
                </div>
              </div>

              {/* Footer status bar */}
              <div className="flex items-center justify-between border-t border-white/5 bg-slate-900/90 px-4 py-2 text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>AI assistant active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Code2 className="h-3 w-3 text-[#fb923c]" />
                  <span className="font-medium text-[#fb923c]">DuckCode AI</span>
                </div>
              </div>

              {/* Rotating rings - more visible */}
              <motion.div
                animate={{
                  scale: [1, 1.04, 1],
                  opacity: [0.2, 0.35, 0.2]
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-[#fb923c]/40"
              />
            </div>
          </motion.div>
          
          {/* Label */}
          <motion.div className="hidden" />
          
          {/* Processing indicator */}
          <motion.div
            className="absolute -right-3 -top-3 h-5 w-5 rounded-full border-2 border-white bg-green-400 shadow-lg"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity
            }}
          />
        </motion.div>
      </div>

      {/* Right Column - Outputs */}
      <div className="absolute right-12 top-16 z-10 flex w-56 flex-col gap-4">
        <div className="mb-2 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            
          </motion.div>
        </div>
        {outputNodes.map((node, index) => (
          <motion.div
            key={node.id}
            id={`output-${node.id}`}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ 
              delay: 0.5 + index * 0.08, 
              duration: 0.6,
              type: "spring",
              stiffness: 100
            }}
            className="group relative"
          >
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              className="relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-3.5 shadow-lg backdrop-blur-sm transition-all hover:shadow-2xl"
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-emerald-100/30 to-transparent transition-transform duration-500 group-hover:translate-x-full"></div>
              
              <div className="relative flex items-center gap-3">
                <div className={`rounded-xl bg-gradient-to-br ${node.color} p-2.5 shadow-md ring-2 ring-white/50`}>
                  <node.icon className="h-5 w-5 text-white drop-shadow-sm" />
                </div>
                <span className="text-sm font-bold text-gray-800">{node.label}</span>
              </div>

              {/* Hover indicator */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileHover={{ opacity: 1, scale: 1 }}
                className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400"
              />
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
    </Xwrapper>
  );
}
