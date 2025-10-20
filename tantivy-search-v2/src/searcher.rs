use anyhow::{Result, Context};
use tantivy::{Index, IndexReader, ReloadPolicy};
use tantivy::collector::TopDocs;
use tantivy::query::{QueryParser, FuzzyTermQuery, BooleanQuery, Occur, TermQuery};
use tantivy::schema::*;
use serde::{Serialize, Deserialize};
use log::{info, warn};
use std::sync::{Arc, Mutex};
use crate::schema::{build_schema, FieldNames};
use crate::storage::SupabaseStorage;
use crate::cache::CacheManager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub object_id: String,
    pub name: String,
    pub full_name: Option<String>,
    pub description: Option<String>,
    pub object_type: String,
    pub file_path: Option<String>,
    pub confidence_score: f64,
    pub score: f32,  // Relevance score
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub object_type: Option<String>,
    pub limit: Option<usize>,
}

/// Searcher for querying organization indexes
pub struct Searcher {
    storage: Arc<SupabaseStorage>,
    cache: Arc<Mutex<CacheManager>>,
}

impl Searcher {
    pub fn new(storage: Arc<SupabaseStorage>, cache: Arc<Mutex<CacheManager>>) -> Self {
        Self { storage, cache }
    }
    
    /// Search within an organization's index
    pub async fn search(
        &self,
        org_id: &str,
        search_query: &SearchQuery,
    ) -> Result<Vec<SearchResult>> {
        info!("🔍 Searching org {} for: '{}'", org_id, search_query.query);
        
        let start_time = std::time::Instant::now();
        
        // 1. Ensure index is available (cache or download)
        let index_path = self.ensure_index_available(org_id).await?;
        
        // 2. Open Tantivy index
        let index = Index::open_in_dir(&index_path)
            .context("Failed to open Tantivy index")?;
        
        // 3. Execute search
        let results = self.execute_search(&index, search_query)?;
        
        // 4. Update cache access time
        {
            let mut cache = self.cache.lock().unwrap();
            cache.touch(org_id);
        }
        
        let duration = start_time.elapsed();
        info!("✅ Search complete in {:.2}ms: {} results", 
              duration.as_millis(), results.len());
        
        Ok(results)
    }
    
    /// Autocomplete search (fuzzy prefix matching)
    pub async fn autocomplete(
        &self,
        org_id: &str,
        prefix: &str,
        limit: usize,
    ) -> Result<Vec<String>> {
        info!("💡 Autocomplete for org {}: '{}'", org_id, prefix);
        
        let index_path = self.ensure_index_available(org_id).await?;
        let index = Index::open_in_dir(&index_path)?;
        
        let reader: IndexReader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;
        
        let searcher = reader.searcher();
        let schema = index.schema();
        let fields = FieldNames::from_schema(&schema);
        
        // Fuzzy search on name field
        let term = Term::from_field_text(fields.name, prefix);
        let fuzzy_query = FuzzyTermQuery::new(term, 2, true);
        
        let top_docs = searcher.search(&fuzzy_query, &TopDocs::with_limit(limit))?;
        
        let mut suggestions = Vec::new();
        for (_, doc_address) in top_docs {
            let doc = searcher.doc(doc_address)?;
            if let Some(name) = self.get_text_field(&doc, fields.name) {
                if !suggestions.contains(&name) {
                    suggestions.push(name);
                }
            }
        }
        
        info!("💡 Found {} suggestions", suggestions.len());
        Ok(suggestions)
    }
    
    /// Find similar objects based on name
    pub async fn find_similar(
        &self,
        org_id: &str,
        object_id: &str,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        info!("🔗 Finding similar to {} in org {}", object_id, org_id);
        
        let index_path = self.ensure_index_available(org_id).await?;
        let index = Index::open_in_dir(&index_path)?;
        
        let reader: IndexReader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;
        
        let searcher = reader.searcher();
        let schema = index.schema();
        let fields = FieldNames::from_schema(&schema);
        
        // Find the original object
        let id_term = Term::from_field_text(fields.object_id, object_id);
        let id_query = TermQuery::new(id_term, IndexRecordOption::Basic);
        
        let original_docs = searcher.search(&id_query, &TopDocs::with_limit(1))?;
        
        if original_docs.is_empty() {
            return Ok(vec![]);
        }
        
        let original_doc = searcher.doc(original_docs[0].1)?;
        let original_name = self.get_text_field(&original_doc, fields.name)
            .unwrap_or_default();
        
        // Search for similar names
        let fuzzy_term = Term::from_field_text(fields.name, &original_name);
        let fuzzy_query = FuzzyTermQuery::new(fuzzy_term, 2, false);
        
        // Exclude original
        let exclude_term = Term::from_field_text(fields.object_id, object_id);
        let exclude_query = TermQuery::new(exclude_term, IndexRecordOption::Basic);
        
        let combined_query = BooleanQuery::new(vec![
            (Occur::Must, Box::new(fuzzy_query) as Box<dyn tantivy::query::Query>),
            (Occur::MustNot, Box::new(exclude_query) as Box<dyn tantivy::query::Query>),
        ]);
        
        let top_docs = searcher.search(&combined_query, &TopDocs::with_limit(limit))?;
        
        let results = self.convert_docs_to_results(&searcher, &fields, top_docs)?;
        
        info!("🔗 Found {} similar objects", results.len());
        Ok(results)
    }
    
    /// Ensure index is available (check cache or download)
    async fn ensure_index_available(&self, org_id: &str) -> Result<std::path::PathBuf> {
        let mut cache = self.cache.lock().unwrap();
        
        // Check if cached
        if cache.is_cached(org_id) {
            info!("✅ Cache hit for org {}", org_id);
            return Ok(cache.get_cache_path(org_id));
        }
        
        info!("📥 Cache miss, downloading index for org {}", org_id);
        
        let cache_path = cache.get_cache_path(org_id);
        drop(cache); // Release lock during download
        
        // Download from Supabase Storage
        self.storage.download_index(org_id, &cache_path).await
            .context("Failed to download index from Supabase Storage")?;
        
        // Add to cache
        let mut cache = self.cache.lock().unwrap();
        cache.cache_index(org_id, 1)?;
        
        Ok(cache_path)
    }
    
    /// Execute search query on index
    fn execute_search(
        &self,
        index: &Index,
        search_query: &SearchQuery,
    ) -> Result<Vec<SearchResult>> {
        let reader: IndexReader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;
        
        let searcher = reader.searcher();
        let schema = index.schema();
        let fields = FieldNames::from_schema(&schema);
        
        // Build query parser for multiple fields
        let query_parser = QueryParser::for_index(
            index,
            vec![
                fields.name,
                fields.full_name,
                fields.description,
                fields.definition,
                fields.columns,
            ],
        );
        
        // Parse query
        let main_query = query_parser.parse_query(&search_query.query)?;
        
        // Add object type filter if specified
        let final_query: Box<dyn tantivy::query::Query> = if let Some(obj_type) = &search_query.object_type {
            let type_term = Term::from_field_text(fields.object_type, obj_type);
            let type_query = TermQuery::new(type_term, IndexRecordOption::Basic);
            
            Box::new(BooleanQuery::new(vec![
                (Occur::Must, Box::new(main_query) as Box<dyn tantivy::query::Query>),
                (Occur::Must, Box::new(type_query) as Box<dyn tantivy::query::Query>),
            ]))
        } else {
            Box::new(main_query)
        };
        
        // Execute search
        let limit = search_query.limit.unwrap_or(20);
        let top_docs = searcher.search(&*final_query, &TopDocs::with_limit(limit))?;
        
        // Convert to results
        self.convert_docs_to_results(&searcher, &fields, top_docs)
    }
    
    /// Convert Tantivy documents to SearchResults
    fn convert_docs_to_results(
        &self,
        searcher: &tantivy::Searcher,
        fields: &FieldNames,
        top_docs: Vec<(f32, tantivy::DocAddress)>,
    ) -> Result<Vec<SearchResult>> {
        let mut results = Vec::new();
        
        for (score, doc_address) in top_docs {
            let doc = searcher.doc(doc_address)?;
            
            results.push(SearchResult {
                object_id: self.get_text_field(&doc, fields.object_id).unwrap_or_default(),
                name: self.get_text_field(&doc, fields.name).unwrap_or_default(),
                full_name: self.get_text_field(&doc, fields.full_name),
                description: self.get_text_field(&doc, fields.description),
                object_type: self.get_text_field(&doc, fields.object_type).unwrap_or_default(),
                file_path: self.get_text_field(&doc, fields.file_path),
                confidence_score: self.get_f64_field(&doc, fields.confidence_score).unwrap_or(0.0),
                score,
            });
        }
        
        Ok(results)
    }
    
    /// Helper to get text field from document
    fn get_text_field(&self, doc: &tantivy::TantivyDocument, field: Field) -> Option<String> {
        doc.get_first(field)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }
    
    /// Helper to get f64 field from document
    fn get_f64_field(&self, doc: &tantivy::TantivyDocument, field: Field) -> Option<f64> {
        doc.get_first(field).and_then(|v| v.as_f64())
    }
}
