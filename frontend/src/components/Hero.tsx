import React from 'react';
import { ArrowRight, Database, Code, Sparkles, Zap, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WaitlistForm } from './WaitlistForm';

export function Hero() {
  return (
    <div className="relative overflow-hidden bg-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMTI1MjkiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0wLTZoLTJWNmgydjR6bTAgMjRoLTJ2LTRoMnY0em0wIDZoLTJ2LTRoMnY0em0wIDZoLTJ2LTRoMnY0em0wIDZoLTJ2LTRoMnY0em0tNi0yNGgtNHYtMmg0djJ6bS02IDBoLTR2LTJoNHYyem0tNiAwSDE0di0yaDR2MnptLTYgMEg4di0yaDR2MnptMjQgMGgtNHYtMmg0djJ6bTYgMGgtNHYtMmg0djJ6bTYgMGgtNHYtMmg0djJ6bTYgMGgtNHYtMmg0djJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-25">
          <div className="absolute inset-0 bg-gradient-to-bl from-purple-600/10 via-[#2AB7A9]/10 to-transparent [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent)]" />
        </div>
        <div className="absolute -left-4 top-20 w-72 h-72 bg-[#F5B72F]/10 rounded-full mix-blend-screen filter blur-xl opacity-70 animate-blob" />
        <div className="absolute -right-4 top-40 w-72 h-72 bg-purple-500/10 rounded-full mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-[#2AB7A9]/10 rounded-full mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-4000" />
      </div>
      <div className="relative container mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
          {/* Left side - Hero content */}
          <div className="lg:col-span-3 animate-fade-in">
            <h2 className="text-left text-xl sm:text-2xl font-bold tracking-tight text-[#2AB7A9] mb-3 animate-fade-in flex items-center">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-[#F5B72F] mr-2 animate-pulse" />
              AI-Powered IDE for Data Teams
              <span className="ml-3 px-2 py-0.5 text-xs font-bold bg-purple-600 text-white rounded-full">Private Beta</span>
            </h2>
            
            <div className="space-y-2">
              <h1 className="text-left text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight">
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5B72F] via-[#2AB7A9] to-purple-500 animate-gradient-text">
                  20X Faster Development.
                </div>
                <div className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-[#2AB7A9] to-[#F5B72F] animate-gradient-text">
                  Zero Guesswork.
                </div>
              </h1>
              
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white animate-title pt-2">
                Ship data pipelines and debug issues in minutes—not days.
              </p>
            </div>
            
            <p className="mt-6 sm:mt-8 text-lg sm:text-xl text-slate-300 animate-fade-in animation-delay-200 max-w-2xl">
              Built-in lineage, observability, and data quality checks in one powerful VSCode extension.
              <span className="font-bold text-[#F5B72F]"> 🧪 Now in private beta.</span> Get early access.
            </p>
            
            <div className="mt-8 sm:mt-10 flex items-start animate-fade-in animation-delay-400">
              <a href="https://marketplace.visualstudio.com/items?itemName=duckcode.duckcode-extension" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="group inline-flex items-center px-6 py-3 sm:px-8 sm:py-4 border border-transparent text-base font-medium rounded-full shadow-lg text-slate-900 bg-gradient-to-r from-[#F5B72F] to-[#F5B72F]/80 hover:shadow-xl hover:scale-105 transition-all duration-200">
                Download VSCode Extension
                <Download className="ml-2 h-5 w-5 group-hover:translate-y-1 transition-transform" />
              </a>
            </div>
          </div>
          
          {/* Right side - Waitlist Form */}
          <div className="lg:col-span-2" id="waitlist-form">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Join Waitlist</h2>
                <ArrowRight className="h-5 w-5 text-[#2AB7A9]" />
              </div>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}