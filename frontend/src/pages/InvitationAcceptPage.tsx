/**
 * Invitation Accept Page
 * Allows users to accept organization invitations
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Building2, UserCheck, Shield, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  getInvitationByToken,
  acceptInvitation,
  type InvitationDetails,
} from '../services/invitationService';

type PageState = 'loading' | 'form' | 'success' | 'error';

export const InvitationAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (token) {
      loadInvitation();
    } else {
      setError('Invalid invitation link');
      setPageState('error');
    }
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;

    try {
      setPageState('loading');
      const invitationData = await getInvitationByToken(token);
      setInvitation(invitationData);
      setPageState('form');
    } catch (err: any) {
      setError(err.message || 'Failed to load invitation');
      setPageState('error');
    }
  };

  const validateForm = (): boolean => {
    const errors = {
      fullName: '',
      password: '',
      confirmPassword: '',
    };

    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 12) {
      errors.password = 'Password must be at least 12 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      errors.password = 'Password must contain at least one lowercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      errors.password = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      errors.password = 'Password must contain at least one special character';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return !Object.values(errors).some((err) => err !== '');
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token || !invitation) return;

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setError('');

      const response = await acceptInvitation({
        token,
        full_name: formData.fullName,
        password: formData.password,
      });

      setPageState('success');

      // Redirect after 3 seconds
      setTimeout(() => {
        if (response.user_exists) {
          navigate('/login');
        } else {
          navigate('/login', { state: { newUser: true } });
        }
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
      setSubmitting(false);
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Invitation</h2>
          <p className="text-gray-600">Please wait while we verify your invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Accepted!</h2>
          <p className="text-gray-600 mb-4">
            Your account has been created successfully. You've been added to{' '}
            <strong>{invitation?.organization_name}</strong> as a <strong>{invitation?.role_name}</strong>.
          </p>
          <p className="text-sm text-gray-500">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  // Form state
  if (!invitation) return null;

  const isExpired = new Date(invitation.expires_at) < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Expired</h2>
          <p className="text-gray-600 mb-6">
            This invitation expired on {new Date(invitation.expires_at).toLocaleDateString()}. Please contact your
            organization administrator for a new invitation.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-100 rounded-full p-3 inline-block mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">You've Been Invited!</h1>
          <p className="text-gray-600">Complete your registration to join the organization</p>
        </div>

        {/* Invitation Details */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 space-y-3">
          <div className="flex items-start">
            <Building2 className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Organization</p>
              <p className="font-semibold text-gray-900">{invitation.organization_name}</p>
            </div>
          </div>

          <div className="flex items-start">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Role</p>
              <p className="font-semibold text-gray-900">{invitation.role_name}</p>
            </div>
          </div>

          {invitation.team_name && (
            <div className="flex items-start">
              <UserCheck className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Team</p>
                <p className="font-semibold text-gray-900">{invitation.team_name}</p>
              </div>
            </div>
          )}

          <div className="flex items-start">
            <Mail className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold text-gray-900">{invitation.email}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-blue-200">
            <p className="text-xs text-gray-500">
              Invited by <span className="font-medium">{invitation.invited_by_email}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Expires on {new Date(invitation.expires_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleAccept} className="space-y-4">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                formErrors.fullName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="John Doe"
              disabled={submitting}
            />
            {formErrors.fullName && <p className="text-red-500 text-xs mt-1">{formErrors.fullName}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                formErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="••••••••••••"
              disabled={submitting}
            />
            {formErrors.password && <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 12 characters with uppercase, lowercase, number, and special character
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="••••••••••••"
              disabled={submitting}
            />
            {formErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{formErrors.confirmPassword}</p>}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Accepting Invitation...
              </>
            ) : (
              'Accept Invitation & Create Account'
            )}
          </button>

          {/* Login Link */}
          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default InvitationAcceptPage;
