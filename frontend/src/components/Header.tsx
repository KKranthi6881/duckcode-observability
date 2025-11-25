import { useState } from 'react';
import { Menu, X, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#e1dcd3] bg-[#f5f1e9]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src="/icon-duck-obs.png" alt="DuckCode Logo" className="h-9 w-9" />
          <span className="text-lg font-semibold text-slate-900">DuckCode.ai</span>
        </Link>

        <nav className="hidden items-center gap-4 md:flex">
          <Link
            to="/docs"
            className="text-sm font-medium text-[#5f594f] hover:text-[#161413] transition"
          >
            Docs
          </Link>
          <Link
            to="/request-demo"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(255,106,60,0.35)] transition hover:translate-y-[-2px]"
          >
            <PlayCircle className="h-4 w-4" />
            Request demo
          </Link>
        </nav>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-md p-2 text-[#5f594f] transition hover:bg-[#f0ede5] hover:text-[#161413] md:hidden"
        >
          <span className="sr-only">Toggle menu</span>
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-b border-[#e1dcd3] bg-[#f5f1e9] md:hidden">
          <div className="space-y-3 px-4 py-4">
            <Link
              to="/request-demo"
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] px-3 py-2 text-base font-semibold text-white shadow-[0_12px_24px_rgba(255,106,60,0.35)] transition hover:translate-y-[-2px]"
              onClick={() => setIsMenuOpen(false)}
            >
              Request demo
              <PlayCircle className="h-5 w-5" />
            </Link>
            <Link
              to="/docs"
              className="block rounded-lg border border-[#d6d2c9] px-3 py-2 text-center text-base font-medium text-[#161413] transition hover:border-[#ff6a3c]"
              onClick={() => setIsMenuOpen(false)}
            >
              Docs
            </Link>
            <Link
              to="/login"
              className="block rounded-lg border border-[#d6d2c9] px-3 py-2 text-center text-base font-medium text-[#161413] transition hover:border-[#ff6a3c]"
              onClick={() => setIsMenuOpen(false)}
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
