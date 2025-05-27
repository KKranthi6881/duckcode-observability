import React, { useState } from 'react';
import { User, Settings, LogOut } from 'lucide-react';
export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  return <div className="relative">
      <button className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-700" onClick={() => setIsOpen(!isOpen)}>
        <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
          <User className="h-5 w-5 text-slate-400" />
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-white">John Doe</div>
          <div className="text-xs text-slate-400">Data Engineer</div>
        </div>
      </button>
      {isOpen && <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-slate-800 ring-1 ring-black ring-opacity-5">
          <div className="py-1" role="menu">
            <button className="flex items-center w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700" role="menuitem">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </button>
            <button className="flex items-center w-full px-4 py-2 text-sm text-slate-300 hover:bg-slate-700" role="menuitem">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>}
    </div>;
}