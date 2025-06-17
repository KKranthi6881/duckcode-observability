import React from 'react';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
export function Footer() {
  return <footer className="bg-slate-900 border-t border-slate-800">
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center space-x-2">
            {/* Text-based logo to match header */}
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-gradient-to-br from-[#2AB7A9] to-purple-600 text-white font-bold text-base">D</div>
            <span className="font-bold text-xl text-white">
              Duckcode<span className="text-[#2AB7A9]">.ai</span>
            </span>
          </div>
          <p className="mt-4 text-slate-400 text-base max-w-md">
            AI-powered IDE with built-in lineage, observability, and data
            quality for seamless data warehouse development. Coming soon.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-800 w-full">
            <p className="text-sm text-slate-500 text-center">
              &copy; {new Date().getFullYear()} Duckcode.ai. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>;
}