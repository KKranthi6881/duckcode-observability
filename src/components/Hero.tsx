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
      <div className="relative container mx-auto px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center animate-fade-in">
            <div className="flex items-center justify-center mb-6 space-x-2">
              <Sparkles className="h-6 w-6 text-[#F5B72F] animate-pulse" />
              <span className="text-sm font-medium text-slate-400">
                AI-Powered Data Development IDE
              </span>
              <span className="px-2 py-1 text-xs font-bold bg-purple-600 text-white rounded-full">Coming Soon</span>
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
              <span className="block mb-2 animate-title">
                The ultimate IDE for
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#F5B72F] via-[#2AB7A9] to-purple-500 animate-gradient-text">
                Data Teams
              </span>
            </h1>
            <p className="mt-8 max-w-2xl mx-auto text-xl text-slate-300 animate-fade-in animation-delay-200">
              Our AI-powered IDE with built-in lineage, observability, and data quality 
              for seamless data warehouse development is coming soon. 
              Get started today with our <span className="font-bold text-[#2AB7A9]">free VSCode extension</span>.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-6 animate-fade-in animation-delay-400">
              <a href="https://marketplace.visualstudio.com/items?itemName=duckcode.duckcode-extension" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center px-8 py-4 border border-transparent text-base font-medium rounded-full shadow-lg text-slate-900 bg-gradient-to-r from-[#F5B72F] to-[#F5B72F]/80 hover:shadow-xl hover:scale-105 transition-all duration-200">
                Download VSCode Extension
                <Download className="ml-2 h-5 w-5 group-hover:translate-y-1 transition-transform" />
              </a>
              <a href="#waitlist-form" className="inline-flex items-center px-8 py-4 border border-[#2AB7A9] text-base font-medium rounded-full text-[#2AB7A9] bg-transparent hover:bg-[#2AB7A9]/10 shadow-sm transition-all duration-200 hover:shadow hover:scale-105">
                Join Waitlist
              </a>
            </div>
          </div>
          
          {/* Waitlist Form */}
          <div className="mt-24 pt-6" id="waitlist-form">
            <WaitlistForm />
          </div>
        </div>
      </div>
    </div>
  );
}