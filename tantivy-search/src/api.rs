use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tantivy::Index;
use deadpool_postgres::Pool;
use crate::{indexer, searcher};

#[derive(Deserialize)]
pub struct IndexRequest {
    pub organization_id: Option<String>,
}

#[derive(Deserialize)]
pub struct SearchRequest {
    pub q: String,
    pub object_type: Option<String>,
    pub repository: Option<String>,
    pub limit: Option<usize>,
    pub organization_id: String,
}

#[derive(Deserialize)]
pub struct AutocompleteRequest {
    pub prefix: String,
    pub organization_id: String,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct SimilarRequest {
    pub object_id: String,
    pub organization_id: String,
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
    pub results: Vec<searcher::SearchResult>,
    pub total: usize,
    pub query: String,
}

#[derive(Serialize)]
pub struct AutocompleteResponse {
    pub suggestions: Vec<String>,
}

#[derive(Serialize)]
pub struct StatsResponse {
    pub num_docs: u64,
    pub size_bytes: u64,
}

/// Health check endpoint
pub async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "tantivy-search",
        "version": "0.1.0"
    }))
}

/// Trigger re-indexing from Supabase
pub async fn trigger_index(
    index: web::Data<Arc<Mutex<Index>>>,
    db_pool: web::Data<Pool>,
    request: web::Json<IndexRequest>,
) -> impl Responder {
    log::info!("🔄 Indexing request received");
    
    let index = index.lock().unwrap();
    
    match indexer::index_all_objects(&index, &db_pool, request.organization_id.clone()).await {
        Ok(count) => {
            log::info!("✅ Indexing complete: {} objects", count);
            HttpResponse::Ok().json(IndexResponse {
                success: true,
                message: format!("Successfully indexed {} objects", count),
                objects_indexed: count,
            })
        }
        Err(e) => {
            log::error!("❌ Indexing failed: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": e.to_string(),
            }))
        }
    }
}

/// Search metadata objects
pub async fn search_query(
    index: web::Data<Arc<Mutex<Index>>>,
    request: web::Query<SearchRequest>,
) -> impl Responder {
    let query = searcher::SearchQuery {
        query: request.q.clone(),
        object_type: request.object_type.clone(),
        repository: request.repository.clone(),
        limit: request.limit,
        organization_id: request.organization_id.clone(),
    };
    
    log::info!("🔍 Search query: {}", query.query);
    
    let index = index.lock().unwrap();
    
    match searcher::search(&index, query) {
        Ok(results) => {
            let total = results.len();
            log::info!("✅ Found {} results", total);
            HttpResponse::Ok().json(SearchResponse {
                results,
                total,
                query: request.q.clone(),
            })
        }
        Err(e) => {
            log::error!("❌ Search failed: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e.to_string(),
            }))
        }
    }
}

/// Autocomplete suggestions
pub async fn autocomplete(
    index: web::Data<Arc<Mutex<Index>>>,
    request: web::Query<AutocompleteRequest>,
) -> impl Responder {
    log::info!("💡 Autocomplete request: {}", request.prefix);
    
    let index = index.lock().unwrap();
    let limit = request.limit.unwrap_or(10);
    
    match searcher::autocomplete(&index, request.prefix.clone(), request.organization_id.clone(), limit) {
        Ok(suggestions) => {
            log::info!("✅ Found {} suggestions", suggestions.len());
            HttpResponse::Ok().json(AutocompleteResponse { suggestions })
        }
        Err(e) => {
            log::error!("❌ Autocomplete failed: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e.to_string(),
            }))
        }
    }
}

/// Find similar objects
pub async fn find_similar(
    index: web::Data<Arc<Mutex<Index>>>,
    request: web::Query<SimilarRequest>,
) -> impl Responder {
    log::info!("🔗 Finding similar to: {}", request.object_id);
    
    let index = index.lock().unwrap();
    let limit = request.limit.unwrap_or(10);
    
    match searcher::find_similar(&index, request.object_id.clone(), request.organization_id.clone(), limit) {
        Ok(results) => {
            log::info!("✅ Found {} similar objects", results.len());
            HttpResponse::Ok().json(SearchResponse {
                results,
                total: results.len(),
                query: request.object_id.clone(),
            })
        }
        Err(e) => {
            log::error!("❌ Similar search failed: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e.to_string(),
            }))
        }
    }
}

/// Get index statistics
pub async fn index_stats(
    index: web::Data<Arc<Mutex<Index>>>,
) -> impl Responder {
    let index = index.lock().unwrap();
    
    // Get segment info
    let segments = index.searchable_segment_metas().unwrap();
    let num_docs: u64 = segments.iter().map(|s| s.num_docs() as u64).sum();
    let size_bytes: u64 = segments.iter().map(|s| s.total_num_bytes()).sum();
    
    HttpResponse::Ok().json(StatsResponse {
        num_docs,
        size_bytes,
    })
}
