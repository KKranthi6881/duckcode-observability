import React, { useState } from 'react';
import { X } from 'lucide-react';
interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export function PasswordChangeModal({
  isOpen,
  onClose
}: PasswordChangeModalProps) {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  if (!isOpen) return null;
  return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h3 className="text-lg font-medium text-white">Change Password</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Current Password
              </label>
              <input type="password" className="mt-1 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-3 py-2" value={form.currentPassword} onChange={e => setForm({
              ...form,
              currentPassword: e.target.value
            })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                New Password
              </label>
              <input type="password" className="mt-1 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-3 py-2" value={form.newPassword} onChange={e => setForm({
              ...form,
              newPassword: e.target.value
            })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Confirm New Password
              </label>
              <input type="password" className="mt-1 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-3 py-2" value={form.confirmPassword} onChange={e => setForm({
              ...form,
              confirmPassword: e.target.value
            })} />
            </div>
          </form>
        </div>
        <div className="flex justify-end space-x-3 p-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
            Cancel
          </button>
          <button className="px-4 py-2 bg-[#2AB7A9] text-white rounded-md hover:bg-[#2AB7A9]/90">
            Change Password
          </button>
        </div>
      </div>
    </div>;
}