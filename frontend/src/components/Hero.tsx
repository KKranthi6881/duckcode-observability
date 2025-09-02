import React from 'react';
import { Link } from 'react-router-dom';
import { Download, ArrowRight, Zap, Building, Code2, Wrench, Key, Shield, Users, Bot, Search, MessageCircle, ExternalLink, Video, FileText } from 'lucide-react';
import { CodeIntegration } from './CodeIntegration';

export function Hero() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* Modern AI-focused animated background */}
      <div className="absolute inset-0 z-0">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDYwIDAgTCAwIDAgMCA2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZTJlOGYwIiBzdHJva2Utd2lkdGg9IjEiIG9wYWNpdHk9IjAuNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
        
        {/* Animated gradient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full filter blur-3xl animate-blob" />
        <div className="absolute top-20 -right-40 w-80 h-80 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-20 w-72 h-72 bg-gradient-to-r from-[#2AB7A9]/20 to-emerald-400/20 rounded-full filter blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-r from-[#F5B72F]/20 to-yellow-400/20 rounded-full filter blur-3xl animate-blob animation-delay-6000" />
        
        {/* AI circuit pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M20 20h60v60h-60z" fill="none" stroke="#2AB7A9" strokeWidth="1" opacity="0.3"/>
                <circle cx="20" cy="20" r="3" fill="#F5B72F" opacity="0.6"/>
                <circle cx="80" cy="20" r="3" fill="#2AB7A9" opacity="0.6"/>
                <circle cx="20" cy="80" r="3" fill="purple" opacity="0.6"/>
                <circle cx="80" cy="80" r="3" fill="#F5B72F" opacity="0.6"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#circuit)"/>
          </svg>
        </div>
      </div>
      <div className="relative container mx-auto px-4 py-20 sm:px-6 lg:px-8 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto text-center w-full">
          {/* Hero content */}
          <div className="animate-fade-in space-y-16">
            {/* AI Badge */}
            <div className="flex justify-center">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur opacity-30 animate-pulse group-hover:opacity-50 transition-opacity"></div>
                <div className="relative inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/50 rounded-full backdrop-blur-sm hover:scale-105 transition-transform duration-300">
                  <Bot className="w-6 h-6 mr-3 text-blue-600 animate-bounce" />
                  <span className="text-base font-bold text-gray-700">THE SMARTEST AI IDE FOR DATA TEAMS</span>
                </div>
              </div>
            </div>

            {/* Main Headline */}
            <div className="space-y-6">
              <h1 className="text-6xl sm:text-7xl md:text-6xl lg:text-6xl font-black tracking-tight leading-[0.85]">
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-blue-600 to-purple-600 animate-gradient-text">
                  Pipeline : Transform : Analyze : Deploy
                </div>
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-[#2AB7A9] via-blue-500 to-purple-600 animate-gradient-text font-light">
                  In Minutes ...
                </div>
              </h1>
              
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-700 animate-fade-in animation-delay-200">
                <span className="text-blue-600">⚡  faster & more accurate</span> <span className="font-light text-gray-500">than GitHub Copilot, Cursor & Windsurf</span>
              </p>
            </div>

            {/* CodeIntegration Component */}
            <div className="mt-16 animate-fade-in animation-delay-400">
              <CodeIntegration />
            </div>
            
            {/* AI Agents Showcase */}
            <div className="mt-16 animate-fade-in animation-delay-600">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  Meet Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">Advanced</span> AI Agents
                </h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Our specialized agents with deep domain expertise to handle every aspect of your data workflow
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {/* Data Architect Agent */}
                <div className="group bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl p-8 border border-purple-200/50 hover:scale-105 transition-all duration-300 hover:shadow-xl">
                  <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl mb-6 mx-auto animate-float group-hover:scale-110 transition-transform duration-300">
                    <Building className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">Data Architect</h3>
                  <p className="text-gray-600 text-center leading-relaxed">
                    Designs optimal data models, schemas, and warehouse architectures. Understands business requirements and translates them into scalable data solutions.
                  </p>
                </div>
                
                {/* Data Developer Agent */}
                <div className="group bg-gradient-to-br from-teal-50 to-emerald-50 rounded-3xl p-8 border border-teal-200/50 hover:scale-105 transition-all duration-300 hover:shadow-xl">
                  <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#2AB7A9] to-emerald-600 rounded-2xl mb-6 mx-auto animate-float animation-delay-2000 group-hover:scale-110 transition-transform duration-300">
                    <Code2 className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">Data Developer</h3>
                  <p className="text-gray-600 text-center leading-relaxed">
                    Writes efficient SQL, builds ETL pipelines, and optimizes data transformations. Expert in all SQL dialects and modern data stack tools.
                  </p>
                </div>
                
                {/* Data Troubleshooter Agent */}
                <div className="group bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl p-8 border border-yellow-200/50 hover:scale-105 transition-all duration-300 hover:shadow-xl">
                  <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#F5B72F] to-orange-500 rounded-2xl mb-6 mx-auto animate-float animation-delay-4000 group-hover:scale-110 transition-transform duration-300">
                    <Wrench className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">Data Troubleshooter</h3>
                  <p className="text-gray-600 text-center leading-relaxed">
                    Debugs complex data issues, identifies performance bottlenecks, and resolves pipeline failures with deep analytical expertise.
                  </p>
                </div>
              </div>
              
              {/* CTA Section */}
              <div className="mt-16 text-center">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <a href="https://marketplace.visualstudio.com/items?itemName=Duckcode.duck-code" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="group relative inline-flex items-center px-12 py-6 text-xl font-bold rounded-2xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 glow-effect">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                    <Download className="relative mr-4 h-7 w-7 group-hover:animate-bounce" />
                    <span className="relative">Get Started Free</span>
                    <Zap className="relative ml-4 h-7 w-7 group-hover:animate-bounce" />
                  </a>
                  
                  <Link 
                    to="/docs" 
                    className="group inline-flex items-center px-10 py-5 border-2 border-gray-300 text-lg font-semibold rounded-2xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                    View Docs
                    <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>

            
            {/* Enterprise Features */}
            <div className="mt-20 sm:mt-24 bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl p-12 border border-gray-200 max-w-6xl mx-auto shadow-xl">
              <div className="text-center mb-16">
                <h3 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Enterprise-Ready Features</h3>
                <p className="text-xl text-gray-600">Built for security, privacy, and business intelligence</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="group bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 hover:shadow-lg border border-gray-200/50">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl mb-4 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <Key className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">Bring Your Own API</h4>
                  <p className="text-gray-600 text-xs leading-relaxed">Use your own API keys for complete control</p>
                </div>
                
                <div className="group bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 hover:shadow-lg border border-gray-200/50">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl mb-4 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors">100% Local Privacy</h4>
                  <p className="text-gray-600 text-xs leading-relaxed">No data leaves your laptop. Complete privacy</p>
                </div>
                
                <div className="group bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 hover:shadow-lg border border-gray-200/50">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl mb-4 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <Search className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">Business Intelligence</h4>
                  <p className="text-gray-600 text-xs leading-relaxed">AI understands your business context</p>
                </div>
                
                <div className="group bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 hover:shadow-lg border border-gray-200/50">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl mb-4 mx-auto group-hover:scale-110 transition-transform duration-300 shadow-md">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-orange-600 transition-colors">Custom Prompts</h4>
                  <p className="text-gray-600 text-xs leading-relaxed">Configure with your coding standards</p>
                </div>
              </div>
            </div>
            

            
            {/* Community Links */}
            <div className="mt-16 sm:mt-20">
              <p className="text-center text-gray-700 mb-8 font-semibold text-xl">Join Our Growing Community</p>
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <a href="https://discord.gg/aHM9jZB9" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="group flex items-center px-6 py-3 bg-white border border-gray-200 hover:border-[#5865F2] rounded-2xl transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg">
                  <MessageCircle className="w-5 h-5 text-[#5865F2] mr-3 group-hover:animate-pulse" />
                  <span className="text-gray-700 group-hover:text-[#5865F2] font-semibold transition-colors">Discord</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#5865F2] ml-2 opacity-0 group-hover:opacity-100 transition-all" />
                </a>
                
                <a href="https://www.youtube.com/@duckcodeai" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="group flex items-center px-6 py-3 bg-white border border-gray-200 hover:border-red-500 rounded-2xl transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg">
                  <Video className="w-5 h-5 text-red-500 mr-3 group-hover:animate-pulse" />
                  <span className="text-gray-700 group-hover:text-red-500 font-semibold transition-colors">YouTube</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
                </a>
                
                <a href="https://reddit.com/r/duckcode" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="group flex items-center px-6 py-3 bg-white border border-gray-200 hover:border-orange-500 rounded-2xl transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg">
                  <Users className="w-5 h-5 text-orange-500 mr-3 group-hover:animate-pulse" />
                  <span className="text-gray-700 group-hover:text-orange-500 font-semibold transition-colors">Reddit</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-orange-500 ml-2 opacity-0 group-hover:opacity-100 transition-all" />
                </a>
              </div>
            </div>

            {/* Enhanced Stats */}
            
        
          </div>
        </div>
      </div>
    </div>
  );
}