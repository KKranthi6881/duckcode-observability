import React from 'react';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
export function Footer() {
  return <footer className="bg-slate-900 border-t border-slate-800">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <div className="flex items-center space-x-2">
              <img src="/icon.png" alt="Duckcode Logo" className="h-8 w-auto" />
              <span className="font-bold text-xl text-white">
                Duckcode<span className="text-[#2AB7A9]">.ai</span>
              </span>
            </div>
            <p className="text-slate-400 text-base">
              AI-powered IDE with built-in lineage, observability, and data
              quality for seamless data warehouse and analytics development.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-slate-500 hover:text-[#F5B72F] transition-colors">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-500 hover:text-[#F5B72F] transition-colors">
                <span className="sr-only">GitHub</span>
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-500 hover:text-[#F5B72F] transition-colors">
                <span className="sr-only">LinkedIn</span>
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:mt-0 xl:col-span-2">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
                  Product
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      VS Code Extension
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Integrations
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
                  Resources
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Documentation
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Guides
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      API Reference
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Blog
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
                  Company
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      About
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Careers
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Press
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Partners
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-slate-400 tracking-wider uppercase">
                  Support
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Help Center
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Contact Us
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Status
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-slate-400 hover:text-[#2AB7A9] transition-colors">
                      Community
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-800 pt-8">
          <p className="text-base text-slate-500 xl:text-center">
            &copy; {new Date().getFullYear()} Duckcode.ai. All rights reserved.
          </p>
        </div>
      </div>
    </footer>;
}