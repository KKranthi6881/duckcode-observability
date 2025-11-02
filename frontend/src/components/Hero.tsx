import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Database, Network, GitBranch, BarChart3, Shield, Zap, Code2, Bot, CheckCircle2 } from 'lucide-react';

export function Hero() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      {/* Gradient background effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#2AB7A9]/20 rounded-full filter blur-[128px]" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full filter blur-[128px]" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-[#F5B72F]/10 rounded-full filter blur-[128px]" />
      </div>
      
      {/* Hero Section */}
      <div className="relative container mx-auto px-4 pt-32 pb-20 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2AB7A9]/10 border border-[#2AB7A9]/20 mb-8">
            <Sparkles className="w-4 h-4 text-[#2AB7A9]" />
            <span className="text-sm font-medium text-gray-300">Enterprise AI IDE + Data Observability Platform</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            AI-Powered IDE for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2AB7A9] via-[#F5B72F] to-purple-500">
              Data Engineering Teams
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-gray-400 mb-8 max-w-4xl mx-auto leading-relaxed">
            Build, test, and monitor data pipelines with AI-assisted development. 
            <span className="text-white font-semibold"> Auto-generate code, docs, and tests</span> while maintaining 
            <span className="text-[#2AB7A9]"> enterprise-grade security</span> and team collaboration.
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-12 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#2AB7A9]" />
              <span>Offline Lineage Tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#2AB7A9]" />
              <span>Auto Documentation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#2AB7A9]" />
              <span>AI Code Generation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#2AB7A9]" />
              <span>Enterprise Team Sync</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#2AB7A9] to-[#F5B72F] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-[#2AB7A9]/20"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 px-8 py-4 bg-transparent border-2 border-gray-700 text-white font-semibold rounded-lg hover:border-[#2AB7A9] transition-colors"
            >
              Watch Demo
              <Bot className="w-5 h-5" />
            </a>
          </div>

          {/* Integration Logos */}
          <p className="text-sm text-gray-500 mb-6 uppercase tracking-wider">
            Works with your data stack
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            {[
              { name: 'dbt', icon: Database },
              { name: 'Snowflake', icon: Database },
              { name: 'Databricks', icon: Database },
              { name: 'Airflow', icon: Network },
              { name: 'Redshift', icon: Database },
              { name: 'Azure SQL', icon: Database },
              { name: 'MySQL', icon: Database }
            ].map((integration) => (
              <div key={integration.name} className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors">
                <integration.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{integration.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* IDE Preview Section */}
      <div className="relative container mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
            {/* Gradient border effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#2AB7A9]/20 via-purple-500/20 to-[#F5B72F]/20 blur-xl" />
            
            {/* IDE mockup */}
            <div className="relative bg-[#1e1e1e] p-1">
              <div className="bg-[#252526] rounded-lg overflow-hidden">
                {/* IDE Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#323233] border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#F5B72F]" />
                    <span className="text-xs text-gray-400">DuckCode AI Active</span>
                  </div>
                </div>
                
                {/* IDE Content */}
                <div className="p-6 font-mono text-sm">
                  <div className="text-gray-400 mb-4">-- AI-generated SQL query</div>
                  <div className="text-purple-400">SELECT</div>
                  <div className="text-gray-300 ml-4">customer_id,</div>
                  <div className="text-gray-300 ml-4">customer_name,</div>
                  <div className="text-gray-300 ml-4">
                    <span className="text-blue-400">SUM</span>(order_amount) 
                    <span className="text-purple-400"> AS </span>
                    total_revenue
                  </div>
                  <div className="text-purple-400 mt-2">FROM</div>
                  <div className="text-gray-300 ml-4">customers</div>
                  <div className="text-purple-400 mt-2">JOIN</div>
                  <div className="text-gray-300 ml-4">orders <span className="text-purple-400">ON</span> customers.id = orders.customer_id</div>
                  <div className="text-purple-400 mt-2">GROUP BY</div>
                  <div className="text-gray-300 ml-4">customer_id, customer_name</div>
                  <div className="text-purple-400 mt-2">ORDER BY</div>
                  <div className="text-gray-300 ml-4">total_revenue <span className="text-purple-400">DESC</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Core Features Section */}
      <div className="relative container mx-auto px-4 py-32 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Everything you need to build data products
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              From development to production monitoring, DuckCode provides enterprise-grade tools for modern data teams
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            {/* AI Code Generation */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 hover:border-[#2AB7A9]/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-[#2AB7A9] to-[#F5B72F] rounded-xl flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">AI Code Generation</h3>
              <p className="text-gray-400 mb-6">
                Generate SQL, dbt models, and data transformations with AI. Context-aware suggestions based on your schema and business logic.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">SQL</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">dbt</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Python</span>
              </div>
            </div>

            {/* Offline Lineage */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 hover:border-[#2AB7A9]/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-6">
                <GitBranch className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Offline Lineage Tracking</h3>
              <p className="text-gray-400 mb-6">
                Visualize column-level lineage without connecting to your warehouse. Trace data flow from source to dashboard instantly.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Column-level</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Impact Analysis</span>
              </div>
            </div>

            {/* Auto Documentation */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 hover:border-[#2AB7A9]/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-[#F5B72F] to-orange-500 rounded-xl flex items-center justify-center mb-6">
                <Code2 className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Auto Documentation</h3>
              <p className="text-gray-400 mb-6">
                AI-generated documentation for tables, columns, and transformations. Keep your data catalog always up-to-date.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Schema Docs</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Auto-sync</span>
              </div>
            </div>

            {/* Auto Testing */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 hover:border-[#2AB7A9]/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Automated Testing</h3>
              <p className="text-gray-400 mb-6">
                Generate data quality tests automatically. Catch issues before they reach production with AI-powered validation.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Data Quality</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">CI/CD</span>
              </div>
            </div>

            {/* Enterprise Team Sync */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 hover:border-[#2AB7A9]/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-6">
                <Network className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Enterprise Team Sync</h3>
              <p className="text-gray-400 mb-6">
                Real-time collaboration with version control. Share context, review changes, and maintain consistency across teams.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Git Integration</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">Code Review</span>
              </div>
            </div>

            {/* Security & Compliance */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 hover:border-[#2AB7A9]/50 transition-all group">
              <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Enterprise Security</h3>
              <p className="text-gray-400 mb-6">
                100% local processing. Your code and data never leave your infrastructure. SOC 2 compliant with SSO and RBAC.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">SOC 2</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">SSO</span>
                <span className="text-xs px-3 py-1 bg-gray-800 text-gray-400 rounded-full">RBAC</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="relative container mx-auto px-4 py-32 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Ship data products 10x faster
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              From idea to production in minutes, not weeks. AI-powered development with enterprise-grade observability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-[#2AB7A9] to-[#F5B72F] rounded-full flex items-center justify-center text-black font-bold text-xl">
                1
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 h-full">
                <h3 className="text-2xl font-bold text-white mb-4 mt-4">Connect Your Stack</h3>
                <p className="text-gray-400 mb-6">
                  Integrate with dbt, Snowflake, Databricks, Airflow, and more. DuckCode understands your entire data ecosystem.
                </p>
                <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-gray-400">
                  <div className="text-[#2AB7A9]">✓ Connected to Snowflake</div>
                  <div className="text-[#2AB7A9]">✓ dbt project synced</div>
                  <div className="text-[#2AB7A9]">✓ Lineage extracted</div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-[#2AB7A9] to-[#F5B72F] rounded-full flex items-center justify-center text-black font-bold text-xl">
                2
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 h-full">
                <h3 className="text-2xl font-bold text-white mb-4 mt-4">Build with AI</h3>
                <p className="text-gray-400 mb-6">
                  Generate code, tests, and documentation automatically. AI understands your schema, business logic, and best practices.
                </p>
                <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs">
                  <div className="text-gray-500 mb-2">// AI Generated</div>
                  <div className="text-purple-400">SELECT</div>
                  <div className="text-gray-300 ml-2">customer_id,</div>
                  <div className="text-gray-300 ml-2">SUM(revenue)</div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-[#2AB7A9] to-[#F5B72F] rounded-full flex items-center justify-center text-black font-bold text-xl">
                3
              </div>
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800 h-full">
                <h3 className="text-2xl font-bold text-white mb-4 mt-4">Monitor & Optimize</h3>
                <p className="text-gray-400 mb-6">
                  Real-time observability with automated alerts. Catch breaking changes before they impact stakeholders.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-400">All tests passing</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-400">No breaking changes</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-400">Quality checks OK</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Observability Section */}
      <div className="relative container mx-auto px-4 py-32 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Enterprise-grade observability
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Catch issues before they reach production. Full visibility into your data pipelines with real-time monitoring and automated alerts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Lineage Visualization */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <GitBranch className="w-8 h-8 text-[#2AB7A9]" />
                <h3 className="text-2xl font-bold text-white">Impact Analysis</h3>
              </div>
              <p className="text-gray-400 mb-6">
                Understand downstream impact of any change. Visualize column-level lineage across your entire data stack.
              </p>
              <div className="bg-gray-950 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">users.customer_id</span>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-400">orders.customer_id</span>
                </div>
                <div className="text-xs text-[#2AB7A9]">→ Impacts 12 downstream models</div>
              </div>
            </div>

            {/* Data Quality */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-[#F5B72F]" />
                <h3 className="text-2xl font-bold text-white">Data Quality Checks</h3>
              </div>
              <p className="text-gray-400 mb-6">
                Automated testing for schema changes, null values, duplicates, and custom business rules.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-gray-400">Schema validation passed</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-gray-400">No null values in key columns</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-gray-400">Freshness checks OK</span>
                </div>
              </div>
            </div>

            {/* Alerts & Monitoring */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-8 h-8 text-purple-500" />
                <h3 className="text-2xl font-bold text-white">Smart Alerts</h3>
              </div>
              <p className="text-gray-400 mb-6">
                Get notified about breaking changes, performance issues, and data anomalies before they impact users.
              </p>
              <div className="bg-gray-950 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">Recent Alerts</div>
                <div className="text-sm text-gray-400">✓ All systems operational</div>
              </div>
            </div>

            {/* Version Control */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <Code2 className="w-8 h-8 text-blue-500" />
                <h3 className="text-2xl font-bold text-white">Git Integration</h3>
              </div>
              <p className="text-gray-400 mb-6">
                Full version control with pull request reviews, automated testing, and deployment workflows.
              </p>
              <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs">
                <div className="text-gray-500">git commit -m "Add customer metrics"</div>
                <div className="text-[#2AB7A9] mt-2">✓ Tests passed • Ready to merge</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="relative container mx-auto px-4 py-32 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 border border-gray-800 text-center relative overflow-hidden">
            {/* Background gradient effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#2AB7A9]/10 via-purple-500/10 to-[#F5B72F]/10" />
            
            <div className="relative z-10">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Ready to transform your data workflow?
              </h2>
              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
                Join leading data teams using DuckCode to build, test, and monitor data products faster than ever.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-[#2AB7A9] to-[#F5B72F] text-black font-bold rounded-lg hover:opacity-90 transition-opacity text-lg shadow-lg shadow-[#2AB7A9]/20"
                >
                  Start Free Trial
                  <ArrowRight className="w-6 h-6" />
                </Link>
                <a
                  href="mailto:sales@duckcode.ai"
                  className="inline-flex items-center gap-2 px-10 py-5 bg-transparent border-2 border-gray-700 text-white font-bold rounded-lg hover:border-[#2AB7A9] transition-colors text-lg"
                >
                  Talk to Sales
                </a>
              </div>
              
              <p className="text-sm text-gray-500">
                14-day free trial • No credit card required • Enterprise support available
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}