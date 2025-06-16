import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  return (
    <header className="sticky top-0 z-50 w-full bg-[#050a10]/95 backdrop-blur-sm border-b border-[#08141e]/90">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              {/* Logo using the icon-duck-obs.png */}
              <img 
                src="/icon-duck-obs.png" 
                alt="Duckcode Logo" 
                className="h-10 w-10" 
              />
              <span className="font-bold text-xl text-white ml-2">
                Duckcode<span className="text-[#2AB7A9]"></span>
              </span>
            </Link>
          </div>
          
          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-6">

            {/* <a 
              href="#waitlist" 
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#08141e] bg-gradient-to-r from-[#F5B72F] to-[#F98B32] hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2AB7A9] focus:ring-offset-[#08141e]"
            >
              Join Waitlist
            </a> */}
            <Link 
              to="/login"
              className="text-sm font-medium text-slate-300 hover:text-[#F5B72F] transition-colors duration-150"
            >
              Login
            </Link>
            <Link 
              to="/register"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#08141e] bg-gradient-to-r from-[#F5B72F] to-[#F98B32] hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2AB7A9] focus:ring-offset-[#08141e]"
            >
              Register
            </Link>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-300 hover:text-[#F5B72F] hover:bg-[#050a10]/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2AB7A9]"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#050a10] border-b border-[#08141e]/90">
          <div className="px-2 pt-2 pb-3 space-y-3 sm:px-3">
            <a 
              href="#integration" 
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-[#F5B72F] hover:bg-[#050a10]/70" 
              onClick={() => setIsMenuOpen(false)}
            >
              IDE Extension
            </a>
            {/* <a 
              href="#waitlist" 
              className="block px-3 py-2 rounded-md text-base font-medium text-[#08141e] bg-gradient-to-r from-[#F5B72F] to-[#F98B32] hover:opacity-90 hover:shadow-md" 
              onClick={() => setIsMenuOpen(false)}
            >
              Join Waitlist
            </a> */}
            <Link 
              to="/login"
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-[#F5B72F] hover:bg-[#050a10]/70"
              onClick={() => setIsMenuOpen(false)}
            >
              Login
            </Link>
            <Link 
              to="/register"
              className="block px-3 py-2 rounded-md text-base font-medium text-[#08141e] bg-gradient-to-r from-[#F5B72F] to-[#F98B32] hover:opacity-90 hover:shadow-md"
              onClick={() => setIsMenuOpen(false)}
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}