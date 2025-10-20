/**
 * File Indexing Service
 * Integrates file parsing with Tantivy file index
 */

import axios from 'axios';
import { getFileParserService, ParsedFile } from './file-parsers';

export class FileIndexingService {
  private static instance: FileIndexingService;
  private baseUrl: string;
  private jwtSecret: string;
  private fileParserService: ReturnType<typeof getFileParserService>;

  private constructor() {
    this.baseUrl = process.env.TANTIVY_SERVICE_URL || 'http://localhost:3002';
    this.jwtSecret = process.env.JWT_SECRET || '';
    this.fileParserService = getFileParserService();
  }

  static getInstance(): FileIndexingService {
    if (!FileIndexingService.instance) {
      FileIndexingService.instance = new FileIndexingService();
    }
    return FileIndexingService.instance;
  }

  /**
   * Generate a service-to-service JWT token
   */
  private generateServiceToken(organizationId: string): string {
    const jwt = require('jsonwebtoken');
    
    const payload = {
      sub: 'backend-service',
      organization_id: organizationId,
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Index files for a repository
   * @param files - Array of file objects with content and path
   * @param metadata - Repository and organization metadata
   */
  async indexFiles(
    files: Array<{
      content: string;
      filePath: string;
    }>,
    metadata: {
      organizationId: string;
      repositoryId: string;
      repositoryName: string;
    }
  ): Promise<{ success: boolean; filesIndexed: number; message?: string }> {
    try {
      console.log(`📄 Starting file indexing for repo: ${metadata.repositoryName}`);
      console.log(`   Files to process: ${files.length}`);

      // Parse all files
      const parsedFiles = this.fileParserService.parseFiles(files, metadata);
      
      if (parsedFiles.length === 0) {
        console.log('   ⚠️  No files could be parsed');
        return {
          success: true,
          filesIndexed: 0,
          message: 'No parseable files found'
        };
      }

      console.log(`   ✅ Parsed ${parsedFiles.length} files`);

      // Generate service token
      const token = this.generateServiceToken(metadata.organizationId);

      // Send to Tantivy service
      const response = await axios.post(
        `${this.baseUrl}/api/v2/search/files/index`,
        {
          organization_id: metadata.organizationId,
          repository_id: metadata.repositoryId,
          files: parsedFiles
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 2 minutes
        }
      );

      if (response.data.success) {
        console.log(`   🎉 File indexing complete: ${response.data.files_indexed} files indexed`);
        return {
          success: true,
          filesIndexed: response.data.files_indexed
        };
      } else {
        throw new Error(response.data.message || 'Indexing failed');
      }
    } catch (error) {
      console.error('   ❌ File indexing failed:', error instanceof Error ? error.message : error);
      
      // Don't throw - file indexing is non-critical
      return {
        success: false,
        filesIndexed: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search files using Tantivy
   */
  async searchFiles(
    organizationId: string,
    query: string,
    options?: {
      fileType?: string;
      repositoryName?: string;
      language?: string;
      limit?: number;
    }
  ): Promise<any> {
    try {
      const token = this.generateServiceToken(organizationId);
      
      const params = new URLSearchParams({
        q: query,
        ...(options?.fileType && { file_type: options.fileType }),
        ...(options?.repositoryName && { repository_name: options.repositoryName }),
        ...(options?.language && { language: options.language }),
        ...(options?.limit && { limit: options.limit.toString() })
      });

      const response = await axios.get(
        `${this.baseUrl}/api/v2/search/files/query?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('File search error:', error);
      throw error;
    }
  }

  /**
   * Get supported file types
   */
  getSupportedFileTypes(): string[] {
    return this.fileParserService.getSupportedFileTypes();
  }
}
