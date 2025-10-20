use tantivy::schema::*;

/// Build Tantivy schema for metadata objects
/// Following the pattern from IDE implementation
pub fn build_schema() -> Schema {
    let mut schema_builder = Schema::builder();

    // Core fields
    schema_builder.add_text_field("object_id", STRING | STORED);
    schema_builder.add_text_field("name", TEXT | STORED);
    schema_builder.add_text_field("full_name", TEXT | STORED);
    schema_builder.add_text_field("description", TEXT | STORED);
    
    // Categorization
    schema_builder.add_text_field("object_type", STRING | STORED | FAST);
    schema_builder.add_text_field("file_path", TEXT | STORED);
    
    // Searchable content
    schema_builder.add_text_field("definition", TEXT);
    schema_builder.add_text_field("columns", TEXT | STORED);
    
    // Metadata (no org_id needed - each org has separate index!)
    schema_builder.add_f64_field("confidence_score", FAST | STORED);
    schema_builder.add_u64_field("created_at", FAST | STORED); // Use u64 timestamp like IDE
    
    schema_builder.build()
}

/// Field accessor helper
pub struct FieldNames {
    pub object_id: Field,
    pub name: Field,
    pub full_name: Field,
    pub description: Field,
    pub object_type: Field,
    pub file_path: Field,
    pub definition: Field,
    pub columns: Field,
    pub confidence_score: Field,
    pub created_at: Field,
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
            definition: schema.get_field("definition").unwrap(),
            columns: schema.get_field("columns").unwrap(),
            confidence_score: schema.get_field("confidence_score").unwrap(),
            created_at: schema.get_field("created_at").unwrap(),
        }
    }
}
