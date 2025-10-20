use tantivy::schema::*;
use tantivy::Index;
use serde::{Deserialize, Serialize};

/// File document structure for indexing
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileDocument {
    pub file_id: String,
    pub organization_id: String,
    pub repository_id: String,
    pub repository_name: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub relative_path: String,
    
    // Content
    pub content: String,
    pub functions: String,      // Space-separated function names
    pub classes: String,         // Space-separated class names
    pub imports: String,         // Space-separated imports
    pub symbols: String,         // Variable names, constants
    pub comments: String,        // Extracted comments
    pub documentation: String,   // README sections, doc blocks
    
    // Metadata
    pub language: String,
    pub size_bytes: u64,
    pub line_count: u32,
    pub last_modified: String,
    
    // Flags
    pub is_main_file: bool,
    pub is_config: bool,
    pub is_test: bool,
}

/// Create Tantivy schema for file indexing
pub fn create_file_schema() -> Schema {
    let mut schema_builder = Schema::builder();

    // IDs - stored and indexed
    schema_builder.add_text_field("file_id", STRING | STORED);
    schema_builder.add_text_field("organization_id", STRING | STORED);
    schema_builder.add_text_field("repository_id", STRING | STORED);
    
    // File identification - stored and indexed
    schema_builder.add_text_field("repository_name", TEXT | STORED);
    schema_builder.add_text_field("file_path", TEXT | STORED);
    schema_builder.add_text_field("file_name", TEXT | STORED);
    schema_builder.add_text_field("file_type", STRING | STORED);
    schema_builder.add_text_field("relative_path", STORED);
    
    // Content fields - heavily indexed for search
    // Boost content field for relevance
    let text_options = TextOptions::default()
        .set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer("default")
                .set_index_option(IndexRecordOption::WithFreqsAndPositions),
        )
        .set_stored();
    schema_builder.add_text_field("content", text_options.clone());
    
    // Code structure fields
    schema_builder.add_text_field("functions", TEXT);
    schema_builder.add_text_field("classes", TEXT);
    schema_builder.add_text_field("imports", TEXT);
    schema_builder.add_text_field("symbols", TEXT);
    schema_builder.add_text_field("comments", TEXT);
    schema_builder.add_text_field("documentation", TEXT);
    
    // Metadata
    schema_builder.add_text_field("language", STRING | STORED);
    schema_builder.add_u64_field("size_bytes", STORED);
    schema_builder.add_u64_field("line_count", STORED);
    schema_builder.add_date_field("last_modified", INDEXED | STORED);
    
    // Boolean flags
    schema_builder.add_bool_field("is_main_file", STORED);
    schema_builder.add_bool_field("is_config", STORED);
    schema_builder.add_bool_field("is_test", STORED);

    schema_builder.build()
}

/// Convert FileDocument to Tantivy Document
pub fn file_doc_to_tantivy(file_doc: &FileDocument, schema: &Schema) -> tantivy::TantivyDocument {
    let mut doc = tantivy::TantivyDocument::default();

    // IDs
    doc.add_text(schema.get_field("file_id").unwrap(), &file_doc.file_id);
    doc.add_text(schema.get_field("organization_id").unwrap(), &file_doc.organization_id);
    doc.add_text(schema.get_field("repository_id").unwrap(), &file_doc.repository_id);
    
    // File identification
    doc.add_text(schema.get_field("repository_name").unwrap(), &file_doc.repository_name);
    doc.add_text(schema.get_field("file_path").unwrap(), &file_doc.file_path);
    doc.add_text(schema.get_field("file_name").unwrap(), &file_doc.file_name);
    doc.add_text(schema.get_field("file_type").unwrap(), &file_doc.file_type);
    doc.add_text(schema.get_field("relative_path").unwrap(), &file_doc.relative_path);
    
    // Content
    doc.add_text(schema.get_field("content").unwrap(), &file_doc.content);
    doc.add_text(schema.get_field("functions").unwrap(), &file_doc.functions);
    doc.add_text(schema.get_field("classes").unwrap(), &file_doc.classes);
    doc.add_text(schema.get_field("imports").unwrap(), &file_doc.imports);
    doc.add_text(schema.get_field("symbols").unwrap(), &file_doc.symbols);
    doc.add_text(schema.get_field("comments").unwrap(), &file_doc.comments);
    doc.add_text(schema.get_field("documentation").unwrap(), &file_doc.documentation);
    
    // Metadata
    doc.add_text(schema.get_field("language").unwrap(), &file_doc.language);
    doc.add_u64(schema.get_field("size_bytes").unwrap(), file_doc.size_bytes);
    doc.add_u64(schema.get_field("line_count").unwrap(), file_doc.line_count as u64);
    
    // Parse and add date
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&file_doc.last_modified) {
        doc.add_date(schema.get_field("last_modified").unwrap(), tantivy::DateTime::from_timestamp_secs(dt.timestamp()));
    }
    
    // Flags
    doc.add_bool(schema.get_field("is_main_file").unwrap(), file_doc.is_main_file);
    doc.add_bool(schema.get_field("is_config").unwrap(), file_doc.is_config);
    doc.add_bool(schema.get_field("is_test").unwrap(), file_doc.is_test);

    doc
}

/// Search result for files
#[derive(Debug, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub file_id: String,
    pub repository_name: String,
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub language: String,
    pub content_snippet: String,
    pub line_count: u32,
    pub size_bytes: u64,
    pub last_modified: String,
    pub score: f32,
    pub matched_in: Vec<String>, // Which fields matched: "content", "functions", "comments"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_schema_creation() {
        let schema = create_file_schema();
        
        // Verify key fields exist
        assert!(schema.get_field("file_id").is_ok());
        assert!(schema.get_field("organization_id").is_ok());
        assert!(schema.get_field("content").is_ok());
        assert!(schema.get_field("functions").is_ok());
        assert!(schema.get_field("language").is_ok());
    }

    #[test]
    fn test_file_doc_conversion() {
        let schema = create_file_schema();
        
        let file_doc = FileDocument {
            file_id: "test-123".to_string(),
            organization_id: "org-456".to_string(),
            repository_id: "repo-789".to_string(),
            repository_name: "test-repo".to_string(),
            file_path: "models/customer.sql".to_string(),
            file_name: "customer.sql".to_string(),
            file_type: "sql".to_string(),
            relative_path: "models/customer.sql".to_string(),
            content: "SELECT * FROM customers".to_string(),
            functions: "get_customer calculate_revenue".to_string(),
            classes: "".to_string(),
            imports: "pandas numpy".to_string(),
            symbols: "customer_id email".to_string(),
            comments: "Main customer table".to_string(),
            documentation: "".to_string(),
            language: "sql".to_string(),
            size_bytes: 1024,
            line_count: 50,
            last_modified: "2024-01-01T00:00:00Z".to_string(),
            is_main_file: false,
            is_config: false,
            is_test: false,
        };

        let tantivy_doc = file_doc_to_tantivy(&file_doc, &schema);
        
        // Document should have content
        assert!(!tantivy_doc.field_values().is_empty());
    }
}
