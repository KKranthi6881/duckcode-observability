use actix_web::{web, HttpRequest, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use deadpool_postgres::Pool;
use std::sync::{Arc, Mutex};
use log::{info, error};
use crate::security::{SecurityService, Action, extract_token};
use crate::storage::SupabaseStorage;
use crate::cache::CacheManager;
use crate::indexer::Indexer;
use crate::searcher::{Searcher, SearchQuery};

#[derive(Deserialize)]
pub struct IndexRequest {
    pub organization_id: String,
}

#[derive(Deserialize)]
pub struct SearchRequest {
    pub q: String,
    pub object_type: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct AutocompleteRequest {
    pub prefix: String,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct SimilarRequest {
    pub object_id: String,
    pub limit: Option<usize>,
}

#[derive(Serialize)]
pub struct IndexResponse {
    pub success: bool,
    pub message: String,
    pub objects_indexed: usize,
}

#[derive(Serialize)]
pub struct SearchResponse {
    pub results: Vec<crate::searcher::SearchResult>,
    pub total: usize,
    pub query: String,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub num_docs: i32,
    pub size_mb: f64,
    pub last_indexed_at: Option<String>,
    pub status: String,
}

/// Health check endpoint (no auth required)
pub async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "tantivy-search-v2",
        "version": "2.0.0",
        "security": "enterprise-grade"
    }))
}

/// Trigger indexing for organization
pub async fn trigger_index(
    req: HttpRequest,
    body: web::Json<IndexRequest>,
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
                "error": "Authentication failed",
                "message": e.to_string()
            }));
        }
    };
    
    // 3. Check RBAC permission
    if let Err(e) = security.authorize(&user, Action::Index) {
        error!("❌ Authorization failed: {}", e);
        security.log_access(&db_pool, &user, "index", None, None, None, false, Some(&e.to_string())).await.ok();
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Forbidden",
            "message": e.to_string()
        }));
    }
    
    // 4. Verify user is indexing their own org
    if user.organization_id != body.organization_id {
        let msg = "Cannot index another organization";
        error!("❌ {}", msg);
        security.log_access(&db_pool, &user, "index", None, None, None, false, Some(msg)).await.ok();
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Forbidden",
            "message": msg
        }));
    }
    
    // 5. Execute indexing
    let indexer = Indexer::new(Arc::as_ref(&**storage).clone());
    
    match indexer.index_organization(&body.organization_id, &db_pool).await {
        Ok(count) => {
            let duration_ms = start_time.elapsed().as_millis() as i32;
            
            // Log success
            security.log_access(
                &db_pool,
                &user,
                "index",
                None,
                Some(count as i32),
                Some(duration_ms),
                true,
                None
            ).await.ok();
            
            info!("✅ Indexing successful: {} objects", count);
            
            HttpResponse::Ok().json(IndexResponse {
                success: true,
                message: format!("Successfully indexed {} objects", count),
                objects_indexed: count,
            })
        }
        Err(e) => {
            error!("❌ Indexing failed: {}", e);
            
            // Log failure
            security.log_access(
                &db_pool,
                &user,
                "index",
                None,
                None,
                None,
                false,
                Some(&e.to_string())
            ).await.ok();
            
            HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": e.to_string(),
            }))
        }
    }
}

/// Search query endpoint
pub async fn search_query(
    req: HttpRequest,
    query_params: web::Query<SearchRequest>,
    db_pool: web::Data<Pool>,
    storage: web::Data<Arc<SupabaseStorage>>,
    cache: web::Data<Arc<Mutex<CacheManager>>>,
) -> impl Responder {
    let start_time = std::time::Instant::now();
    
    // 1. Authenticate
    let token = match extract_token(req.headers().get("authorization").and_then(|h| h.to_str().ok())) {
        Ok(t) => t,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    let security = match SecurityService::new() {
        Ok(s) => s,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    };
    
    let user = match security.authenticate(&token, &db_pool).await {
        Ok(u) => u,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    // 2. Authorize
    if let Err(e) = security.authorize(&user, Action::Search) {
        security.log_access(&db_pool, &user, "search", Some(&query_params.q), None, None, false, Some(&e.to_string())).await.ok();
        return HttpResponse::Forbidden().json(serde_json::json!({"error": e.to_string()}));
    }
    
    // 3. Rate limit check
    if let Ok(false) = security.check_rate_limit(&db_pool, &user.organization_id).await {
        return HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Rate limit exceeded"
        }));
    }
    
    // 4. Execute search
    let searcher = Searcher::new(storage.as_ref().clone(), cache.as_ref().clone());
    
    let search_query = SearchQuery {
        query: query_params.q.clone(),
        object_type: query_params.object_type.clone(),
        limit: query_params.limit,
    };
    
    match searcher.search(&user.organization_id, &search_query).await {
        Ok(results) => {
            let duration_ms = start_time.elapsed().as_millis() as i32;
            let result_count = results.len();
            
            // Log success
            security.log_access(
                &db_pool,
                &user,
                "search",
                Some(&query_params.q),
                Some(result_count as i32),
                Some(duration_ms),
                true,
                None
            ).await.ok();
            
            HttpResponse::Ok().json(SearchResponse {
                results,
                total: result_count,
                query: query_params.q.clone(),
            })
        }
        Err(e) => {
            error!("❌ Search failed: {}", e);
            security.log_access(&db_pool, &user, "search", Some(&query_params.q), None, None, false, Some(&e.to_string())).await.ok();
            HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
        }
    }
}

/// Autocomplete endpoint
pub async fn autocomplete(
    req: HttpRequest,
    query_params: web::Query<AutocompleteRequest>,
    db_pool: web::Data<Pool>,
    storage: web::Data<Arc<SupabaseStorage>>,
    cache: web::Data<Arc<Mutex<CacheManager>>>,
) -> impl Responder {
    // Auth
    let token = match extract_token(req.headers().get("authorization").and_then(|h| h.to_str().ok())) {
        Ok(t) => t,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    let security = match SecurityService::new() {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Internal error"})),
    };
    
    let user = match security.authenticate(&token, &db_pool).await {
        Ok(u) => u,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    if let Err(_) = security.authorize(&user, Action::Search) {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": "Forbidden"}));
    }
    
    // Execute
    let searcher = Searcher::new(storage.as_ref().clone(), cache.as_ref().clone());
    let limit = query_params.limit.unwrap_or(10);
    
    match searcher.autocomplete(&user.organization_id, &query_params.prefix, limit).await {
        Ok(suggestions) => HttpResponse::Ok().json(serde_json::json!({"suggestions": suggestions})),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

/// Find similar objects endpoint
pub async fn find_similar(
    req: HttpRequest,
    query_params: web::Query<SimilarRequest>,
    db_pool: web::Data<Pool>,
    storage: web::Data<Arc<SupabaseStorage>>,
    cache: web::Data<Arc<Mutex<CacheManager>>>,
) -> impl Responder {
    // Auth
    let token = match extract_token(req.headers().get("authorization").and_then(|h| h.to_str().ok())) {
        Ok(t) => t,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    let security = match SecurityService::new() {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Internal error"})),
    };
    
    let user = match security.authenticate(&token, &db_pool).await {
        Ok(u) => u,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    if let Err(_) = security.authorize(&user, Action::Search) {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": "Forbidden"}));
    }
    
    // Execute
    let searcher = Searcher::new(storage.as_ref().clone(), cache.as_ref().clone());
    let limit = query_params.limit.unwrap_or(10);
    
    match searcher.find_similar(&user.organization_id, &query_params.object_id, limit).await {
        Ok(results) => {
            let total = results.len();
            HttpResponse::Ok().json(SearchResponse {
                results,
                total,
                query: query_params.object_id.clone(),
            })
        },
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}

/// Index statistics endpoint
pub async fn index_stats(
    req: HttpRequest,
    db_pool: web::Data<Pool>,
) -> impl Responder {
    // Auth
    let token = match extract_token(req.headers().get("authorization").and_then(|h| h.to_str().ok())) {
        Ok(t) => t,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    let security = match SecurityService::new() {
        Ok(s) => s,
        Err(_) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": "Internal error"})),
    };
    
    let user = match security.authenticate(&token, &db_pool).await {
        Ok(u) => u,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({"error": e.to_string()})),
    };
    
    if let Err(_) = security.authorize(&user, Action::ViewStats) {
        return HttpResponse::Forbidden().json(serde_json::json!({"error": "Forbidden"}));
    }
    
    // Query database for stats
    let client = match db_pool.get().await {
        Ok(c) => c,
        Err(e) => return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    };
    
    let org_uuid = match uuid::Uuid::parse_str(&user.organization_id) {
        Ok(u) => u,
        Err(e) => return HttpResponse::BadRequest().json(serde_json::json!({"error": e.to_string()})),
    };
    
    match client.query_opt(
        "SELECT document_count, size_bytes, last_indexed_at, status 
         FROM metadata.tantivy_indexes 
         WHERE organization_id = $1 
         ORDER BY version DESC 
         LIMIT 1",
        &[&org_uuid],
    ).await {
        Ok(Some(row)) => {
            let document_count: i32 = row.get("document_count");
            let size_bytes: i64 = row.get("size_bytes");
            let last_indexed_at: chrono::DateTime<chrono::Utc> = row.get("last_indexed_at");
            let status: String = row.get("status");
            
            HttpResponse::Ok().json(StatsResponse {
                num_docs: document_count,
                size_mb: (size_bytes as f64) / 1024.0 / 1024.0,
                last_indexed_at: Some(last_indexed_at.to_rfc3339()),
                status,
            })
        }
        Ok(None) => {
            HttpResponse::Ok().json(StatsResponse {
                num_docs: 0,
                size_mb: 0.0,
                last_indexed_at: None,
                status: "not_indexed".to_string(),
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()})),
    }
}
