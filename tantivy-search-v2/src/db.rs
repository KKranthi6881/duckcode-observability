use deadpool_postgres::{Config, Manager, ManagerConfig, Pool, RecyclingMethod, Runtime};
use tokio_postgres::NoTls;
use anyhow::Result;
use log::info;

/// Create database connection pool
pub async fn create_pool() -> Result<Pool> {
    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:54322/postgres".to_string());
    
    info!("🗄️  Connecting to database...");
    
    let mut cfg = Config::new();
    cfg.url = Some(db_url);
    cfg.manager = Some(ManagerConfig {
        recycling_method: RecyclingMethod::Fast,
    });
    
    let pool = cfg.create_pool(Some(Runtime::Tokio1), NoTls)?;
    
    // Test connection
    let client = pool.get().await?;
    let row = client.query_one("SELECT 1 as test", &[]).await?;
    let test: i32 = row.get("test");
    
    if test == 1 {
        info!("✅ Database connection successful");
    }
    
    Ok(pool)
}
