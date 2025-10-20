use tantivy::{Index, IndexReader, ReloadPolicy};
use tantivy::collector::TopDocs;
use tantivy::query::{QueryParser, FuzzyTermQuery, BooleanQuery, Occur, TermQuery};
use tantivy::schema::*;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use crate::schema::FieldNames;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub object_id: String,
    pub name: String,
    pub full_name: Option<String>,
    pub description: Option<String>,
    pub object_type: String,
    pub file_path: Option<String>,
    pub repository_name: Option<String>,
    pub confidence_score: f64,
    pub score: f32,  // Search relevance score
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub object_type: Option<String>,
    pub repository: Option<String>,
    pub limit: Option<usize>,
    pub organization_id: String,
}

/// Search for metadata objects
pub fn search(index: &Index, query: SearchQuery) -> Result<Vec<SearchResult>> {
    let reader: IndexReader = index
        .reader_builder()
        .reload_policy(ReloadPolicy::OnCommit)
        .try_into()?;
    
    let searcher = reader.searcher();
    let schema = index.schema();
    let fields = FieldNames::from_schema(&schema);
    
    // Build query parser for multiple fields
    let mut query_parser = QueryParser::for_index(
        index,
        vec![
            fields.name,
            fields.full_name,
            fields.description,
            fields.definition,
            fields.columns,
        ],
    );
    
    query_parser.set_conjunction_by_default();
    
    // Parse main query
    let main_query = query_parser.parse_query(&query.query)?;
    
    // Build boolean query with filters
    let mut subqueries: Vec<(Occur, Box<dyn tantivy::query::Query>)> = vec![
        (Occur::Must, Box::new(main_query)),
    ];
    
    // Add organization filter (required)
    let org_term = Term::from_field_text(fields.organization_id, &query.organization_id);
    subqueries.push((
        Occur::Must,
        Box::new(TermQuery::new(org_term, IndexRecordOption::Basic)),
    ));
    
    // Add object type filter if specified
    if let Some(obj_type) = &query.object_type {
        let type_term = Term::from_field_text(fields.object_type, obj_type);
        subqueries.push((
            Occur::Must,
            Box::new(TermQuery::new(type_term, IndexRecordOption::Basic)),
        ));
    }
    
    // Add repository filter if specified
    if let Some(repo) = &query.repository {
        let repo_term = Term::from_field_text(fields.repository_name, repo);
        subqueries.push((
            Occur::Must,
            Box::new(TermQuery::new(repo_term, IndexRecordOption::Basic)),
        ));
    }
    
    let combined_query = BooleanQuery::new(subqueries);
    
    // Execute search
    let limit = query.limit.unwrap_or(20);
    let top_docs = searcher.search(&combined_query, &TopDocs::with_limit(limit))?;
    
    // Convert results
    let mut results = Vec::new();
    
    for (score, doc_address) in top_docs {
        let retrieved_doc = searcher.doc(doc_address)?;
        
        let result = SearchResult {
            object_id: get_text_field(&retrieved_doc, fields.object_id).unwrap_or_default(),
            name: get_text_field(&retrieved_doc, fields.name).unwrap_or_default(),
            full_name: get_text_field(&retrieved_doc, fields.full_name),
            description: get_text_field(&retrieved_doc, fields.description),
            object_type: get_text_field(&retrieved_doc, fields.object_type).unwrap_or_default(),
            file_path: get_text_field(&retrieved_doc, fields.file_path),
            repository_name: get_text_field(&retrieved_doc, fields.repository_name),
            confidence_score: get_f64_field(&retrieved_doc, fields.confidence_score).unwrap_or(0.0),
            score,
        };
        
        results.push(result);
    }
    
    Ok(results)
}

/// Fuzzy search for autocomplete
pub fn autocomplete(index: &Index, prefix: String, organization_id: String, limit: usize) -> Result<Vec<String>> {
    let reader: IndexReader = index
        .reader_builder()
        .reload_policy(ReloadPolicy::OnCommit)
        .try_into()?;
    
    let searcher = reader.searcher();
    let schema = index.schema();
    let fields = FieldNames::from_schema(&schema);
    
    // Create fuzzy term query on name field
    let term = Term::from_field_text(fields.name, &prefix);
    let fuzzy_query = FuzzyTermQuery::new(term, 2, true); // distance=2, prefix=true
    
    // Add organization filter
    let org_term = Term::from_field_text(fields.organization_id, &organization_id);
    let org_query = TermQuery::new(org_term, IndexRecordOption::Basic);
    
    let combined_query = BooleanQuery::new(vec![
        (Occur::Must, Box::new(fuzzy_query) as Box<dyn tantivy::query::Query>),
        (Occur::Must, Box::new(org_query) as Box<dyn tantivy::query::Query>),
    ]);
    
    let top_docs = searcher.search(&combined_query, &TopDocs::with_limit(limit))?;
    
    let mut suggestions = Vec::new();
    
    for (_score, doc_address) in top_docs {
        let retrieved_doc = searcher.doc(doc_address)?;
        if let Some(name) = get_text_field(&retrieved_doc, fields.name) {
            if !suggestions.contains(&name) {
                suggestions.push(name);
            }
        }
    }
    
    Ok(suggestions)
}

/// Find similar objects based on name similarity
pub fn find_similar(
    index: &Index,
    object_id: String,
    organization_id: String,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    let reader: IndexReader = index
        .reader_builder()
        .reload_policy(ReloadPolicy::OnCommit)
        .try_into()?;
    
    let searcher = reader.searcher();
    let schema = index.schema();
    let fields = FieldNames::from_schema(&schema);
    
    // First, get the original object
    let id_term = Term::from_field_text(fields.object_id, &object_id);
    let id_query = TermQuery::new(id_term, IndexRecordOption::Basic);
    
    let original_docs = searcher.search(&id_query, &TopDocs::with_limit(1))?;
    
    if original_docs.is_empty() {
        return Ok(vec![]);
    }
    
    let original_doc = searcher.doc(original_docs[0].1)?;
    let original_name = get_text_field(&original_doc, fields.name).unwrap_or_default();
    
    // Now search for similar names
    let fuzzy_term = Term::from_field_text(fields.name, &original_name);
    let fuzzy_query = FuzzyTermQuery::new(fuzzy_term, 2, false);
    
    // Add organization filter
    let org_term = Term::from_field_text(fields.organization_id, &organization_id);
    let org_query = TermQuery::new(org_term, IndexRecordOption::Basic);
    
    // Exclude the original object
    let exclude_term = Term::from_field_text(fields.object_id, &object_id);
    let exclude_query = TermQuery::new(exclude_term, IndexRecordOption::Basic);
    
    let combined_query = BooleanQuery::new(vec![
        (Occur::Must, Box::new(fuzzy_query) as Box<dyn tantivy::query::Query>),
        (Occur::Must, Box::new(org_query) as Box<dyn tantivy::query::Query>),
        (Occur::MustNot, Box::new(exclude_query) as Box<dyn tantivy::query::Query>),
    ]);
    
    let top_docs = searcher.search(&combined_query, &TopDocs::with_limit(limit))?;
    
    let mut results = Vec::new();
    
    for (score, doc_address) in top_docs {
        let retrieved_doc = searcher.doc(doc_address)?;
        
        let result = SearchResult {
            object_id: get_text_field(&retrieved_doc, fields.object_id).unwrap_or_default(),
            name: get_text_field(&retrieved_doc, fields.name).unwrap_or_default(),
            full_name: get_text_field(&retrieved_doc, fields.full_name),
            description: get_text_field(&retrieved_doc, fields.description),
            object_type: get_text_field(&retrieved_doc, fields.object_type).unwrap_or_default(),
            file_path: get_text_field(&retrieved_doc, fields.file_path),
            repository_name: get_text_field(&retrieved_doc, fields.repository_name),
            confidence_score: get_f64_field(&retrieved_doc, fields.confidence_score).unwrap_or(0.0),
            score,
        };
        
        results.push(result);
    }
    
    Ok(results)
}

// Helper functions

fn get_text_field(doc: &tantivy::TantivyDocument, field: Field) -> Option<String> {
    doc.get_first(field)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn get_f64_field(doc: &tantivy::TantivyDocument, field: Field) -> Option<f64> {
    doc.get_first(field)
        .and_then(|v| v.as_f64())
}
