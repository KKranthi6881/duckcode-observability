use anyhow::{Result, Context};
use tantivy::{Index, IndexWriter, TantivyDocument};
use tantivy::schema::*;
use deadpool_postgres::Pool;
use tempfile::TempDir;
use log::{info, error};
use std::path::Path;
use chrono::{DateTime, Utc};
use crate::schema::{build_schema, FieldNames};
use crate::storage::SupabaseStorage;

#[derive(Debug)]
struct MetadataObject {
    id: String,
    name: String,
    full_name: Option<String>,
    description: Option<String>,
    object_type: String,
    file_path: Option<String>,
    definition: Option<String>,
    confidence_score: Option<f64>,
    created_at: DateTime<Utc>,
    columns: Vec<String>,
}

/// Indexer for building and uploading organization indexes
pub struct Indexer {
    storage: SupabaseStorage,
}

impl Indexer {
    pub fn new(storage: SupabaseStorage) -> Self {
        Self { storage }
    }
    
    /// Index all metadata for an organization
    pub async fn index_organization(&self, org_id: &str, db_pool: &Pool) -> Result<usize> {
        info!("🔨 Starting indexing for organization: {}", org_id);
        
        let start_time = std::time::Instant::now();
        
        // 1. Fetch objects from PostgreSQL
        let objects = self.fetch_objects(org_id, db_pool).await
            .context("Failed to fetch objects from database")?;
        
        info!("📊 Found {} objects to index", objects.len());
        
        if objects.is_empty() {
            info!("⚠️  No objects to index for organization {}", org_id);
            return Ok(0);
        }
        
        // 2. Build index in temp directory
        let temp_dir = TempDir::new().context("Failed to create temp directory")?;
        let index_path = temp_dir.path();
        
        let document_count = self.build_index(&objects, index_path)
            .context("Failed to build Tantivy index")?;
        
        info!("✅ Built index with {} documents", document_count);
        
        // 3. Delete old index from Supabase Storage (if exists)
        info!("🗑️  Deleting old index (if exists)...");
        let _ = self.storage.delete_index(org_id).await; // Ignore error if doesn't exist
        
        // 4. Upload to Supabase Storage
        self.storage.upload_index(org_id, index_path).await
            .context("Failed to upload index to Supabase Storage")?;
        
        info!("📤 Uploaded index to Supabase Storage");
        
        // 4. Update metadata table
        let index_size = self.storage.get_index_size(org_id).await?;
        self.update_metadata(org_id, document_count, index_size, db_pool).await
            .context("Failed to update metadata table")?;
        
        let duration = start_time.elapsed();
        info!("✅ Indexing complete in {:.2}s: {} objects, {} bytes", 
              duration.as_secs_f64(), document_count, index_size);
        
        Ok(document_count)
    }
    
    /// Fetch all objects for an organization from PostgreSQL
    async fn fetch_objects(&self, org_id: &str, db_pool: &Pool) -> Result<Vec<MetadataObject>> {
        let client = db_pool.get().await?;
        
        let org_uuid = uuid::Uuid::parse_str(org_id)?;
        
        // Fetch objects with file info
        let rows = client.query(
            "SELECT 
                o.id, o.name, o.full_name, o.description, o.object_type,
                f.relative_path as file_path, o.definition, 
                CAST(COALESCE(o.confidence, 0.90) AS DOUBLE PRECISION) as confidence_score,
                o.created_at
             FROM metadata.objects o
             LEFT JOIN metadata.files f ON o.file_id = f.id
             WHERE o.organization_id = $1
             ORDER BY o.created_at DESC",
            &[&org_uuid],
        ).await?;
        
        let mut objects = Vec::new();
        
        for row in rows {
            let object_id: uuid::Uuid = row.get("id");
            let object_id_str = object_id.to_string();
            
            // Fetch columns for this object
            let column_rows = client.query(
                "SELECT name FROM metadata.columns WHERE object_id = $1",
                &[&object_id],
            ).await?;
            
            let columns: Vec<String> = column_rows
                .iter()
                .map(|r| r.get::<_, String>("name"))
                .collect();
            
            objects.push(MetadataObject {
                id: object_id_str,
                name: row.get("name"),
                full_name: row.get("full_name"),
                description: row.get("description"),
                object_type: row.get("object_type"),
                file_path: row.get("file_path"),
                definition: row.get("definition"),
                confidence_score: row.get("confidence_score"),
                created_at: row.get("created_at"),
                columns,
            });
        }
        
        Ok(objects)
    }
    
    /// Build Tantivy index from objects
    fn build_index(&self, objects: &[MetadataObject], index_path: &Path) -> Result<usize> {
        info!("🔨 Building Tantivy index...");
        
        // Create schema
        let schema = build_schema();
        let fields = FieldNames::from_schema(&schema);
        
        // Create index
        let index = Index::create_in_dir(index_path, schema.clone())?;
        
        // Get index writer (50MB buffer)
        let mut writer: IndexWriter = index.writer(50_000_000)?;
        
        // Add documents
        for obj in objects {
            let mut doc = TantivyDocument::default();
            
            // Core fields
            doc.add_text(fields.object_id, &obj.id);
            doc.add_text(fields.name, &obj.name);
            
            if let Some(full_name) = &obj.full_name {
                doc.add_text(fields.full_name, full_name);
            }
            
            if let Some(description) = &obj.description {
                doc.add_text(fields.description, description);
            }
            
            doc.add_text(fields.object_type, &obj.object_type);
            
            if let Some(file_path) = &obj.file_path {
                doc.add_text(fields.file_path, file_path);
            }
            
            if let Some(definition) = &obj.definition {
                doc.add_text(fields.definition, definition);
            }
            
            // Columns as comma-separated text
            if !obj.columns.is_empty() {
                doc.add_text(fields.columns, &obj.columns.join(", "));
            }
            
            doc.add_f64(fields.confidence_score, obj.confidence_score.unwrap_or(0.0));
            
            // Convert DateTime to u64 timestamp (following IDE pattern)
            let timestamp = obj.created_at.timestamp() as u64;
            doc.add_u64(fields.created_at, timestamp);
            
            writer.add_document(doc)?;
        }
        
        // Commit
        writer.commit()?;
        
        Ok(objects.len())
    }
    
    /// Update metadata table with index info
    async fn update_metadata(
        &self,
        org_id: &str,
        document_count: usize,
        size_bytes: u64,
        db_pool: &Pool,
    ) -> Result<()> {
        let client = db_pool.get().await?;
        
        let org_uuid = uuid::Uuid::parse_str(org_id)?;
        
        // Get current version or start at 1
        let version_row = client.query_opt(
            "SELECT MAX(version) as max_version 
             FROM metadata.tantivy_indexes 
             WHERE organization_id = $1",
            &[&org_uuid],
        ).await?;
        
        let next_version: i32 = version_row
            .and_then(|r| r.get::<_, Option<i32>>("max_version"))
            .map(|v| v + 1)
            .unwrap_or(1);
        
        // Delete old active index for this org before inserting new one
        client.execute(
            "DELETE FROM metadata.tantivy_indexes 
             WHERE organization_id = $1 AND status = 'active'",
            &[&org_uuid],
        ).await?;
        
        // Insert new index record
        client.execute(
            "INSERT INTO metadata.tantivy_indexes (
                organization_id, version, document_count, size_bytes,
                index_path, status, last_indexed_at
             ) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
            &[
                &org_uuid,
                &next_version,
                &(document_count as i32),
                &(size_bytes as i64),
                &format!("{}/", org_id),
                &"active",
            ],
        ).await?;
        
        info!("📝 Updated metadata table: version {}", next_version);
        
        Ok(())
    }
}
