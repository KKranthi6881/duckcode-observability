import React, { useState } from 'react';
import { X, CreditCard } from 'lucide-react';
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: {
    name: string;
    price: string;
    period: string;
  };
}
export function PaymentModal({
  isOpen,
  onClose,
  plan
}: PaymentModalProps) {
  const [form, setForm] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: ''
  });
  if (!isOpen) return null;
  return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h3 className="text-lg font-medium text-white">
            Update Payment Method
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <h4 className="text-sm font-medium text-slate-300">
              Upgrading to {plan.name}
            </h4>
            <p className="text-2xl font-bold text-white mt-1">
              {plan.price}
              <span className="text-sm font-normal text-slate-400">
                /{plan.period}
              </span>
            </p>
          </div>
          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Card Number
              </label>
              <div className="mt-1 relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input type="text" className="block w-full pl-10 rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-3 py-2" placeholder="1234 5678 9012 3456" value={form.cardNumber} onChange={e => setForm({
                ...form,
                cardNumber: e.target.value
              })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Expiry Date
                </label>
                <input type="text" className="mt-1 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-3 py-2" placeholder="MM/YY" value={form.expiryDate} onChange={e => setForm({
                ...form,
                expiryDate: e.target.value
              })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  CVV
                </label>
                <input type="text" className="mt-1 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-3 py-2" placeholder="123" value={form.cvv} onChange={e => setForm({
                ...form,
                cvv: e.target.value
              })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Name on Card
              </label>
              <input type="text" className="mt-1 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-3 py-2" placeholder="John Doe" value={form.name} onChange={e => setForm({
              ...form,
              name: e.target.value
            })} />
            </div>
          </form>
        </div>
        <div className="flex justify-end space-x-3 p-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
            Cancel
          </button>
          <button className="px-4 py-2 bg-[#2AB7A9] text-white rounded-md hover:bg-[#2AB7A9]/90">
            Update Payment Method
          </button>
        </div>
      </div>
    </div>;
}