use anyhow::{Result, Context};
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::fs;
use walkdir::WalkDir;
use log::{info, error};

/// Supabase Storage client for managing Tantivy indexes
#[derive(Clone)]
pub struct SupabaseStorage {
    client: Client,
    base_url: String,
    service_key: String,
}

impl SupabaseStorage {
    /// Create new Supabase Storage client
    pub fn new() -> Self {
        let base_url = std::env::var("SUPABASE_URL")
            .expect("SUPABASE_URL must be set");
        let service_key = std::env::var("SUPABASE_SERVICE_ROLE_KEY")
            .expect("SUPABASE_SERVICE_ROLE_KEY must be set");

        Self {
            client: Client::new(),
            base_url,
            service_key,
        }
    }

    /// Upload an entire index directory to Supabase Storage
    /// Path in storage: tantivy-indexes/{org_id}/
    pub async fn upload_index(&self, org_id: &str, local_path: &Path) -> Result<()> {
        info!("📤 Uploading index for org {} to Supabase Storage...", org_id);
        
        let mut file_count = 0;
        let mut total_bytes = 0u64;

        // Walk through all files in the index directory
        for entry in WalkDir::new(local_path).follow_links(true) {
            let entry = entry?;
            
            if entry.file_type().is_file() {
                let file_path = entry.path();
                let relative_path = file_path.strip_prefix(local_path)?;
                
                // Upload to: tantivy-indexes/{org_id}/{relative_path}
                let storage_path = format!("{}/{}", org_id, relative_path.display());
                
                let file_data = fs::read(file_path)
                    .context(format!("Failed to read file: {:?}", file_path))?;
                
                let file_size = file_data.len() as u64;
                total_bytes += file_size;
                
                self.upload_file(&storage_path, file_data).await?;
                
                file_count += 1;
                info!("  ✓ Uploaded: {} ({} bytes)", relative_path.display(), file_size);
            }
        }

        info!("✅ Upload complete: {} files, {} bytes total", file_count, total_bytes);
        Ok(())
    }

    /// Upload a single file to Supabase Storage
    async fn upload_file(&self, storage_path: &str, data: Vec<u8>) -> Result<()> {
        let url = format!(
            "{}/storage/v1/object/tantivy-indexes/{}",
            self.base_url, storage_path
        );

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .header("Content-Type", "application/octet-stream")
            .body(data)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unable to read error".to_string());
            error!("❌ Upload failed for {}: {} - {}", storage_path, status, error_text);
            anyhow::bail!("Upload failed for {}: {} - {}", storage_path, status, error_text);
        }

        Ok(())
    }

    /// Download an entire index from Supabase Storage to local directory
    pub async fn download_index(&self, org_id: &str, local_path: &Path) -> Result<()> {
        info!("📥 Downloading index for org {} from Supabase Storage...", org_id);
        
        // Create local directory
        fs::create_dir_all(local_path)?;

        // List all files for this org
        let files = self.list_files(org_id).await?;
        
        let mut file_count = files.len();
        info!("Found {} files to download", file_count);

        let mut total_bytes = 0u64;

        // Download each file
        for file_name in files {
            let storage_path = format!("{}/{}", org_id, file_name);
            let local_file_path = local_path.join(&file_name);

            // Create parent directories
            if let Some(parent) = local_file_path.parent() {
                fs::create_dir_all(parent)?;
            }

            let file_data = self.download_file(&storage_path).await?;
            let file_size = file_data.len() as u64;
            total_bytes += file_size;

            fs::write(&local_file_path, file_data)?;
            
            file_count += 1;
            info!("  ✓ Downloaded: {} ({} bytes)", file_name, file_size);
        }

        info!("✅ Download complete: {} files, {} bytes total", file_count, total_bytes);
        Ok(())
    }

    /// Download a single file from Supabase Storage
    async fn download_file(&self, storage_path: &str) -> Result<Vec<u8>> {
        let url = format!(
            "{}/storage/v1/object/tantivy-indexes/{}",
            self.base_url, storage_path
        );

        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("Download failed: {}", error_text);
        }

        let data = response.bytes().await?.to_vec();
        Ok(data)
    }

    /// List all files for an organization
    async fn list_files(&self, org_id: &str) -> Result<Vec<String>> {
        let url = format!(
            "{}/storage/v1/object/list/tantivy-indexes",
            self.base_url
        );

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .json(&serde_json::json!({
                "prefix": org_id,
                "limit": 1000
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            anyhow::bail!("List files failed: {}", error_text);
        }

        #[derive(serde::Deserialize)]
        struct StorageObject {
            name: String,
        }

        let objects: Vec<StorageObject> = response.json().await?;
        
        // Strip the org_id prefix from file names
        let files: Vec<String> = objects
            .into_iter()
            .map(|obj| {
                obj.name
                    .strip_prefix(&format!("{}/", org_id))
                    .unwrap_or(&obj.name)
                    .to_string()
            })
            .collect();

        Ok(files)
    }

    /// Delete an entire index for an organization
    pub async fn delete_index(&self, org_id: &str) -> Result<()> {
        info!("🗑️  Deleting index for org {} from Supabase Storage...", org_id);
        
        let mut total_deleted = 0;
        
        // Delete main index files (metadata objects)
        let files = self.list_files(org_id).await?;
        for file_name in files {
            let storage_path = format!("{}/{}", org_id, file_name);
            self.delete_file(&storage_path).await?;
            total_deleted += 1;
        }
        
        // Delete file index (stored in /files subdirectory)
        let files_subdir_path = format!("{}/files", org_id);
        let file_index_files = self.list_files(&files_subdir_path).await?;
        for file_name in file_index_files {
            let storage_path = format!("{}/{}", files_subdir_path, file_name);
            self.delete_file(&storage_path).await?;
            total_deleted += 1;
        }

        info!("✅ Deleted {} files for org {}", total_deleted, org_id);
        Ok(())
    }

    /// Delete a single file from Supabase Storage
    async fn delete_file(&self, storage_path: &str) -> Result<()> {
        let url = format!(
            "{}/storage/v1/object/tantivy-indexes/{}",
            self.base_url, storage_path
        );

        let response = self.client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("Delete failed for {}: {}", storage_path, error_text);
        }

        Ok(())
    }

    /// Check if an index exists for an organization
    pub async fn index_exists(&self, org_id: &str) -> Result<bool> {
        let files = self.list_files(org_id).await?;
        Ok(!files.is_empty())
    }

    /// Get index size in bytes
    pub async fn get_index_size(&self, org_id: &str) -> Result<u64> {
        let url = format!(
            "{}/storage/v1/object/list/tantivy-indexes",
            self.base_url
        );

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.service_key))
            .json(&serde_json::json!({
                "prefix": org_id,
                "limit": 1000
            }))
            .send()
            .await?;

        #[derive(serde::Deserialize)]
        struct StorageObject {
            metadata: Option<serde_json::Value>,
        }

        let objects: Vec<StorageObject> = response.json().await?;
        
        let total_size: u64 = objects
            .iter()
            .filter_map(|obj| {
                obj.metadata.as_ref()
                    .and_then(|m| m.get("size"))
                    .and_then(|s| s.as_u64())
            })
            .sum();

        Ok(total_size)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_upload_download_cycle() {
        // This test requires valid Supabase credentials
        // Skip if not available
        if std::env::var("SUPABASE_URL").is_err() {
            return;
        }

        let storage = SupabaseStorage::new();
        let test_org_id = "test-org-123";

        // Create temp directory with test file
        let temp_dir = TempDir::new().unwrap();
        let test_file = temp_dir.path().join("test.txt");
        fs::write(&test_file, b"Hello, Tantivy!").unwrap();

        // Upload
        storage.upload_index(test_org_id, temp_dir.path()).await.unwrap();

        // Download to different location
        let download_dir = TempDir::new().unwrap();
        storage.download_index(test_org_id, download_dir.path()).await.unwrap();

        // Verify
        let downloaded_file = download_dir.path().join("test.txt");
        let content = fs::read_to_string(downloaded_file).unwrap();
        assert_eq!(content, "Hello, Tantivy!");

        // Cleanup
        storage.delete_index(test_org_id).await.unwrap();
    }
}
