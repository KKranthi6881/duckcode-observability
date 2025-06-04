import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return <header className="sticky top-0 z-50 w-full bg-slate-900/80 backdrop-blur-sm border-b border-slate-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              {/* Logo - replaced img with text-based logo for now */}
              <div className="flex items-center justify-center h-9 w-9 rounded-md bg-gradient-to-br from-[#2AB7A9] to-purple-600 text-white font-bold text-lg">D</div>
              <span className="font-bold text-xl text-white">
                Duckcode<span className="text-[#2AB7A9]">.ai</span>
              </span>
            </Link>
          </div>
          <nav className="hidden md:flex items-center space-x-8">

            <a href="#integration" className="text-sm font-medium text-slate-300 hover:text-[#F5B72F] transition-colors">
              IDE Extension
            </a>

          </nav>
          <div className="hidden md:flex items-center space-x-4">
            <a href="#waitlist" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-slate-900 bg-[#F5B72F] hover:bg-[#F5B72F]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2AB7A9] focus:ring-offset-slate-900">
              Join Waitlist
            </a>
          </div>
          <div className="flex items-center md:hidden">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="inline-flex items-center justify-center p-2 rounded-md text-slate-300 hover:text-[#F5B72F] hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2AB7A9]">
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      {/* Mobile menu */}
      {isMenuOpen && <div className="md:hidden bg-slate-900 border-b border-slate-800">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">

            <a href="#integration" className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-[#F5B72F] hover:bg-slate-800" onClick={() => setIsMenuOpen(false)}>
              IDE Extension
            </a>

            <div className="pt-4 pb-3 border-t border-slate-800">
              <a href="#waitlist" className="block mt-2 px-3 py-2 rounded-md text-center text-base font-medium text-slate-900 bg-[#F5B72F] hover:bg-[#F5B72F]/90" onClick={() => setIsMenuOpen(false)}>
                Join Waitlist
              </a>
            </div>
          </div>
        </div>}
    </header>;
}