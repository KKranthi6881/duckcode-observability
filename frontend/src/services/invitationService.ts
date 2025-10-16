/**
 * Invitation Service
 * Handles invitation acceptance flow with backend API
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export interface InvitationDetails {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role_name: string;
  team_name?: string;
  invited_by_email: string;
  expires_at: string;
  status: string;
}

export interface AcceptInvitationPayload {
  token: string;
  password?: string; // Required if user doesn't exist
  full_name?: string; // Required if user doesn't exist
}

export interface AcceptInvitationResponse {
  success: boolean;
  message: string;
  user_exists: boolean;
  redirect_url: string;
}

/**
 * Get invitation details by token (public endpoint)
 */
export const getInvitationByToken = async (token: string): Promise<InvitationDetails> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/enterprise/invitations/${token}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Invitation not found or has expired');
    }
    if (error.response?.status === 410) {
      throw new Error('This invitation has already been used');
    }
    throw new Error(error.response?.data?.error || 'Failed to fetch invitation details');
  }
};

/**
 * Accept invitation and create user if needed
 */
export const acceptInvitation = async (
  payload: AcceptInvitationPayload
): Promise<AcceptInvitationResponse> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/enterprise/invitations/${payload.token}/accept`,
      {
        password: payload.password,
        full_name: payload.full_name,
      }
    );
    return response.data;
  } catch (error: any) {
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
};

export const invitationApiService = {
  getInvitationByToken,
  acceptInvitation,
};

export default invitationApiService;
