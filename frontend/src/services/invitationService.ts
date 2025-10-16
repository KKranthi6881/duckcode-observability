/**
 * Invitation Service
 * Handles invitation acceptance flow with backend API
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface InvitationDetails {
  id?: string;
  email: string;
  organizationName: string;
  organizationSlug: string;
  roleName: string;
  team_name?: string;
  inviterName: string;
  expiresAt: string;
  // For backward compatibility
  organization_name?: string;
  role_name?: string;
  invited_by_email?: string;
  expires_at?: string;
}

export interface AcceptInvitationRequest {
  token: string;
  full_name: string;
  password: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  email: string;
  user_exists?: boolean;
}

/**
 * Get invitation details by token
 */
export const getInvitationByToken = async (token: string): Promise<InvitationDetails> => {
  const response = await axios.get(`${API_BASE_URL}/api/invitations/token/${token}`);
  const data = response.data;

  // Map to both new and old field names for backward compatibility
  return {
    email: data.email,
    organizationName: data.organizationName,
    organizationSlug: data.organizationSlug,
    roleName: data.roleName,
    inviterName: data.inviterName,
    expiresAt: data.expiresAt,
    // Backward compatibility
    organization_name: data.organizationName,
    role_name: data.roleName,
    invited_by_email: data.inviterName,
    expires_at: data.expiresAt,
  };
};

/**
 * Accept an invitation and create/update user account
 */
export const acceptInvitation = async (request: AcceptInvitationRequest): Promise<AcceptInvitationResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/invitations/accept`, {
      token: request.token,
      fullName: request.full_name,
      password: request.password,
    });

    return {
      success: response.data.success || true,
      message: response.data.message || 'Account created successfully!',
      email: response.data.email,
      user_exists: false, // New accounts are always created
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 400) {
        throw new Error(error.response.data.error || 'Invalid invitation data');
      }
      if (error.response?.status === 404) {
        throw new Error('Invitation not found or has expired');
      }
      if (error.response?.status === 410) {
        throw new Error('This invitation has already been accepted');
      }
      throw new Error(error.response?.data?.error || 'Failed to accept invitation');
    }
    throw error;
  }
};

export const invitationApiService = {
  getInvitationByToken,
  acceptInvitation,
};

export default invitationApiService;
