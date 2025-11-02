import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  return (
    <header className="sticky top-0 z-50 w-full bg-black/80 backdrop-blur-md border-b border-gray-800">
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
                Duckcode
              </span>
            </Link>
          </div>
          
          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <a 
              href="#features" 
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-150"
            >
              Features
            </a>
            <Link 
              to="/login"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-150"
            >
              Login
            </Link>
            <Link 
              to="/register"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-black bg-white hover:bg-gray-100 transition-colors duration-150"
            >
              Get early access
            </Link>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-700"
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-black border-b border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-3 sm:px-3">
            <a 
              href="#features" 
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-900" 
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </a>
            <Link 
              to="/login"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-900"
              onClick={() => setIsMenuOpen(false)}
            >
              Login
            </Link>
            <Link 
              to="/register"
              className="block px-3 py-2 rounded-md text-base font-medium text-black bg-white hover:bg-gray-100"
              onClick={() => setIsMenuOpen(false)}
            >
              Get early access
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}