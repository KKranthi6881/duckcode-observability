import React from 'react';
import { Search } from 'lucide-react';
import { UserMenu } from '../../../components/UserMenu';
export function DashboardHeader() {
  return <header className="bg-slate-800 border-b border-slate-700">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center flex-1">
          <div className="flex-1 flex">
            <div className="w-full flex md:ml-0">
              <label htmlFor="search" className="sr-only">
                Search
              </label>
              <div className="relative w-full text-slate-400 focus-within:text-slate-300">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </div>
                <input id="search" className="block w-full h-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent sm:text-sm" placeholder="Search..." type="search" />
              </div>
            </div>
          </div>
        </div>
        <UserMenu />
      </div>
    </header>;
}