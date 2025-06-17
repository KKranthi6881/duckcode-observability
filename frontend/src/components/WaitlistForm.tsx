import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface FormState {
  name: string;
  organization: string;
  email: string;
  phone: string;
}

export function WaitlistForm() {
  const [formState, setFormState] = useState<FormState>({
    name: '',
    organization: '',
    email: '',
    phone: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatus('idle');
    setErrorMessage('');

    try {
      // Validate email
      if (!formState.email.includes('@') || !formState.email.includes('.')) {
        throw new Error('Please enter a valid email address');
      }

      // Validate name
      if (formState.name.trim().length < 2) {
        throw new Error('Please enter a valid name (at least 2 characters)');
      }

      // Debugging check for table name
      console.log('Submitting to waitlist_entries table...');
      
      const { error, data } = await supabase
        .from('waitlist_entries')
        .insert([
          {
            name: formState.name,
            organization: formState.organization,
            email: formState.email,
            phone: formState.phone || null
          }
        ]);

      if (error) {
        console.error('Error submitting to waitlist:', error);
        if (error.code === '23505') {
          setFormStatus('error');
          setErrorMessage('This email has already been registered. Thank you for your interest!');
        } else {
          setFormStatus('error');
          setErrorMessage(`Error: ${error.message || 'Something went wrong. Please try again later.'}`);
        }
      } else {
        setFormStatus('success');
        // Reset form
        setFormState({
          name: '',
          organization: '',
          email: '',
          phone: ''
        });
      }
    } catch (err: any) {
      console.error('Form submission error:', err);
      setFormStatus('error');
      setErrorMessage(err.message || 'Something went wrong. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-800/50 backdrop-blur-md rounded-xl shadow-lg p-8 border border-slate-700" id="waitlist">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Join Our Waitlist</h2>
      
      {formStatus === 'success' ? (
        <div className="text-center p-6 bg-green-900/40 border border-green-700 rounded-lg">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-white mb-2">Thank You!</h3>
          <p className="text-slate-300">
            We've added you to our waitlist. We'll keep you updated on our progress.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {formStatus === 'error' && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center space-x-2">
              <AlertCircle className="text-red-500 w-5 h-5 flex-shrink-0" />
              <p className="text-red-200 text-sm">{errorMessage}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
              Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formState.name}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent"
              placeholder="Your name"
            />
          </div>
          
          <div>
            <label htmlFor="organization" className="block text-sm font-medium text-slate-300 mb-1">
              Organization *
            </label>
            <input
              id="organization"
              name="organization"
              type="text"
              required
              value={formState.organization}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent"
              placeholder="Your company or organization"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email Address *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formState.email}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">
              Phone Number <span className="text-slate-400 text-xs">(Optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formState.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent"
              placeholder="Your phone number"
            />
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-slate-900 bg-gradient-to-r from-[#F5B72F] to-[#F5B72F]/80 hover:from-[#F5B72F] hover:to-[#F5B72F] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F5B72F] focus:ring-offset-slate-900 transition-all duration-200 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Join Waitlist'}
          </button>
          
          <p className="text-xs text-slate-400 text-center mt-4">
            We'll keep you updated on our progress and notify you when we launch.
          </p>
        </form>
      )}
    </div>
  );
}
