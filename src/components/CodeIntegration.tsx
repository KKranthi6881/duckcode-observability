import React, { useEffect, useState } from 'react';
import { Code, Bot, Zap, Search, Network } from 'lucide-react';
// Sample SQL code snippets showing AI assistance
const codeSnippets = [{
  code: `SELECT * FROM orders
WHERE order_date > '2023-01-01'
`,
  suggestion: `-- AI Suggestion: Add specific columns and optimize date filter
SELECT 
  order_id,
  customer_id,
  order_date,
  total_amount
FROM orders
WHERE order_date BETWEEN '2023-01-01' AND CURRENT_DATE
ORDER BY order_date DESC
LIMIT 100`
}, {
  code: `-- Need to find customers who haven't made a purchase in 30 days`,
  suggestion: `-- AI Suggestion: Implementing customer inactivity query
SELECT 
  c.customer_id,
  c.customer_name,
  c.email,
  MAX(o.order_date) as last_order_date,
  DATEDIFF(CURRENT_DATE, MAX(o.order_date)) as days_inactive
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.customer_name, c.email
HAVING MAX(o.order_date) < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
   OR MAX(o.order_date) IS NULL
ORDER BY last_order_date ASC`
}, {
  code: `-- Need to calculate revenue by product category`,
  suggestion: `-- AI Suggestion: Detailed revenue analysis by category with growth metrics
SELECT 
  pc.category_name,
  SUM(oi.quantity * oi.unit_price) as total_revenue,
  COUNT(DISTINCT o.order_id) as order_count,
  COUNT(DISTINCT o.customer_id) as customer_count,
  SUM(oi.quantity * oi.unit_price) / COUNT(DISTINCT o.order_id) as avg_order_value
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN products p ON oi.product_id = p.product_id
JOIN product_categories pc ON p.category_id = pc.category_id
WHERE o.order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)
GROUP BY pc.category_name
ORDER BY total_revenue DESC`
}];
export function CodeIntegration() {
  const [currentSnippet, setCurrentSnippet] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lineageVisible, setLineageVisible] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setShowSuggestion(true);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setTimeout(() => {
          setLineageVisible(true);
          setTimeout(() => {
            setShowSuggestion(false);
            setLineageVisible(false);
            setCurrentSnippet(prev => (prev + 1) % codeSnippets.length);
          }, 3000);
        }, 2000);
      }, 1500);
    }, 7000);
    return () => clearInterval(timer);
  }, []);
  return <div id="integration" className="relative py-20 bg-slate-900 overflow-hidden sm:py-28">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMTI1MjkiIGZpbGwtb3BhY2l0eT0iMC4zIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0wLTZoLTJWNmgydjR6bTAgMjRoLTJ2LTRoMnY0em0wIDZoLTJ2LTRoMnY0em0wIDZoLTJ2LTRoMnY0em0wIDZoLTJ2LTRoMnY0em0tNi0yNGgtNHYtMmg0djJ6bS02IDBoLTR2LTJoNHYyem0tNiAwSDE0di0yaDR2MnptLTYgMEg4di0yaDR2MnptMjQgMGgtNHYtMmg0djJ6bTYgMGgtNHYtMmg0djJ6bTYgMGgtNHYtMmg0djJ6bTYgMGgtNHYtMmg0djJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-10" />
      </div>
      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="animate-fade-in">
              <div className="flex items-center space-x-2">
                <Bot className="h-6 w-6 text-[#2AB7A9] animate-bounce" />
                <h2 className="text-base font-semibold text-[#2AB7A9] uppercase tracking-wide">
                  AI-Powered IDE
                </h2>
              </div>
              <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                Develop data solutions{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5B72F] to-[#2AB7A9]">
                  10x faster
                </span>
              </p>
              <p className="mt-4 text-lg text-slate-300">
                Our intelligent VS Code extension brings AI assistance, data
                understanding, and validation directly into your development
                workflow.
              </p>
              <div className="mt-8 space-y-6">
                {[{
                icon: Bot,
                title: 'AI SQL Generation',
                description: 'Transform natural language requests into optimized SQL queries with context-aware AI assistance.'
              }, {
                icon: Search,
                title: 'Data Lineage In-Editor',
                description: 'See where your data comes from and where it goes without leaving your code editor.'
              }, {
                icon: Zap,
                title: 'Real-Time Validation',
                description: 'Catch schema issues, semantic errors, and quality problems before they reach production.'
              }].map((feature, index) => <div key={feature.title} className="flex p-4 rounded-lg hover:bg-slate-800/50 transition-colors duration-200 animate-fade-in" style={{
                animationDelay: `${(index + 1) * 200}ms`
              }}>
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-r from-[#F5B72F] to-[#F5B72F]/80 text-slate-900 shadow-lg">
                        <feature.icon className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-white">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>)}
              </div>
              <div className="mt-10 animate-fade-in animation-delay-700">
                <a href="#" className="group inline-flex items-center px-6 py-4 border border-transparent text-base font-medium rounded-lg shadow-lg text-slate-900 bg-gradient-to-r from-[#F5B72F] to-[#F5B72F]/80 hover:shadow-xl transition-all duration-200 hover:scale-105">
                  <Code className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  Install VS Code Extension
                </a>
              </div>
            </div>
          </div>
          <div className="mt-12 lg:mt-0 lg:col-span-7">
            <div className="relative animate-fade-in animation-delay-300">
              <div className="aspect-w-5 aspect-h-3 rounded-xl shadow-2xl overflow-hidden bg-[#1E1E1E] ring-1 ring-slate-700">
                <div className="p-4 h-full">
                  {/* Editor header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div className="h-3 w-3 rounded-full bg-[#F5B72F] animate-pulse"></div>
                        <div className="text-xs text-slate-400">
                          DuckCode AI
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                        analytics_query.sql
                      </div>
                    </div>
                  </div>
                  {/* Code editor */}
                  <div className="font-mono text-sm overflow-hidden space-y-2">
                    {/* Original code */}
                    <div className="text-slate-300 mb-3">
                      <pre className="whitespace-pre-wrap">
                        {codeSnippets[currentSnippet].code}
                      </pre>
                    </div>
                    {/* AI Suggestion */}
                    {showSuggestion && <div className="relative mt-4 p-4 bg-slate-800/50 rounded-lg border border-[#F5B72F]/30">
                        <div className="absolute -top-2 left-3 px-2 bg-[#1E1E1E] text-xs text-[#F5B72F] flex items-center space-x-1">
                          <Bot className="h-3 w-3" />
                          <span>AI Assistant</span>
                        </div>
                        <div className="text-slate-300">
                          <span className={isTyping ? 'animate-typing' : ''}>
                            {codeSnippets[currentSnippet].suggestion}
                          </span>
                          {isTyping && <span className="inline-block w-2 h-4 ml-1 bg-[#F5B72F] animate-caret-blink"></span>}
                        </div>
                        {!isTyping && <div className="mt-3 flex space-x-2">
                            <button className="px-3 py-1 bg-[#F5B72F] text-xs text-slate-900 rounded hover:bg-[#F5B72F]/90 transition-colors">
                              Accept
                            </button>
                            <button className="px-3 py-1 bg-slate-700 text-xs text-slate-300 rounded hover:bg-slate-600 transition-colors">
                              Modify
                            </button>
                            <button className="px-3 py-1 bg-slate-700 text-xs text-slate-300 rounded hover:bg-slate-600 transition-colors">
                              Reject
                            </button>
                          </div>}
                      </div>}
                    {/* Data lineage visualization */}
                    {lineageVisible && <div className="mt-4 p-3 bg-slate-800/30 rounded-lg border border-[#2AB7A9]/30">
                        <div className="flex items-center mb-2">
                          <Network className="h-4 w-4 text-[#2AB7A9] mr-2" />
                          <span className="text-xs text-[#2AB7A9]">
                            Column Lineage
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                            <span>customers.customer_id</span>
                          </div>
                          <div className="flex-1 mx-3 border-t border-dashed border-blue-400/30"></div>
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                            <span>orders.customer_id</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 rounded-full bg-green-400"></div>
                            <span>products.category_id</span>
                          </div>
                          <div className="flex-1 mx-3 border-t border-dashed border-green-400/30"></div>
                          <div className="flex items-center space-x-2">
                            <div className="h-2 w-2 rounded-full bg-green-400"></div>
                            <span>product_categories.category_id</span>
                          </div>
                        </div>
                      </div>}
                  </div>
                </div>
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-[#F5B72F]/10 rounded-full mix-blend-screen filter blur-xl animate-blob"></div>
              <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-[#2AB7A9]/10 rounded-full mix-blend-screen filter blur-xl animate-blob animation-delay-2000"></div>
            </div>
          </div>
        </div>
      </div>
    </div>;
}