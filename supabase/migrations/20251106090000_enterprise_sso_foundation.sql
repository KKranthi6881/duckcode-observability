BEGIN;

-- =====================================================
-- Enterprise SSO foundation tables (Okta / Azure AD)
-- =====================================================

CREATE TABLE IF NOT EXISTS enterprise.sso_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('okta', 'azure_ad', 'oidc', 'saml')),
    provider_label TEXT NOT NULL,
    issuer_url TEXT NOT NULL,
    authorization_url TEXT,
    token_url TEXT,
    jwks_url TEXT,
    client_id TEXT NOT NULL,
    client_secret TEXT,
    default_role_id UUID REFERENCES enterprise.organization_roles(id) ON DELETE SET NULL,
    enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
    allow_password_fallback BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_connections_org_provider
    ON enterprise.sso_connections(organization_id, provider_type);

CREATE INDEX IF NOT EXISTS idx_sso_connections_enforce
    ON enterprise.sso_connections(organization_id)
    WHERE enforce_sso = TRUE;

COMMENT ON TABLE enterprise.sso_connections IS 'Per-organization identity provider configuration (Okta, Azure AD, generic OIDC/SAML).';
COMMENT ON COLUMN enterprise.sso_connections.provider_label IS 'Friendly name shown to admins and sign-in UI (e.g., Okta US Prod).';
COMMENT ON COLUMN enterprise.sso_connections.metadata IS 'Provider-specific JSON metadata (certificates, domains, scopes, etc.).';

-- Domains claimed for SSO enforcement
CREATE TABLE IF NOT EXISTS enterprise.sso_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES enterprise.sso_connections(id) ON DELETE CASCADE,
    domain_name TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sso_domains_domain
    ON enterprise.sso_domains (lower(domain_name));

CREATE INDEX IF NOT EXISTS idx_sso_domains_org
    ON enterprise.sso_domains (organization_id);

COMMENT ON TABLE enterprise.sso_domains IS 'Email domains claimed by an organization for routing logins through SSO.';
COMMENT ON COLUMN enterprise.sso_domains.verification_token IS 'Token that must appear in DNS / email proof to verify ownership.';

-- SCIM / provisioning tokens for IdPs
CREATE TABLE IF NOT EXISTS enterprise.scim_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES enterprise.sso_connections(id) ON DELETE CASCADE,
    token_name TEXT NOT NULL,
    secret_hash TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scim_tokens_org_name
    ON enterprise.scim_tokens (organization_id, token_name);

COMMENT ON TABLE enterprise.scim_tokens IS 'Provisioning credentials issued to Okta / Azure SCIM integrations.';
COMMENT ON COLUMN enterprise.scim_tokens.secret_hash IS 'Hashed bearer token value used to authenticate SCIM requests.';

-- Reuse enterprise.update_updated_at_column trigger on new tables
DROP TRIGGER IF EXISTS trigger_update_sso_connections_timestamp ON enterprise.sso_connections;
CREATE TRIGGER trigger_update_sso_connections_timestamp
    BEFORE UPDATE ON enterprise.sso_connections
    FOR EACH ROW
    EXECUTE FUNCTION enterprise.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_sso_domains_timestamp ON enterprise.sso_domains;
CREATE TRIGGER trigger_update_sso_domains_timestamp
    BEFORE UPDATE ON enterprise.sso_domains
    FOR EACH ROW
    EXECUTE FUNCTION enterprise.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_scim_tokens_timestamp ON enterprise.scim_tokens;
CREATE TRIGGER trigger_update_scim_tokens_timestamp
    BEFORE UPDATE ON enterprise.scim_tokens
    FOR EACH ROW
    EXECUTE FUNCTION enterprise.update_updated_at_column();

COMMIT;
