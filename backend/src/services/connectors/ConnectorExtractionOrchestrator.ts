import { supabase, supabaseAdmin } from '../../config/supabase';
import { decryptAPIKey } from '../../utils/encryption';
import { ConnectorFactory } from './ConnectorFactory';
import { MetadataStorageService } from '../metadata/storage/MetadataStorageService';
import { PythonSQLGlotParser } from '../metadata/parsers/PythonSQLGlotParser';

export class ConnectorExtractionOrchestrator {
  async extract(connectorId: string, initiatedByUserId: string) {
    // Fetch connector
    const { data: connector, error } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .single();

    if (error || !connector) {
      throw new Error('Connector not found');
    }

    console.log(`[EXTRACT] Starting extraction for connector ${connectorId}`);
    // Decrypt config
    const configStr = decryptAPIKey(
      connector.config_encrypted,
      connector.config_iv,
      connector.config_auth_tag
    );
    const config = JSON.parse(configStr || '{}');
    
    // Debug: Log password length (NOT the actual password)
    console.log('[EXTRACT] Decrypted config:', {
      account: config.account,
      username: config.username,
      passwordLength: config.password?.length || 0,
      hasPassword: !!config.password,
      role: config.role,
      warehouse: config.warehouse
    });

    // Create history row
    const { data: historyRow } = await supabaseAdmin
      .schema('enterprise')
      .from('connector_sync_history')
      .insert({ connector_id: connector.id, status: 'running', metadata: { started_by: initiatedByUserId } })
      .select('id')
      .single();

    const historyId = historyRow?.id;

    try {
      const instance = ConnectorFactory.create(connector.type, connector.name, config);
      await instance.configure(config);
      
      // Test connection before extraction
      console.log('[EXTRACT] Testing connection before extraction...');
      const testResult = await instance.testConnection();
      if (!testResult.success) {
        throw new Error(`Connection test failed: ${testResult.message}`);
      }
      console.log('[EXTRACT] Connection test passed:', testResult.message);
      
      console.log('[EXTRACT] Calling extractMetadata()');
      const result = await this.withTimeout(instance.extractMetadata(), 120000, 'extractMetadata');
      console.log(`[EXTRACT] extractMetadata() done. objects=${result.objects.length}`);

      const storage = new MetadataStorageService();

      // Idempotency: clean existing objects for this connector (cascades to columns & lineage)
      try {
        console.log('[EXTRACT] Cleaning previous objects for connector');
        await supabaseAdmin
          .schema('metadata')
          .from('objects')
          .delete()
          .eq('connector_id', connector.id);
      } catch (e: any) {
        console.warn('[EXTRACT] Cleanup warning (non-fatal):', e?.message || e);
      }

      console.log(`[EXTRACT] Storing repository ${result.repository.path}`);
      const repo = await storage.storeRepository({
        organization_id: connector.organization_id,
        path: result.repository.path,
        name: result.repository.name,
        type: result.repository.type,
        connector_id: connector.id,
      });

      const schemaFileMap = new Map<string, any>();
      const objectIdByKey = new Map<string, string>();
      const viewObjects: Array<{ id: string; name: string; schema?: string | null; database?: string | null; definition?: string }>=[];

      console.log(`[EXTRACT] Storing ${result.objects.length} objects`);
      for (const obj of result.objects) {
        const schemaName = (obj.schema_name || 'PUBLIC').toUpperCase();
        if (!schemaFileMap.has(schemaName)) {
          const absolute_path = `${result.repository.path}/${schemaName}.virtual.sql`;
          const file = await storage.storeFile({
            repository_id: repo.id,
            organization_id: connector.organization_id,
            connection_id: null,
            connector_id: connector.id,
            relative_path: `${schemaName}.virtual.sql`,
            absolute_path,
            file_type: 'sql',
            dialect: 'snowflake',
          });
          schemaFileMap.set(schemaName, file);
        }

        const file = schemaFileMap.get(schemaName);

        const inserted = await storage.storeObject({
          file_id: file.id,
          repository_id: repo.id,
          organization_id: connector.organization_id,
          connection_id: null,
          connector_id: connector.id,
          name: obj.name,
          schema_name: obj.schema_name,
          database_name: obj.database_name,
          object_type: obj.object_type,
          definition: obj.definition,
        });

        if (obj.columns && obj.columns.length) {
          console.log(`[EXTRACT] Storing ${obj.columns.length} columns for ${obj.name}`);
          await storage.storeColumns(inserted.id, obj.columns, connector.organization_id);
        } else {
          console.log(`[EXTRACT] No columns to store for ${obj.name} (columns: ${obj.columns?.length || 0})`);
        }

        // Build object map for lineage resolution (needed before storing constraints)
        const fullKey = `${(obj.database_name||'').toUpperCase()}.${(obj.schema_name||'').toUpperCase()}.${(obj.name||'').toUpperCase()}`;
        objectIdByKey.set(fullKey, inserted.id);
        if (obj.schema_name) {
          objectIdByKey.set(`${(obj.schema_name||'').toUpperCase()}.${(obj.name||'').toUpperCase()}`, inserted.id);
        }
        objectIdByKey.set(`${(obj.name||'').toUpperCase()}`, inserted.id);

        if (obj.object_type === 'view' && obj.definition) {
          viewObjects.push({ id: inserted.id, name: obj.name, schema: obj.schema_name || null, database: obj.database_name || null, definition: obj.definition });
        }
      }

      // Second pass: Store constraints (after all objects are stored so we have all IDs)
      console.log(`[EXTRACT] Storing constraints for ${result.objects.length} objects`);
      for (const obj of result.objects) {
        if (!obj.constraints || obj.constraints.length === 0) continue;
        
        const fullKey = `${(obj.database_name||'').toUpperCase()}.${(obj.schema_name||'').toUpperCase()}.${(obj.name||'').toUpperCase()}`;
        const objectId = objectIdByKey.get(fullKey);
        if (!objectId) {
          console.warn(`[EXTRACT] Could not find object ID for ${fullKey} to store constraints`);
          continue;
        }

        console.log(`[EXTRACT] Storing ${obj.constraints.length} constraints for ${obj.name}`);
        await storage.storeConstraints(objectId, obj.constraints, connector.organization_id, objectIdByKey);
      }

      // Column-level lineage extraction for views using Python SQLGlot (Snowflake dialect)
      try {
        const python = new PythonSQLGlotParser();
        const healthy = await python.healthCheck();
        console.log(`[EXTRACT] Lineage: service healthy=${healthy}, views=${viewObjects.length}`);
        if (healthy && viewObjects.length > 0) {
          for (const v of viewObjects) {
            if (!v.definition) continue;
            const targetFull = [v.database, v.schema, v.name].filter(Boolean).join('.');
            const selectSql = this.extractSelectFromDDL(v.definition) || v.definition || '';
            const lineage = await python.extractColumnLineage(selectSql, targetFull || v.name, { dialect: 'snowflake' });
            if (!lineage || lineage.length === 0) continue;

            for (const rel of lineage) {
              const targetObjectId = v.id;
              const sourceTable = (rel.targetName || '').toString();
              const sourceVariants = this.buildTableNameVariants(sourceTable, v.schema || undefined, v.database || undefined);
              let sourceObjectId: string | undefined;
              for (const variant of sourceVariants) {
                sourceObjectId = objectIdByKey.get(variant.toUpperCase());
                if (sourceObjectId) break;
              }
              if (!sourceObjectId) {
                // Try plain upper name
                sourceObjectId = objectIdByKey.get(sourceTable.toUpperCase());
              }
              if (!sourceObjectId) continue;

              // Ensure source and target columns exist (upsert)
              await supabase
                .schema('metadata')
                .from('columns')
                .upsert({
                  object_id: sourceObjectId,
                  organization_id: connector.organization_id,
                  name: rel.sourceColumn,
                  data_type: 'unknown',
                  is_nullable: true,
                }, { onConflict: 'object_id,name' });

              await supabase
                .schema('metadata')
                .from('columns')
                .upsert({
                  object_id: targetObjectId,
                  organization_id: connector.organization_id,
                  name: rel.targetColumn,
                  data_type: 'unknown',
                  is_nullable: true,
                }, { onConflict: 'object_id,name' });

              // Store lineage
              await supabase
                .schema('metadata')
                .from('columns_lineage')
                .upsert({
                  organization_id: connector.organization_id,
                  source_object_id: sourceObjectId,
                  source_column: rel.sourceColumn,
                  target_object_id: targetObjectId,
                  target_column: rel.targetColumn,
                  transformation_type: this.classifyTransformation(rel.expression || ''),
                  confidence: this.calculateConfidence(rel.expression || ''),
                  expression: rel.expression,
                  metadata: {
                    parser: 'python-sqlglot-ast',
                    source_model: sourceTable,
                    target_model: targetFull || v.name,
                    accuracy_tier: 'GOLD'
                  }
                }, { onConflict: 'source_object_id,source_column,target_object_id,target_column' });
            }
          }
        }
      } catch (e) {
        console.warn('[ConnectorExtraction] Column lineage extraction skipped due to error:', e);
      }

      const objectsExtracted = result.objects.length;
      const columnsExtracted = result.objects.reduce((sum, o) => sum + (o.columns?.length || 0), 0);

      await supabaseAdmin
        .schema('enterprise')
        .from('connector_sync_history')
        .update({
          completed_at: new Date().toISOString(),
          status: 'completed',
          objects_extracted: objectsExtracted,
          columns_extracted: columnsExtracted,
        })
        .eq('id', historyId);

      await supabaseAdmin
        .schema('enterprise')
        .from('connectors')
        .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'success' })
        .eq('id', connector.id);

      return { objectsExtracted, columnsExtracted };
    } catch (e: any) {
      if (historyId) {
        await supabaseAdmin
          .schema('enterprise')
          .from('connector_sync_history')
          .update({ completed_at: new Date().toISOString(), status: 'failed', error_message: e?.message || String(e) })
          .eq('id', historyId);
      }
      throw e;
    }
  }

  private buildTableNameVariants(table: string, schema?: string, database?: string): string[] {
    const t = (table || '').toUpperCase();
    const s = (schema || '').toUpperCase();
    const d = (database || '').toUpperCase();
    const variants: string[] = [];
    if (d && s) variants.push(`${d}.${s}.${t}`);
    if (s) variants.push(`${s}.${t}`);
    variants.push(t);
    return variants;
  }

  private classifyTransformation(expression: string): string {
    const upper = expression.toUpperCase();
    if (/COUNT|SUM|AVG|MAX|MIN/.test(upper)) return 'aggregation';
    if (/ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD/.test(upper)) return 'window_function';
    if (/CASE\s+WHEN/.test(upper)) return 'case_expression';
    if (/CAST|CONVERT|::/.test(upper)) return 'cast';
    if (/[+\-*\/]/.test(expression) && !/CONCAT/i.test(upper)) return 'calculation';
    if (/CONCAT|SUBSTRING|TRIM|UPPER|LOWER|REPLACE/.test(upper)) return 'string_function';
    return 'direct';
  }

  private calculateConfidence(expression: string): number {
    const type = this.classifyTransformation(expression);
    const map: Record<string, number> = { direct: 0.95, cast: 0.93, aggregation: 0.9, window_function: 0.88, case_expression: 0.8, calculation: 0.82, string_function: 0.83 };
    return map[type] ?? 0.8;
  }

  private withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
      p.then((v) => {
        clearTimeout(t);
        resolve(v);
      }).catch((e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  }

  private extractSelectFromDDL(ddl?: string | null): string | null {
    if (!ddl) return null;
    const s = ddl.trim();
    const upper = s.toUpperCase();
    const asIdx = upper.indexOf(' AS ');
    if (asIdx === -1) return s; // Already SELECT or unknown format
    let body = s.substring(asIdx + 4).trim();
    if (body.endsWith(';')) body = body.slice(0, -1).trim();
    // Remove wrapping parentheses e.g., AS (SELECT ...)
    if (body.startsWith('(') && body.endsWith(')')) {
      body = body.slice(1, -1).trim();
    }
    return body;
  }
}
