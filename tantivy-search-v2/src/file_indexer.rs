use tantivy::{Index, IndexWriter, TantivyError};
use tantivy::directory::MmapDirectory;
use std::path::Path;
use log::{info, error};
use crate::file_schema::{FileDocument, create_file_schema, file_doc_to_tantivy};
use crate::storage::SupabaseStorage;

/// Build a file index for an organization
pub async fn build_file_index(
    organization_id: &str,
    files: Vec<FileDocument>,
    storage: &SupabaseStorage,
) -> Result<(usize, String), Box<dyn std::error::Error>> {
    info!("🔨 Building file index for org: {}", organization_id);
    info!("   Files to index: {}", files.len());

    let start = std::time::Instant::now();

    // Create temporary directory for index
    let temp_dir = tempfile::tempdir()?;
    let index_path = temp_dir.path();

    // Create schema and index
    let schema = create_file_schema();
    let index = Index::create_in_dir(index_path, schema.clone())?;
    
    // Get index writer
    let mut index_writer: IndexWriter = index.writer(50_000_000)?;

    // Index all files
    for file_doc in &files {
        let doc = file_doc_to_tantivy(file_doc, &schema);
        index_writer.add_document(doc)?;
    }

    // Commit changes
    index_writer.commit()?;
    info!("   ✅ Committed {} files to index", files.len());

    // Upload to Supabase Storage
    let storage_path = format!("{}/files", organization_id);
    
    // Delete old file index before uploading (prevent 409 Duplicate errors)
    info!("   🗑️  Deleting old file index (if exists)...");
    let _ = storage.delete_index(&storage_path).await; // Ignore error if doesn't exist
    
    info!("   📤 Uploading file index to storage: {}", storage_path);

    // Upload new index
    storage.upload_index(&storage_path, index_path).await?;
    
    let elapsed = start.elapsed();
    info!("   ⏱️  File indexing completed in {:.2}s", elapsed.as_secs_f64());

    Ok((files.len(), storage_path))
}

/// Load file index from storage for searching
pub async fn load_file_index(
    organization_id: &str,
    storage: &SupabaseStorage,
    cache_dir: &Path,
) -> Result<Index, Box<dyn std::error::Error>> {
    let storage_path = format!("{}/files", organization_id);
    let local_path = cache_dir.join(format!("{}_files", organization_id));

    // Check if already cached
    if local_path.exists() {
        info!("📦 Loading file index from cache: {:?}", local_path);
        let schema = create_file_schema();
        let index = Index::open_in_dir(&local_path)?;
        return Ok(index);
    }

    // Download from storage
    info!("📥 Downloading file index for org: {}", organization_id);
    storage.download_index(&storage_path, &local_path).await?;

    // Open index
    let index = Index::open_in_dir(&local_path)?;

    Ok(index)
}

/// Search files index
pub async fn search_files(
    organization_id: &str,
    query: &str,
    storage: &SupabaseStorage,
    cache_dir: &Path,
    options: FileSearchOptions,
) -> Result<FileSearchResults, Box<dyn std::error::Error>> {
    use tantivy::collector::TopDocs;
    use tantivy::query::QueryParser;

    // Load index
    let index = load_file_index(organization_id, storage, cache_dir).await?;
    let reader = index.reader()?;
    let searcher = reader.searcher();

    let schema = index.schema();

    // Build query across multiple fields
    let mut fields = vec![
        schema.get_field("content")?,
        schema.get_field("file_name")?,
        schema.get_field("file_path")?,
        schema.get_field("functions")?,
        schema.get_field("classes")?,
        schema.get_field("comments")?,
        schema.get_field("documentation")?,
    ];

    let query_parser = QueryParser::for_index(&index, fields);
    let parsed_query = query_parser.parse_query(query)?;

    // Search
    let limit = options.limit.unwrap_or(20);
    let top_docs = searcher.search(&parsed_query, &TopDocs::with_limit(limit))?;

    // Convert results
    let mut results = Vec::new();
    for (score, doc_address) in top_docs {
        let retrieved_doc: tantivy::TantivyDocument = searcher.doc(doc_address)?;
        
        // Helper function to extract text field
        let get_text = |field_name: &str| -> String {
            retrieved_doc
                .get_first(schema.get_field(field_name).unwrap())
                .map(|v| {
                    if let tantivy::schema::OwnedValue::Str(s) = v {
                        s.clone()
                    } else {
                        String::new()
                    }
                })
                .unwrap_or_default()
        };
        
        // Extract fields
        let file_id = get_text("file_id");
        let file_path = get_text("file_path");
        let file_name = get_text("file_name");
        let repository_name = get_text("repository_name");
        let file_type = get_text("file_type");
        let language = get_text("language");
        let content = get_text("content");
        
        let content_snippet = if content.len() > 200 {
            format!("{}...", &content[..200])
        } else {
            content.to_string()
        };

        results.push(crate::file_schema::FileSearchResult {
            file_id,
            repository_name,
            file_path,
            file_name,
            file_type,
            language,
            content_snippet,
            line_count: 0, // TODO: Extract from stored field
            size_bytes: 0, // TODO: Extract from stored field
            last_modified: String::new(), // TODO: Extract from stored field
            score,
            matched_in: vec![], // TODO: Determine which fields matched
        });
    }

    let total = results.len();
    Ok(FileSearchResults {
        results,
        total,
        query: query.to_string(), // query here is the string parameter
    })
}

#[derive(Debug, Clone)]
pub struct FileSearchOptions {
    pub limit: Option<usize>,
    pub file_type: Option<String>,
    pub repository_name: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct FileSearchResults {
    pub results: Vec<crate::file_schema::FileSearchResult>,
    pub total: usize,
    pub query: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_search_options() {
        let options = FileSearchOptions {
            limit: Some(10),
            file_type: Some("sql".to_string()),
            repository_name: None,
            language: Some("sql".to_string()),
        };

        assert_eq!(options.limit, Some(10));
        assert_eq!(options.file_type, Some("sql".to_string()));
    }
}
