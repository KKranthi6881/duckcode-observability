-- =====================================================
-- Grant INSERT permission on organization_invitations
-- =====================================================
-- RLS policies can only RESTRICT permissions, not GRANT them
-- Authenticated users need base INSERT permission for RLS to work
-- =====================================================

-- Grant INSERT permission to authenticated users
GRANT INSERT ON enterprise.organization_invitations TO authenticated;

-- Grant UPDATE permission for cancelling invitations
GRANT UPDATE ON enterprise.organization_invitations TO authenticated;

COMMENT ON TABLE enterprise.organization_invitations IS 
  'Invitations to join organizations. Authenticated users can INSERT/UPDATE with RLS restrictions.';
