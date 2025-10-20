use tantivy::{Index, IndexWriter, TantivyDocument};
use tantivy::schema::*;
use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::schema::FieldNames;

#[derive(Debug, Serialize, Deserialize)]
pub struct MetadataObject {
    pub id: String,
    pub name: String,
    pub full_name: Option<String>,
    pub description: Option<String>,
    pub object_type: String,
    pub file_path: Option<String>,
    pub repository_name: Option<String>,
    pub definition: Option<String>,
    pub confidence_score: Option<f64>,
    pub organization_id: String,
    pub connection_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Index all metadata objects from Supabase into Tantivy
pub async fn index_all_objects(
    index: &Index,
    db_pool: &Pool,
    organization_id: Option<String>,
) -> Result<usize> {
    log::info!("📊 Starting indexing process...");
    
    // Get database connection
    let client = db_pool.get().await?;
    
    // Build query
    let query = if let Some(org_id) = &organization_id {
        format!(
            "SELECT o.id, o.name, o.full_name, o.description, o.object_type, 
                    f.relative_path as file_path, r.name as repository_name,
                    o.definition, o.confidence_score, o.organization_id, 
                    o.connection_id, o.created_at, o.updated_at
             FROM metadata.objects o
             LEFT JOIN metadata.files f ON o.file_id = f.id
             LEFT JOIN metadata.repositories r ON o.repository_id = r.id
             WHERE o.organization_id = '{}'",
            org_id
        )
    } else {
        "SELECT o.id, o.name, o.full_name, o.description, o.object_type, 
                f.relative_path as file_path, r.name as repository_name,
                o.definition, o.confidence_score, o.organization_id, 
                o.connection_id, o.created_at, o.updated_at
         FROM metadata.objects o
         LEFT JOIN metadata.files f ON o.file_id = f.id
         LEFT JOIN metadata.repositories r ON o.repository_id = r.id".to_string()
    };
    
    // Fetch objects from database
    let rows = client.query(&query, &[]).await?;
    
    log::info!("📦 Found {} objects to index", rows.len());
    
    // Get index writer
    let mut index_writer: IndexWriter = index.writer(50_000_000)?; // 50MB buffer
    
    // Get schema and fields
    let schema = index.schema();
    let fields = FieldNames::from_schema(&schema);
    
    // Index each object
    let mut indexed_count = 0;
    
    for row in rows {
        let object = MetadataObject {
            id: row.get("id"),
            name: row.get("name"),
            full_name: row.get("full_name"),
            description: row.get("description"),
            object_type: row.get("object_type"),
            file_path: row.get("file_path"),
            repository_name: row.get("repository_name"),
            definition: row.get("definition"),
            confidence_score: row.get("confidence_score"),
            organization_id: row.get("organization_id"),
            connection_id: row.get("connection_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        };
        
        // Create Tantivy document
        let mut doc = TantivyDocument::default();
        
        doc.add_text(fields.object_id, &object.id);
        doc.add_text(fields.name, &object.name);
        
        if let Some(full_name) = &object.full_name {
            doc.add_text(fields.full_name, full_name);
        }
        
        if let Some(description) = &object.description {
            doc.add_text(fields.description, description);
        }
        
        doc.add_text(fields.object_type, &object.object_type);
        
        if let Some(file_path) = &object.file_path {
            doc.add_text(fields.file_path, file_path);
        }
        
        if let Some(repo_name) = &object.repository_name {
            doc.add_text(fields.repository_name, repo_name);
        }
        
        if let Some(definition) = &object.definition {
            doc.add_text(fields.definition, definition);
        }
        
        doc.add_f64(fields.confidence_score, object.confidence_score.unwrap_or(0.0));
        doc.add_text(fields.organization_id, &object.organization_id);
        doc.add_text(fields.connection_id, &object.connection_id);
        
        doc.add_date(fields.created_at, object.created_at.into());
        doc.add_date(fields.updated_at, object.updated_at.into());
        
        // Get columns for this object
        let columns_query = format!(
            "SELECT name FROM metadata.columns WHERE object_id = '{}'",
            object.id
        );
        let column_rows = client.query(&columns_query, &[]).await?;
        let columns: Vec<String> = column_rows.iter()
            .map(|r| r.get::<_, String>("name"))
            .collect();
        
        if !columns.is_empty() {
            doc.add_text(fields.columns, &columns.join(", "));
        }
        
        // Add document to index
        index_writer.add_document(doc)?;
        indexed_count += 1;
        
        if indexed_count % 100 == 0 {
            log::info!("   Indexed {} objects...", indexed_count);
        }
    }
    
    // Commit changes
    index_writer.commit()?;
    
    log::info!("✅ Successfully indexed {} objects", indexed_count);
    
    Ok(indexed_count)
}

/// Delete all documents for an organization
pub async fn clear_organization_index(
    index: &Index,
    organization_id: &str,
) -> Result<()> {
    log::info!("🗑️  Clearing index for organization: {}", organization_id);
    
    let schema = index.schema();
    let fields = FieldNames::from_schema(&schema);
    
    let mut index_writer = index.writer(50_000_000)?;
    
    // Delete all documents for this organization
    index_writer.delete_term(Term::from_field_text(fields.organization_id, organization_id));
    index_writer.commit()?;
    
    log::info!("✅ Cleared organization index");
    
    Ok(())
}
