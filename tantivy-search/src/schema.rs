use tantivy::schema::*;
use tantivy::{Index, IndexWriter};
use anyhow::Result;
use std::path::Path;

/// Create Tantivy schema for metadata objects
pub fn build_schema() -> Schema {
    let mut schema_builder = Schema::builder();

    // Primary fields
    schema_builder.add_text_field("object_id", STRING | STORED);
    schema_builder.add_text_field("name", TEXT | STORED);
    schema_builder.add_text_field("full_name", TEXT | STORED);
    schema_builder.add_text_field("description", TEXT | STORED);
    
    // Type and categorization
    schema_builder.add_text_field("object_type", STRING | STORED | FAST);
    schema_builder.add_text_field("file_path", TEXT | STORED);
    schema_builder.add_text_field("repository_name", STRING | STORED | FAST);
    
    // Searchable content
    schema_builder.add_text_field("definition", TEXT);
    schema_builder.add_text_field("columns", TEXT | STORED);
    schema_builder.add_text_field("tags", TEXT | STORED);
    
    // Metadata
    schema_builder.add_f64_field("confidence_score", FAST | STORED);
    schema_builder.add_text_field("organization_id", STRING | FAST);
    schema_builder.add_text_field("connection_id", STRING | FAST);
    
    // Dates
    schema_builder.add_date_field("created_at", FAST | STORED);
    schema_builder.add_date_field("updated_at", FAST | STORED);
    
    schema_builder.build()
}

/// Create or open Tantivy index
pub fn create_index() -> Result<Index> {
    let index_path = Path::new("./tantivy_index");
    
    if !index_path.exists() {
        std::fs::create_dir_all(index_path)?;
    }

    let schema = build_schema();
    
    // Try to open existing index, or create new one
    let index = match Index::open_in_dir(index_path) {
        Ok(index) => {
            log::info!("📂 Opened existing Tantivy index");
            index
        }
        Err(_) => {
            log::info!("🆕 Creating new Tantivy index");
            Index::create_in_dir(index_path, schema.clone())?
        }
    };

    Ok(index)
}

/// Get field names for querying
pub struct FieldNames {
    pub object_id: Field,
    pub name: Field,
    pub full_name: Field,
    pub description: Field,
    pub object_type: Field,
    pub file_path: Field,
    pub repository_name: Field,
    pub definition: Field,
    pub columns: Field,
    pub tags: Field,
    pub confidence_score: Field,
    pub organization_id: Field,
    pub connection_id: Field,
    pub created_at: Field,
    pub updated_at: Field,
}

impl FieldNames {
    pub fn from_schema(schema: &Schema) -> Self {
        FieldNames {
            object_id: schema.get_field("object_id").unwrap(),
            name: schema.get_field("name").unwrap(),
            full_name: schema.get_field("full_name").unwrap(),
            description: schema.get_field("description").unwrap(),
            object_type: schema.get_field("object_type").unwrap(),
            file_path: schema.get_field("file_path").unwrap(),
            repository_name: schema.get_field("repository_name").unwrap(),
            definition: schema.get_field("definition").unwrap(),
            columns: schema.get_field("columns").unwrap(),
            tags: schema.get_field("tags").unwrap(),
            confidence_score: schema.get_field("confidence_score").unwrap(),
            organization_id: schema.get_field("organization_id").unwrap(),
            connection_id: schema.get_field("connection_id").unwrap(),
            created_at: schema.get_field("created_at").unwrap(),
            updated_at: schema.get_field("updated_at").unwrap(),
        }
    }
}
