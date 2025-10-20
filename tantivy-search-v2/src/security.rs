use anyhow::{Result, Context};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use deadpool_postgres::Pool;
use log::{info, warn, error};

/// JWT Claims structure from Supabase
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // User ID or "backend-service" for service tokens
    pub email: Option<String>,
    pub role: String,
    pub organization_id: Option<String>,  // For service-to-service tokens
    pub exp: usize,
    pub iat: usize,
}

/// User information after authentication
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub organization_id: String,
    pub role: String,
    pub email: Option<String>,
}

/// Actions that can be performed
#[derive(Debug, PartialEq)]
pub enum Action {
    Search,
    Index,
    DeleteIndex,
    ViewStats,
}

/// Role-based access control
pub struct RBAC {
    permissions: std::collections::HashMap<String, Vec<Action>>,
}

impl RBAC {
    pub fn new() -> Self {
        let mut permissions = std::collections::HashMap::new();
        
        // Owner can do everything
        permissions.insert("owner".to_string(), vec![
            Action::Search,
            Action::Index,
            Action::DeleteIndex,
            Action::ViewStats,
        ]);
        
        // Admin can do most things
        permissions.insert("admin".to_string(), vec![
            Action::Search,
            Action::Index,
            Action::ViewStats,
        ]);
        
        // Member can search and view
        permissions.insert("member".to_string(), vec![
            Action::Search,
            Action::ViewStats,
        ]);
        
        // Viewer can only search
        permissions.insert("viewer".to_string(), vec![
            Action::Search,
        ]);
        
        Self { permissions }
    }
    
    /// Check if a role has permission for an action
    pub fn has_permission(&self, role: &str, action: &Action) -> bool {
        self.permissions
            .get(role)
            .map(|actions| actions.contains(action))
            .unwrap_or(false)
    }
}

/// Security service for JWT validation and authorization
pub struct SecurityService {
    jwt_secret: String,
    rbac: RBAC,
}

impl SecurityService {
    pub fn new() -> Result<Self> {
        let jwt_secret = std::env::var("JWT_SECRET")
            .context("JWT_SECRET must be set")?;
        
        Ok(Self {
            jwt_secret,
            rbac: RBAC::new(),
        })
    }
    
    /// Validate JWT token and return claims
    pub fn validate_jwt(&self, token: &str) -> Result<Claims> {
        let validation = Validation::new(Algorithm::HS256);
        
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.jwt_secret.as_bytes()),
            &validation,
        ).context("Invalid JWT token")?;
        
        Ok(token_data.claims)
    }
    
    /// Get authenticated user with organization info
    pub async fn authenticate(&self, token: &str, db_pool: &Pool) -> Result<AuthenticatedUser> {
        // Validate JWT
        let claims = self.validate_jwt(token)?;
        
        info!("🔐 Authenticated user: {}", claims.sub);
        
        // Handle service-to-service tokens (from backend)
        if claims.sub == "backend-service" {
            let org_id = claims.organization_id
                .as_ref()
                .context("Service token missing organization_id")?;
            
            // Validate organization_id is a valid UUID
            let _org_uuid = uuid::Uuid::parse_str(org_id)
                .context("Invalid organization_id in service token")?;
            
            return Ok(AuthenticatedUser {
                user_id: claims.sub,
                organization_id: org_id.clone(),
                role: claims.role.clone(),
                email: None,
            });
        }
        
        // Handle regular user tokens
        let client = db_pool.get().await?;
        
        let row = client
            .query_one(
                "SELECT organization_id, role FROM duckcode.user_profiles WHERE id = $1",
                &[&uuid::Uuid::parse_str(&claims.sub)?],
            )
            .await
            .context("User profile not found")?;
        
        let organization_id: uuid::Uuid = row.get("organization_id");
        let role: String = row.get("role");
        
        // Verify organization is active
        let org_row = client
            .query_one(
                "SELECT status FROM duckcode.organizations WHERE id = $1",
                &[&organization_id],
            )
            .await
            .context("Organization not found")?;
        
        let status: String = org_row.get("status");
        
        if status != "active" {
            anyhow::bail!("Organization is not active: {}", status);
        }
        
        Ok(AuthenticatedUser {
            user_id: claims.sub,
            organization_id: organization_id.to_string(),
            role,
            email: claims.email,
        })
    }
    
    /// Check if user has permission for an action
    pub fn authorize(&self, user: &AuthenticatedUser, action: Action) -> Result<()> {
        if !self.rbac.has_permission(&user.role, &action) {
            warn!("⛔ Authorization failed: user {} (role: {}) attempted {:?}", 
                  user.user_id, user.role, action);
            anyhow::bail!("User role '{}' not authorized for action {:?}", user.role, action);
        }
        
        info!("✅ Authorization granted: user {} can {:?}", user.user_id, action);
        Ok(())
    }
    
    /// Log access attempt to audit table
    pub async fn log_access(
        &self,
        db_pool: &Pool,
        user: &AuthenticatedUser,
        action: &str,
        query: Option<&str>,
        results_count: Option<i32>,
        response_time_ms: Option<i32>,
        success: bool,
        error_message: Option<&str>,
    ) -> Result<()> {
        let client = db_pool.get().await?;
        
        client
            .execute(
                "INSERT INTO security.search_access_logs (
                    organization_id, user_id, action, query, 
                    results_count, response_time_ms, success, error_message
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                &[
                    &uuid::Uuid::parse_str(&user.organization_id)?,
                    &uuid::Uuid::parse_str(&user.user_id)?,
                    &action,
                    &query,
                    &results_count,
                    &response_time_ms,
                    &success,
                    &error_message,
                ],
            )
            .await?;
        
        Ok(())
    }
    
    /// Log security incident
    pub async fn log_incident(
        &self,
        db_pool: &Pool,
        organization_id: Option<&str>,
        user_id: Option<&str>,
        incident_type: &str,
        severity: &str,
        description: &str,
        details: Option<serde_json::Value>,
    ) -> Result<()> {
        let client = db_pool.get().await?;
        
        let org_uuid = organization_id.map(|id| uuid::Uuid::parse_str(id)).transpose()?;
        let user_uuid = user_id.map(|id| uuid::Uuid::parse_str(id)).transpose()?;
        
        client
            .execute(
                "INSERT INTO security.security_incidents (
                    organization_id, user_id, incident_type, 
                    severity, description, details
                ) VALUES ($1, $2, $3, $4, $5, $6)",
                &[
                    &org_uuid,
                    &user_uuid,
                    &incident_type,
                    &severity,
                    &description,
                    &details,
                ],
            )
            .await?;
        
        error!("🚨 Security incident logged: {} - {}", incident_type, description);
        
        Ok(())
    }
    
    /// Check for suspicious activity (rate limiting)
    pub async fn check_rate_limit(
        &self,
        db_pool: &Pool,
        organization_id: &str,
    ) -> Result<bool> {
        let client = db_pool.get().await?;
        
        let row = client
            .query_one(
                "SELECT COUNT(*) as count FROM security.search_access_logs 
                 WHERE organization_id = $1 
                 AND created_at > NOW() - INTERVAL '1 minute'",
                &[&uuid::Uuid::parse_str(organization_id)?],
            )
            .await?;
        
        let count: i64 = row.get("count");
        
        // Default limit: 100 requests per minute
        // TODO: Make this configurable per organization plan
        let limit = 100;
        
        if count > limit {
            warn!("⚠️  Rate limit exceeded for org {}: {} requests/min", 
                  organization_id, count);
            
            self.log_incident(
                db_pool,
                Some(organization_id),
                None,
                "rate_limit_exceeded",
                "medium",
                &format!("Organization exceeded rate limit: {} requests in 1 minute", count),
                Some(serde_json::json!({ "count": count, "limit": limit })),
            ).await?;
            
            return Ok(false);
        }
        
        Ok(true)
    }
}

/// Extract bearer token from Authorization header
pub fn extract_token(auth_header: Option<&str>) -> Result<String> {
    let auth_header = auth_header.context("Missing Authorization header")?;
    
    if !auth_header.starts_with("Bearer ") {
        anyhow::bail!("Invalid Authorization header format");
    }
    
    Ok(auth_header[7..].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rbac_permissions() {
        let rbac = RBAC::new();
        
        // Owner can do everything
        assert!(rbac.has_permission("owner", &Action::Search));
        assert!(rbac.has_permission("owner", &Action::Index));
        assert!(rbac.has_permission("owner", &Action::DeleteIndex));
        
        // Admin cannot delete
        assert!(rbac.has_permission("admin", &Action::Search));
        assert!(rbac.has_permission("admin", &Action::Index));
        assert!(!rbac.has_permission("admin", &Action::DeleteIndex));
        
        // Member can only search and view
        assert!(rbac.has_permission("member", &Action::Search));
        assert!(!rbac.has_permission("member", &Action::Index));
        
        // Viewer can only search
        assert!(rbac.has_permission("viewer", &Action::Search));
        assert!(!rbac.has_permission("viewer", &Action::ViewStats));
    }
    
    #[test]
    fn test_extract_token() {
        let token = extract_token(Some("Bearer abc123")).unwrap();
        assert_eq!(token, "abc123");
        
        assert!(extract_token(None).is_err());
        assert!(extract_token(Some("Invalid")).is_err());
    }
}
