import axios from 'axios';

/**
 * Tantivy Search Service
 * Internal service - users don't need to know about this
 */
export class TantivySearchService {
  private static instance: TantivySearchService;
  private baseUrl: string;
  private jwtSecret: string;

  private constructor() {
    this.baseUrl = process.env.TANTIVY_SERVICE_URL || 'http://localhost:3002';
    this.jwtSecret = process.env.JWT_SECRET || '';
  }

  static getInstance(): TantivySearchService {
    if (!TantivySearchService.instance) {
      TantivySearchService.instance = new TantivySearchService();
    }
    return TantivySearchService.instance;
  }

  /**
   * Trigger search index creation for an organization
   * Called automatically after metadata extraction completes
   */
  async triggerIndexing(organizationId: string): Promise<void> {
    try {
      console.log(`🔍 Triggering search index creation for org: ${organizationId}`);
      console.log(`   Tantivy URL: ${this.baseUrl}`);
      console.log(`   JWT Secret configured: ${this.jwtSecret ? 'YES' : 'NO'}`);

      // Generate service JWT token
      const token = this.generateServiceToken(organizationId);
      console.log(`   Generated JWT token (first 20 chars): ${token.substring(0, 20)}...`);

      const response = await axios.post(
        `${this.baseUrl}/api/v2/search/index`,
        { organization_id: organizationId },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000 // 2 minutes timeout for large indexes
        }
      );

      if (response.data.success) {
        console.log(`✅ Search index created: ${response.data.objects_indexed} objects indexed`);
        console.log(`   Index stored in Supabase Storage with org ID: ${organizationId}`);
      } else {
        console.warn(`⚠️  Search indexing returned unsuccessful response:`, response.data);
      }
    } catch (error) {
      // Don't fail the whole extraction if indexing fails
      // User can always rebuild the index later
      if (axios.isAxiosError(error)) {
        console.error(`⚠️  Search indexing failed (non-critical):`);
        console.error(`   Status: ${error.response?.status}`);
        console.error(`   Message: ${error.response?.data?.message || error.message}`);
        console.error(`   URL: ${error.config?.url}`);
      } else {
        console.warn(`⚠️  Search indexing failed (non-critical):`, error instanceof Error ? error.message : error);
      }
    }
  }

  /**
   * Generate a service-to-service JWT token
   * This is for internal communication between backend and Tantivy service
   */
  private generateServiceToken(organizationId: string): string {
    const jwt = require('jsonwebtoken');
    
    const payload = {
      sub: 'backend-service',
      organization_id: organizationId,
      role: 'admin', // Backend always has admin access
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes expiry
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Search using Tantivy (called by API endpoints)
   */
  async search(organizationId: string, query: string, userToken: string, options?: {
    object_type?: string;
    limit?: number;
  }): Promise<any> {
    try {
      // Generate service token for Tantivy (not user token!)
      const serviceToken = this.generateServiceToken(organizationId);
      
      const params = new URLSearchParams({
        q: query,
        ...(options?.object_type && { object_type: options.object_type }),
        ...(options?.limit && { limit: options.limit.toString() })
      });

      const response = await axios.get(
        `${this.baseUrl}/api/v2/search/query?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${serviceToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
}
