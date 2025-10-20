use actix_web::{web, HttpRequest, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use deadpool_postgres::Pool;
use std::sync::{Arc, Mutex};
use log::{info, error};
use crate::security::{SecurityService, Action, extract_token};
use crate::storage::SupabaseStorage;
use crate::cache::CacheManager;
use crate::file_schema::FileDocument;
use crate::file_indexer::{build_file_index, search_files, FileSearchOptions};

/// Simple test endpoint to verify module is loaded  
pub async fn test_file_api() -> HttpResponse {
    HttpResponse::Ok().body("File API works!")
}

#[derive(Deserialize)]
pub struct FileIndexRequest {
    pub organization_id: String,
    pub repository_id: String,
    pub files: Vec<FileDocument>,
}

#[derive(Deserialize)]
pub struct FileSearchRequest {
    pub q: String,
    pub file_type: Option<String>,
    pub repository_name: Option<String>,
    pub language: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Serialize)]
pub struct FileIndexResponse {
    pub success: bool,
    pub message: String,
    pub files_indexed: usize,
}

/// Trigger file indexing for organization
pub async fn trigger_file_index(
    req: HttpRequest,
    body: web::Json<FileIndexRequest>,
    db_pool: web::Data<Pool>,
    storage: web::Data<Arc<SupabaseStorage>>,
) -> impl Responder {
    let start_time = std::time::Instant::now();
    
    // 1. Extract and validate JWT
    let token = match extract_token(req.headers().get("authorization").and_then(|h| h.to_str().ok())) {
        Ok(t) => t,
        Err(e) => {
            error!("❌ Auth failed: {}", e);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized",
                "message": e.to_string()
            }));
        }
    };
    
    // 2. Authenticate user
    let security = match SecurityService::new() {
        Ok(s) => s,
        Err(e) => {
            error!("❌ Security service init failed: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal error"
            }));
        }
    };
    
    let user = match security.authenticate(&token, &db_pool).await {
        Ok(u) => u,
        Err(e) => {
            error!("❌ Authentication failed: {}", e);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized",
                "message": "Invalid token"
            }));
        }
    };
    
    // 3. Check if user can index for this organization
    if user.organization_id != body.organization_id {
        error!("❌ Org mismatch: user org {} != request org {}", user.organization_id, body.organization_id);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Forbidden",
            "message": "Cannot index for different organization"
        }));
    }
    
    // 4. Authorize action
    if let Err(e) = security.authorize(&user, Action::Index) {
        error!("❌ Authorization failed: {}", e);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Forbidden",
            "message": "Insufficient permissions"
        }));
    }
    
    info!("🔨 File indexing request from user: {} for org: {}", user.user_id, user.organization_id);
    info!("   Repository: {}", body.repository_id);
    info!("   Files: {}", body.files.len());
    
    // 5. Build file index
    let (files_indexed, storage_path) = match build_file_index(
        &body.organization_id,
        body.files.clone(),
        &storage,
    ).await {
        Ok(result) => result,
        Err(e) => {
            error!("❌ File indexing failed: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Indexing failed",
                "message": e.to_string()
            }));
        }
    };
    
    // 6. Update database with file index metadata
    let client = match db_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            error!("❌ DB connection failed: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }));
        }
    };
    
    let org_uuid = match uuid::Uuid::parse_str(&body.organization_id) {
        Ok(u) => u,
        Err(e) => {
            error!("❌ Invalid org UUID: {}", e);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid organization ID"
            }));
        }
    };
    
    let repo_uuid = match uuid::Uuid::parse_str(&body.repository_id) {
        Ok(u) => u,
        Err(e) => {
            error!("❌ Invalid repo UUID: {}", e);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid repository ID"
            }));
        }
    };
    
    // Insert/update file index record
    match client.execute(
        "INSERT INTO metadata.file_indexes 
         (organization_id, repository_id, repository_name, document_count, size_bytes, index_path, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (organization_id, repository_id) 
         DO UPDATE SET 
            document_count = $4,
            size_bytes = $5,
            last_indexed_at = NOW(),
            updated_at = NOW(),
            status = 'active'",
        &[
            &org_uuid,
            &repo_uuid,
            &body.files.first().map(|f| f.repository_name.as_str()).unwrap_or("unknown"),
            &(files_indexed as i32),
            &0i64, // TODO: Calculate actual size
            &storage_path,
        ],
    ).await {
        Ok(_) => info!("✅ File index metadata saved to database"),
        Err(e) => error!("⚠️  Failed to save file index metadata: {}", e),
    }
    
    let elapsed = start_time.elapsed();
    info!("⏱️  Total file indexing time: {:.2}s", elapsed.as_secs_f64());
    
    HttpResponse::Ok().json(FileIndexResponse {
        success: true,
        message: format!("Successfully indexed {} files", files_indexed),
        files_indexed,
    })
}

/// Search files
pub async fn search_files_query(
    req: HttpRequest,
    query: web::Query<FileSearchRequest>,
    db_pool: web::Data<Pool>,
    storage: web::Data<Arc<SupabaseStorage>>,
    cache: web::Data<Arc<Mutex<CacheManager>>>,
) -> impl Responder {
    // 1. Extract and validate JWT
    let token = match extract_token(req.headers().get("authorization").and_then(|h| h.to_str().ok())) {
        Ok(t) => t,
        Err(e) => {
            error!("❌ Auth failed: {}", e);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };
    
    // 2. Authenticate user
    let security = match SecurityService::new() {
        Ok(s) => s,
        Err(e) => {
            error!("❌ Security service init failed: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal error"
            }));
        }
    };
    
    let user = match security.authenticate(&token, &db_pool).await {
        Ok(u) => u,
        Err(e) => {
            error!("❌ Authentication failed: {}", e);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };
    
    info!("🔍 File search request from user: {} for org: {}", user.user_id, user.organization_id);
    info!("   Query: {}", query.q);
    
    // 3. Get cache directory from environment
    use std::path::PathBuf;
    let cache_dir = PathBuf::from(
        std::env::var("CACHE_DIR")
            .unwrap_or_else(|_| "/tmp/tantivy_cache".to_string())
    );
    
    // 4. Search files
    let options = FileSearchOptions {
        limit: query.limit,
        file_type: query.file_type.clone(),
        repository_name: query.repository_name.clone(),
        language: query.language.clone(),
    };
    
    match search_files(
        &user.organization_id,
        &query.q,
        &storage,
        &cache_dir,
        options,
    ).await {
        Ok(results) => {
            info!("   ✅ Found {} file results", results.total);
            HttpResponse::Ok().json(results)
        }
        Err(e) => {
            error!("❌ File search failed: {}", e);
            
            // Check if index doesn't exist
            if e.to_string().contains("No such file or directory") || e.to_string().contains("not found") {
                return HttpResponse::NotFound().json(serde_json::json!({
                    "error": "File index not found",
                    "message": "Please index files first"
                }));
            }
            
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Search failed",
                "message": e.to_string()
            }))
        }
    }
}

/// Get file index statistics
pub async fn file_stats(
    req: HttpRequest,
    db_pool: web::Data<Pool>,
) -> impl Responder {
    // 1. Extract and validate JWT
    let token = match extract_token(req.headers().get("authorization").and_then(|h| h.to_str().ok())) {
        Ok(t) => t,
        Err(e) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };
    
    // 2. Authenticate user
    let security = match SecurityService::new() {
        Ok(s) => s,
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Internal error"
            }));
        }
    };
    
    let user = match security.authenticate(&token, &db_pool).await {
        Ok(u) => u,
        Err(e) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };
    
    let client = match db_pool.get().await {
        Ok(c) => c,
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            }));
        }
    };
    
    let org_uuid = match uuid::Uuid::parse_str(&user.organization_id) {
        Ok(u) => u,
        Err(e) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid organization ID"
            }));
        }
    };
    
    // Get file index stats
    match client.query_opt(
        "SELECT document_count, size_bytes, last_indexed_at, status 
         FROM metadata.file_indexes 
         WHERE organization_id = $1 
         ORDER BY last_indexed_at DESC 
         LIMIT 1",
        &[&org_uuid],
    ).await {
        Ok(Some(row)) => {
            let document_count: i32 = row.get("document_count");
            let size_bytes: i64 = row.get("size_bytes");
            let last_indexed_at: chrono::DateTime<chrono::Utc> = row.get("last_indexed_at");
            let status: String = row.get("status");
            
            HttpResponse::Ok().json(serde_json::json!({
                "num_docs": document_count,
                "size_mb": (size_bytes as f64) / 1024.0 / 1024.0,
                "last_indexed_at": last_indexed_at.to_rfc3339(),
                "status": status,
            }))
        }
        Ok(None) => {
            HttpResponse::Ok().json(serde_json::json!({
                "num_docs": 0,
                "size_mb": 0.0,
                "last_indexed_at": null,
                "status": "not_indexed",
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}
