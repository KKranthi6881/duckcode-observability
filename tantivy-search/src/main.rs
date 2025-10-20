mod schema;
mod indexer;
mod searcher;
mod api;
mod db;

use actix_web::{web, App, HttpServer, middleware};
use actix_cors::Cors;
use std::sync::{Arc, Mutex};
use tantivy::Index;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logger
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    dotenv::dotenv().ok();

    log::info!("🚀 Starting Tantivy Search Service...");

    // Initialize Tantivy index
    let index = schema::create_index().expect("Failed to create index");
    let index = Arc::new(Mutex::new(index));

    // Initialize database pool
    let db_pool = db::create_pool().await.expect("Failed to create DB pool");

    let port = std::env::var("PORT").unwrap_or_else(|_| "3002".to_string());
    let bind_address = format!("127.0.0.1:{}", port);

    log::info!("🔍 Tantivy Search Service listening on http://{}", bind_address);
    log::info!("📊 Index ready for searches");

    // Start HTTP server
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(middleware::Logger::default())
            .wrap(cors)
            .app_data(web::Data::new(index.clone()))
            .app_data(web::Data::new(db_pool.clone()))
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
