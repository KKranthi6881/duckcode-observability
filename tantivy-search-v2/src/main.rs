mod storage;
mod security;
mod cache;
mod indexer;
mod searcher;
mod api;
mod db;
mod schema;
mod file_schema; // NEW: File indexing schema
mod file_indexer; // NEW: File indexing logic
mod file_api; // NEW: File API endpoints

use actix_web::{web, App, HttpServer, middleware};
use actix_cors::Cors;
use std::sync::{Arc, Mutex};
use log::info;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logger
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    dotenv::dotenv().ok();

    info!("🚀 Starting Tantivy V2 Search Service (Enterprise Edition)");
    info!("🔒 Security: Per-org isolation + RLS + JWT validation");

    // Initialize database pool
    let db_pool = db::create_pool().await.expect("Failed to create DB pool");
    info!("✅ Database connection established");

    // Initialize cache manager
    let cache = Arc::new(Mutex::new(cache::CacheManager::new()));
    info!("✅ Cache manager initialized");

    // Initialize storage client
    let storage = Arc::new(storage::SupabaseStorage::new());
    info!("✅ Supabase Storage client initialized");

    let port = std::env::var("PORT").unwrap_or_else(|_| "3002".to_string());
    let bind_address = format!("127.0.0.1:{}", port);

    info!("🌐 Server listening on http://{}", bind_address);
    info!("📊 Metadata Search Endpoints:");
    info!("   POST   /api/v2/search/index");
    info!("   GET    /api/v2/search/query");
    info!("   GET    /api/v2/search/autocomplete");
    info!("   GET    /api/v2/search/similar");
    info!("   GET    /api/v2/search/stats");
    info!("📄 File Search Endpoints (NEW):");
    info!("   POST   /api/v2/search/files/index");
    info!("   GET    /api/v2/search/files/query");
    info!("   GET    /api/v2/search/files/stats");
    info!("🏥 Health:");
    info!("   GET    /api/v2/health");

    // Start HTTP server
    HttpServer::new(move || {
        // Configure CORS
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(middleware::Logger::default())
            .wrap(cors)
            .app_data(web::Data::new(db_pool.clone()))
            .app_data(web::Data::new(cache.clone()))
            .app_data(web::Data::new(storage.clone()))
            // IMPORTANT: Register MORE SPECIFIC routes FIRST (files before search)
            // NEW: File search endpoints (must come before /api/v2/search!)
            .service(
                web::scope("/api/v2/search/files")
                    .route("/test", web::get().to(file_api::test_file_api))
                    .route("/index", web::post().to(file_api::trigger_file_index))
                    .route("/query", web::get().to(file_api::search_files_query))
                    .route("/stats", web::get().to(file_api::file_stats))
            )
            // NEW: Legacy file routes
            .service(
                web::scope("/api/search/files")
                    .route("/index", web::post().to(file_api::trigger_file_index))
                    .route("/query", web::get().to(file_api::search_files_query))
                    .route("/stats", web::get().to(file_api::file_stats))
            )
            // Metadata search endpoints
            .service(
                web::scope("/api/v2/search")
                    .route("/health", web::get().to(api::health))
                    .route("/index", web::post().to(api::trigger_index))
                    .route("/query", web::get().to(api::search_query))
                    .route("/autocomplete", web::get().to(api::autocomplete))
                    .route("/similar", web::get().to(api::find_similar))
                    .route("/stats", web::get().to(api::index_stats))
            )
            // Legacy routes for backward compatibility (without /v2)
            .service(
                web::scope("/api/search")
                    .route("/health", web::get().to(api::health))
                    .route("/index", web::post().to(api::trigger_index))
                    .route("/query", web::get().to(api::search_query))
                    .route("/autocomplete", web::get().to(api::autocomplete))
                    .route("/similar", web::get().to(api::find_similar))
                    .route("/stats", web::get().to(api::index_stats))
            )
    })
    .bind(&bind_address)?
    .run()
    .await
}
