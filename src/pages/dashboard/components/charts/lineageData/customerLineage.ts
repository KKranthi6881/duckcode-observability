import { MarkerType } from '@xyflow/react';

// Types for our lineage data
export interface Column {
  id: string;
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  description?: string;
}

export interface TableNode {
  id: string;
  type: 'tableNode';
  position: { x: number; y: number };
  data: {
    label: string;
    schema: string;
    type: 'source' | 'transformation' | 'view';
    description?: string;
    columns: Column[];
  };
}

export interface ColumnEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: string;
  animated: boolean;
  style: {
    stroke: string;
    strokeWidth?: number;
  };
  markerEnd: {
    type: MarkerType;
    color?: string;
  };
  data: {
    relationship: string;
    description?: string;
  };
}

export interface LineageData {
  nodes: TableNode[];
  edges: ColumnEdge[];
}

// Customer Lineage Model based on dbt-example-keppel
export const createCustomerLineage = (): LineageData => {
  // Source tables
  const sourceNodes: TableNode[] = [
    {
      id: 'tpch_customers',
      type: 'tableNode',
      position: { x: 100, y: 100 },
      data: {
        label: 'tpch_customers',
        schema: 'tpch',
        type: 'source',
        description: 'Source customers data from TPCH',
        columns: [
          { id: 'c_custkey', name: 'c_custkey', type: 'INTEGER', isPrimaryKey: true, description: 'Primary key for customers' },
          { id: 'c_name', name: 'c_name', type: 'VARCHAR', description: 'Customer name' },
          { id: 'c_address', name: 'c_address', type: 'VARCHAR', description: 'Customer address' },
          { id: 'c_nationkey', name: 'c_nationkey', type: 'INTEGER', isForeignKey: true, description: 'Foreign key to nations' },
          { id: 'c_phone', name: 'c_phone', type: 'VARCHAR', description: 'Customer phone number' },
          { id: 'c_acctbal', name: 'c_acctbal', type: 'DECIMAL', description: 'Customer account balance' },
          { id: 'c_mktsegment', name: 'c_mktsegment', type: 'VARCHAR', description: 'Market segment' },
          { id: 'c_comment', name: 'c_comment', type: 'VARCHAR', description: 'Customer comment' },
        ],
      },
    },
    {
      id: 'tpch_nations',
      type: 'tableNode',
      position: { x: 500, y: 100 },
      data: {
        label: 'tpch_nations',
        schema: 'tpch',
        type: 'source',
        description: 'Source nations data from TPCH',
        columns: [
          { id: 'n_nationkey', name: 'n_nationkey', type: 'INTEGER', isPrimaryKey: true, description: 'Primary key for nations' },
          { id: 'n_name', name: 'n_name', type: 'VARCHAR', description: 'Nation name' },
          { id: 'n_regionkey', name: 'n_regionkey', type: 'INTEGER', isForeignKey: true, description: 'Foreign key to regions' },
          { id: 'n_comment', name: 'n_comment', type: 'VARCHAR', description: 'Nation comment' },
        ],
      },
    },
    {
      id: 'tpch_regions',
      type: 'tableNode',
      position: { x: 900, y: 100 },
      data: {
        label: 'tpch_regions',
        schema: 'tpch',
        type: 'source',
        description: 'Source regions data from TPCH',
        columns: [
          { id: 'r_regionkey', name: 'r_regionkey', type: 'INTEGER', isPrimaryKey: true, description: 'Primary key for regions' },
          { id: 'r_name', name: 'r_name', type: 'VARCHAR', description: 'Region name' },
          { id: 'r_comment', name: 'r_comment', type: 'VARCHAR', description: 'Region comment' },
        ],
      },
    },
  ];

  // Staging models
  const stagingNodes: TableNode[] = [
    {
      id: 'stg_tpch_customers',
      type: 'tableNode',
      position: { x: 100, y: 400 },
      data: {
        label: 'stg_tpch_customers',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized customer data',
        columns: [
          { id: 'customer_id', name: 'customer_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique customer identifier' },
          { id: 'name', name: 'name', type: 'VARCHAR', description: 'Customer name' },
          { id: 'address', name: 'address', type: 'VARCHAR', description: 'Customer address' },
          { id: 'nation_id', name: 'nation_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to nation' },
          { id: 'phone_number', name: 'phone_number', type: 'VARCHAR', description: 'Customer phone number' },
          { id: 'account_balance', name: 'account_balance', type: 'DECIMAL', description: 'Current account balance' },
          { id: 'market_segment', name: 'market_segment', type: 'VARCHAR', description: 'Market segment category' },
          { id: 'comment', name: 'comment', type: 'VARCHAR', description: 'Additional information' },
        ],
      },
    },
    {
      id: 'stg_tpch_nations',
      type: 'tableNode',
      position: { x: 500, y: 400 },
      data: {
        label: 'stg_tpch_nations',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized nation data',
        columns: [
          { id: 'nation_id', name: 'nation_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique nation identifier' },
          { id: 'nation', name: 'nation', type: 'VARCHAR', description: 'Nation name' },
          { id: 'region_id', name: 'region_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to region' },
          { id: 'comment', name: 'comment', type: 'VARCHAR', description: 'Additional information' },
        ],
      },
    },
    {
      id: 'stg_tpch_regions',
      type: 'tableNode',
      position: { x: 900, y: 400 },
      data: {
        label: 'stg_tpch_regions',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized region data',
        columns: [
          { id: 'region_id', name: 'region_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique region identifier' },
          { id: 'region', name: 'region', type: 'VARCHAR', description: 'Region name' },
          { id: 'comment', name: 'comment', type: 'VARCHAR', description: 'Additional information' },
        ],
      },
    },
  ];

  // Mart models
  const martNodes: TableNode[] = [
    {
      id: 'dim_customers',
      type: 'tableNode',
      position: { x: 500, y: 700 },
      data: {
        label: 'dim_customers',
        schema: 'marts_core',
        type: 'transformation',
        description: 'Customer dimension with geographic attributes',
        columns: [
          { id: 'customer_id', name: 'customer_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique customer identifier' },
          { id: 'customer_name', name: 'customer_name', type: 'VARCHAR', description: 'Customer name' },
          { id: 'address', name: 'address', type: 'VARCHAR', description: 'Customer address' },
          { id: 'nation_id', name: 'nation_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to nation' },
          { id: 'nation', name: 'nation', type: 'VARCHAR', description: 'Nation name' },
          { id: 'region_id', name: 'region_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to region' },
          { id: 'region', name: 'region', type: 'VARCHAR', description: 'Region name' },
          { id: 'phone_number', name: 'phone_number', type: 'VARCHAR', description: 'Customer phone number' },
          { id: 'account_balance', name: 'account_balance', type: 'DECIMAL', description: 'Current account balance' },
          { id: 'market_segment', name: 'market_segment', type: 'VARCHAR', description: 'Market segment category' },
        ],
      },
    },
  ];

  // Create edges between tables rather than columns for better visibility
  const tableEdges: ColumnEdge[] = [
    // Source to staging
    {
      id: 'tpch_customers-to-stg_tpch_customers',
      source: 'tpch_customers',
      target: 'stg_tpch_customers',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Source customer data transformed to staging'
      },
    },
    {
      id: 'tpch_nations-to-stg_tpch_nations',
      source: 'tpch_nations',
      target: 'stg_tpch_nations',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Source nation data transformed to staging'
      },
    },
    {
      id: 'tpch_regions-to-stg_tpch_regions',
      source: 'tpch_regions',
      target: 'stg_tpch_regions',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Source region data transformed to staging'
      },
    },

    // Staging to mart
    {
      id: 'stg_tpch_customers-to-dim_customers',
      source: 'stg_tpch_customers',
      target: 'dim_customers',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Staging customer data used in customer dimension'
      },
    },
    {
      id: 'stg_tpch_nations-to-dim_customers',
      source: 'stg_tpch_nations',
      target: 'dim_customers',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Joins',
        description: 'Nation data joined to customer dimension'
      },
    },
    {
      id: 'stg_tpch_regions-to-dim_customers',
      source: 'stg_tpch_regions',
      target: 'dim_customers',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Joins',
        description: 'Region data joined to customer dimension'
      },
    },
  ];

  return {
    nodes: [...sourceNodes, ...stagingNodes, ...martNodes],
    edges: tableEdges, // Using table-level edges instead of column-level for better visibility
  };
};
