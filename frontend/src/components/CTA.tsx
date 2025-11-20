import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
export function CTA() {
  return <div className="relative bg-slate-900 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2D3D]/90 to-slate-900"></div>
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-900 to-transparent"></div>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#F5B72F]/10 rounded-full mix-blend-screen filter blur-3xl animate-blob"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#2AB7A9]/10 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000"></div>
      </div>
      <div className="relative container mx-auto px-4 py-16 sm:px-6 lg:py-24 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-slate-800/50 backdrop-blur-sm border border-slate-700 mb-8 animate-fade-in">
            <Sparkles className="h-4 w-4 text-[#F5B72F] mr-2" />
            <span className="text-sm font-medium text-slate-300">
              AI-Powered Data Development
            </span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl animate-fade-in">
            <span className="block">Transform your data development</span>
            <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-[#F5B72F] via-[#2AB7A9] to-purple-500 animate-gradient-text">
              from days to hours
            </span>
          </h2>
          <p className="mt-6 text-xl text-slate-300 animate-fade-in animation-delay-200">
            Join the data teams that are building, debugging, and deploying data
            solutions faster than ever before with Duckcode.ai
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4 animate-fade-in animation-delay-400">
            <a href="/register" className="group inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full shadow-lg text-slate-900 bg-gradient-to-r from-[#F5B72F] to-[#F5B72F]/80 hover:shadow-xl hover:scale-105 transition-all duration-200">
              Start free trial
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="/request-demo" className="inline-flex items-center justify-center px-8 py-4 border border-[#2AB7A9] text-base font-medium rounded-full text-[#2AB7A9] bg-transparent hover:bg-[#2AB7A9]/10 shadow-sm transition-all duration-200">
              Schedule demo
            </a>
          </div>
          <div className="mt-12 animate-fade-in animation-delay-600">
            <p className="text-sm text-slate-400">
              No credit card required. 14-day free trial with full access to all
              features.
            </p>
          </div>
        </div>
      </div>
    </div>;
}