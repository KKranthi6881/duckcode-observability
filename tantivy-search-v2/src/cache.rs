use anyhow::Result;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use std::fs;
use log::{info, warn};
use sha2::{Sha256, Digest};

/// Cache entry metadata
#[derive(Debug, Clone)]
struct CacheEntry {
    path: PathBuf,
    last_accessed: u64,
    size_bytes: u64,
    version: u32,
}

/// Local cache manager for Tantivy indexes
pub struct CacheManager {
    cache_dir: PathBuf,
    entries: HashMap<String, CacheEntry>,
    max_cache_size_bytes: u64,
    ttl_seconds: u64,
}

impl CacheManager {
    /// Create new cache manager
    pub fn new() -> Self {
        let cache_dir = PathBuf::from(
            std::env::var("CACHE_DIR")
                .unwrap_or_else(|_| "/tmp/tantivy_cache".to_string())
        );
        
        let max_cache_size_bytes = std::env::var("MAX_CACHE_SIZE_MB")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(1024) // Default: 1GB
            * 1024 * 1024;
        
        let ttl_seconds = std::env::var("CACHE_TTL_SECONDS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(3600); // Default: 1 hour
        
        // Create cache directory
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir).ok();
        }
        
        info!("📦 Cache manager initialized");
        info!("   Cache dir: {:?}", cache_dir);
        info!("   Max size: {} MB", max_cache_size_bytes / 1024 / 1024);
        info!("   TTL: {} seconds", ttl_seconds);
        
        Self {
            cache_dir,
            entries: HashMap::new(),
            max_cache_size_bytes,
            ttl_seconds,
        }
    }
    
    /// Get cache key for an organization
    fn get_cache_key(&self, org_id: &str) -> String {
        // Use SHA256 hash of org_id for safe filesystem names
        let mut hasher = Sha256::new();
        hasher.update(org_id.as_bytes());
        let result = hasher.finalize();
        format!("{:x}", result)
    }
    
    /// Get cache path for an organization
    pub fn get_cache_path(&self, org_id: &str) -> PathBuf {
        let cache_key = self.get_cache_key(org_id);
        self.cache_dir.join(cache_key)
    }
    
    /// Check if index is cached and valid
    pub fn is_cached(&mut self, org_id: &str) -> bool {
        let cache_path = self.get_cache_path(org_id);
        
        if !cache_path.exists() {
            return false;
        }
        
        // Check if cache entry exists
        if let Some(entry) = self.entries.get(org_id) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            // Check TTL
            if now - entry.last_accessed > self.ttl_seconds {
                info!("⏰ Cache expired for org {}", org_id);
                self.invalidate_cache(org_id).ok();
                return false;
            }
            
            info!("✅ Cache hit for org {}", org_id);
            return true;
        }
        
        // Entry not in memory but directory exists - recover it
        if let Ok(size) = self.get_directory_size(&cache_path) {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            self.entries.insert(org_id.to_string(), CacheEntry {
                path: cache_path.clone(),
                last_accessed: now,
                size_bytes: size,
                version: 1,
            });
            
            info!("♻️  Recovered cache entry for org {}", org_id);
            return true;
        }
        
        false
    }
    
    /// Add index to cache
    pub fn cache_index(&mut self, org_id: &str, version: u32) -> Result<()> {
        let cache_path = self.get_cache_path(org_id);
        
        if !cache_path.exists() {
            anyhow::bail!("Cache path does not exist: {:?}", cache_path);
        }
        
        let size = self.get_directory_size(&cache_path)?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        // Check if we need to evict old entries
        self.ensure_cache_space(size)?;
        
        self.entries.insert(org_id.to_string(), CacheEntry {
            path: cache_path,
            last_accessed: now,
            size_bytes: size,
            version,
        });
        
        info!("💾 Cached index for org {} (v{}, {} bytes)", org_id, version, size);
        
        Ok(())
    }
    
    /// Invalidate cache for an organization
    pub fn invalidate_cache(&mut self, org_id: &str) -> Result<()> {
        let cache_path = self.get_cache_path(org_id);
        
        if cache_path.exists() {
            fs::remove_dir_all(&cache_path)?;
            info!("🗑️  Invalidated cache for org {}", org_id);
        }
        
        self.entries.remove(org_id);
        
        Ok(())
    }
    
    /// Update last accessed time
    pub fn touch(&mut self, org_id: &str) {
        if let Some(entry) = self.entries.get_mut(org_id) {
            entry.last_accessed = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
        }
    }
    
    /// Get cache statistics
    pub fn get_stats(&self) -> CacheStats {
        let total_size: u64 = self.entries.values().map(|e| e.size_bytes).sum();
        let entry_count = self.entries.len();
        
        CacheStats {
            entry_count,
            total_size_bytes: total_size,
            max_size_bytes: self.max_cache_size_bytes,
            hit_rate: 0.0, // TODO: Track hits/misses
        }
    }
    
    /// Ensure we have space for new entry (LRU eviction)
    fn ensure_cache_space(&mut self, required_bytes: u64) -> Result<()> {
        let current_size: u64 = self.entries.values().map(|e| e.size_bytes).sum();
        
        if current_size + required_bytes <= self.max_cache_size_bytes {
            return Ok(());
        }
        
        warn!("⚠️  Cache full, evicting old entries...");
        
        // Sort by last accessed (oldest first) and collect org_ids to evict
        let mut entries: Vec<_> = self.entries.iter().map(|(id, e)| (id.clone(), e.last_accessed, e.size_bytes)).collect();
        entries.sort_by_key(|(_, accessed, _)| *accessed);
        
        let mut to_evict = Vec::new();
        let mut freed_bytes = 0u64;
        
        for (org_id, _, size_bytes) in entries {
            if current_size + required_bytes - freed_bytes <= self.max_cache_size_bytes {
                break;
            }
            
            to_evict.push(org_id);
            freed_bytes += size_bytes;
        }
        
        // Now evict the collected org_ids
        for org_id in to_evict {
            info!("   Evicting cache for org {}", org_id);
            self.invalidate_cache(&org_id).ok();
        }
        
        info!("✅ Freed {} bytes from cache", freed_bytes);
        
        Ok(())
    }
    
    /// Get directory size recursively
    fn get_directory_size(&self, path: &Path) -> Result<u64> {
        let mut size = 0u64;
        
        if path.is_file() {
            return Ok(fs::metadata(path)?.len());
        }
        
        if path.is_dir() {
            for entry in fs::read_dir(path)? {
                let entry = entry?;
                let entry_path = entry.path();
                
                if entry_path.is_file() {
                    size += fs::metadata(&entry_path)?.len();
                } else if entry_path.is_dir() {
                    size += self.get_directory_size(&entry_path)?;
                }
            }
        }
        
        Ok(size)
    }
    
    /// Cleanup old cache entries (should be called periodically)
    pub fn cleanup_expired(&mut self) -> Result<()> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let expired: Vec<String> = self.entries
            .iter()
            .filter(|(_, entry)| now - entry.last_accessed > self.ttl_seconds)
            .map(|(org_id, _)| org_id.clone())
            .collect();
        
        for org_id in expired {
            info!("🧹 Cleaning up expired cache for org {}", org_id);
            self.invalidate_cache(&org_id)?;
        }
        
        Ok(())
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub entry_count: usize,
    pub total_size_bytes: u64,
    pub max_size_bytes: u64,
    pub hit_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_cache_key_generation() {
        let cache_dir = TempDir::new().unwrap();
        std::env::set_var("CACHE_DIR", cache_dir.path().to_str().unwrap());
        
        let cache = CacheManager::new();
        let key1 = cache.get_cache_key("org-123");
        let key2 = cache.get_cache_key("org-123");
        let key3 = cache.get_cache_key("org-456");
        
        assert_eq!(key1, key2);
        assert_ne!(key1, key3);
    }
    
    #[test]
    fn test_cache_operations() {
        let cache_dir = TempDir::new().unwrap();
        std::env::set_var("CACHE_DIR", cache_dir.path().to_str().unwrap());
        
        let mut cache = CacheManager::new();
        let org_id = "test-org";
        
        // Initially not cached
        assert!(!cache.is_cached(org_id));
        
        // Create a test directory
        let test_cache_path = cache.get_cache_path(org_id);
        fs::create_dir_all(&test_cache_path).unwrap();
        fs::write(test_cache_path.join("test.txt"), b"hello").unwrap();
        
        // Add to cache
        cache.cache_index(org_id, 1).unwrap();
        
        // Now it should be cached
        assert!(cache.is_cached(org_id));
        
        // Invalidate
        cache.invalidate_cache(org_id).unwrap();
        assert!(!cache.is_cached(org_id));
    }
}
