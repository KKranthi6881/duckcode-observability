export type ConnectorType = 'snowflake' | 'dbt_cloud' | 'github' | 'gitlab' | 'bigquery' | 'postgresql' | 'mysql' | 'redshift' | 'tableau' | 'looker' | 'databricks';

export interface ConnectorConfig {
  [key: string]: any;
}

export interface ConnectionTestResult {
  success: boolean;
  message?: string;
  details?: any;
}

export interface ExtractedObjectColumn {
  name: string;
  data_type?: string;
  is_nullable?: boolean;
  position?: number;
}

export interface ExtractedObject {
  name: string;
  schema_name?: string;
  database_name?: string;
  object_type: 'table' | 'view' | 'function' | 'procedure';
  definition?: string;
  columns?: ExtractedObjectColumn[];
}

export interface ExtractionResult {
  repository: {
    path: string;
    name: string;
    type: string; // e.g., 'warehouse' | 'database'
  };
  objects: ExtractedObject[];
  stats?: {
    objects: number;
    columns: number;
  }
}

export interface IConnector {
  name: string;
  type: ConnectorType;
  version: string;

  configure(config: ConnectorConfig): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  extractMetadata(): Promise<ExtractionResult>;
  disconnect(): Promise<void>;
}
