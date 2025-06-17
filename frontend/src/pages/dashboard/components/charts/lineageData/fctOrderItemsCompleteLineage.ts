// Complete lineage data for fct_order_items based on the provided JSON structure
import { Node, Edge, MarkerType } from '@xyflow/react';

// Types for our lineage data
export interface ColumnData {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  description?: string;
  highlighted?: boolean;
}

export interface TableNode extends Node {
  data: {
    label: string;
    schema: string;
    type: string;
    description?: string;
    columns: ColumnData[];
    highlighted?: boolean;
    level?: number;
  };
}

export interface RelationshipEdge extends Edge {
  data?: {
    relationship: string;
    description?: string;
    sql?: string;
    transformationType?: string;
  };
}

export interface LineageData {
  nodes: TableNode[];
  edges: RelationshipEdge[];
}

export function createFctOrderItemsCompleteLineage(): LineageData {
  // Define the nodes for each level with better spacing

  // Level 0: Source Tables
  const sourceNodes: TableNode[] = [
    {
      id: 'tpch_lineitem',
      type: 'tableNode',
      position: { x: 50, y: 50 },
      data: {
        label: 'tpch.lineitem',
        schema: 'tpch',
        type: 'source',
        level: 0,
        description: 'Source lineitem data',
        columns: [
          { name: 'l_orderkey', type: 'INTEGER', isPrimaryKey: true, description: 'Order key' },
          { name: 'l_partkey', type: 'INTEGER', isForeignKey: true, description: 'Part key' },
          { name: 'l_suppkey', type: 'INTEGER', isForeignKey: true, description: 'Supplier key' },
          { name: 'l_linenumber', type: 'INTEGER', isPrimaryKey: true, description: 'Line number' },
          { name: 'l_quantity', type: 'DECIMAL', description: 'Quantity' },
          { name: 'l_extendedprice', type: 'DECIMAL', description: 'Extended price' },
          { name: 'l_discount', type: 'DECIMAL', description: 'Discount percentage' },
          { name: 'l_tax', type: 'DECIMAL', description: 'Tax rate' },
          { name: 'l_returnflag', type: 'STRING', description: 'Return flag' },
          { name: 'l_linestatus', type: 'STRING', description: 'Line status' },
          { name: 'l_shipdate', type: 'DATE', description: 'Ship date' },
          { name: 'l_commitdate', type: 'DATE', description: 'Commit date' },
          { name: 'l_receiptdate', type: 'DATE', description: 'Receipt date' },
          { name: 'l_shipmode', type: 'STRING', description: 'Ship mode' },
        ],
      },
    },
    {
      id: 'tpch_orders',
      type: 'tableNode',
      position: { x: 50, y: 500 },
      data: {
        label: 'tpch.orders',
        schema: 'tpch',
        type: 'source',
        level: 0,
        description: 'Source orders data',
        columns: [
          { name: 'o_orderkey', type: 'INTEGER', isPrimaryKey: true, description: 'Order key' },
          { name: 'o_custkey', type: 'INTEGER', isForeignKey: true, description: 'Customer key' },
          { name: 'o_orderdate', type: 'DATE', description: 'Order date' },
          { name: 'o_orderstatus', type: 'STRING', description: 'Order status' },
        ],
      },
    },
    {
      id: 'tpch_partsupp',
      type: 'tableNode',
      position: { x: 50, y: 750 },
      data: {
        label: 'tpch.partsupp',
        schema: 'tpch',
        type: 'source',
        level: 0,
        description: 'Source part supplier data',
        columns: [
          { name: 'ps_partkey', type: 'INTEGER', isPrimaryKey: true, description: 'Part key' },
          { name: 'ps_suppkey', type: 'INTEGER', isPrimaryKey: true, description: 'Supplier key' },
          { name: 'ps_supplycost', type: 'DECIMAL', description: 'Supply cost' },
        ],
      },
    },
    {
      id: 'tpch_supplier',
      type: 'tableNode',
      position: { x: 50, y: 950 },
      data: {
        label: 'tpch.supplier',
        schema: 'tpch',
        type: 'source',
        level: 0,
        description: 'Source supplier data',
        columns: [
          { name: 's_suppkey', type: 'INTEGER', isPrimaryKey: true, description: 'Supplier key' },
          { name: 's_nationkey', type: 'INTEGER', isForeignKey: true, description: 'Nation key' },
        ],
      },
    },
  ];

  // Level 1: Staging Models
  const stagingNodes: TableNode[] = [
    {
      id: 'stg_tpch_line_items',
      type: 'tableNode',
      position: { x: 500, y: 50 },
      data: {
        label: 'stg_tpch_line_items',
        schema: 'staging',
        type: 'transformation',
        level: 1,
        description: 'Cleaned and standardized line item data',
        columns: [
          { name: 'order_item_key', type: 'STRING', isPrimaryKey: true, description: 'Surrogate key created from order key and line number' },
          { name: 'order_key', type: 'INTEGER', isForeignKey: true, description: 'Order key' },
          { name: 'part_key', type: 'INTEGER', isForeignKey: true, description: 'Part key' },
          { name: 'supplier_key', type: 'INTEGER', isForeignKey: true, description: 'Supplier key' },
          { name: 'line_number', type: 'INTEGER', description: 'Line number' },
          { name: 'quantity', type: 'DECIMAL', description: 'Quantity' },
          { name: 'extended_price', type: 'DECIMAL', description: 'Extended price' },
          { name: 'discount_percentage', type: 'DECIMAL', description: 'Discount percentage' },
          { name: 'tax_rate', type: 'DECIMAL', description: 'Tax rate' },
          { name: 'return_flag', type: 'STRING', description: 'Return flag' },
          { name: 'status_code', type: 'STRING', description: 'Status code' },
          { name: 'ship_date', type: 'DATE', description: 'Ship date' },
          { name: 'commit_date', type: 'DATE', description: 'Commit date' },
          { name: 'receipt_date', type: 'DATE', description: 'Receipt date' },
          { name: 'ship_mode', type: 'STRING', description: 'Ship mode' },
        ],
      },
    },
    {
      id: 'stg_tpch_orders',
      type: 'tableNode',
      position: { x: 500, y: 500 },
      data: {
        label: 'stg_tpch_orders',
        schema: 'staging',
        type: 'transformation',
        level: 1,
        description: 'Cleaned and standardized orders data',
        columns: [
          { name: 'order_key', type: 'INTEGER', isPrimaryKey: true, description: 'Order key' },
          { name: 'customer_key', type: 'INTEGER', isForeignKey: true, description: 'Customer key' },
          { name: 'order_date', type: 'DATE', description: 'Order date' },
        ],
      },
    },
    {
      id: 'stg_tpch_part_suppliers',
      type: 'tableNode',
      position: { x: 500, y: 750 },
      data: {
        label: 'stg_tpch_part_suppliers',
        schema: 'staging',
        type: 'transformation',
        level: 1,
        description: 'Cleaned and standardized part supplier data',
        columns: [
          { name: 'part_key', type: 'INTEGER', isPrimaryKey: true, description: 'Part key' },
          { name: 'supplier_key', type: 'INTEGER', isPrimaryKey: true, description: 'Supplier key' },
          { name: 'cost', type: 'DECIMAL', description: 'Supply cost' },
        ],
      },
    },
    {
      id: 'stg_tpch_suppliers',
      type: 'tableNode',
      position: { x: 500, y: 950 },
      data: {
        label: 'stg_tpch_suppliers',
        schema: 'staging',
        type: 'transformation',
        level: 1,
        description: 'Cleaned and standardized supplier data',
        columns: [
          { name: 'supplier_key', type: 'INTEGER', isPrimaryKey: true, description: 'Supplier key' },
          { name: 'nation_key', type: 'INTEGER', isForeignKey: true, description: 'Nation key' },
        ],
      },
    },
  ];

  // Level 2: Intermediate Models
  const intermediateNodes: TableNode[] = [
    {
      id: 'order_items',
      type: 'tableNode',
      position: { x: 950, y: 275 },
      data: {
        label: 'order_items',
        schema: 'intermediate',
        type: 'transformation',
        level: 2,
        description: 'Joined order and line item data',
        columns: [
          { name: 'order_item_key', type: 'STRING', isPrimaryKey: true, description: 'Order item key' },
          { name: 'order_key', type: 'INTEGER', isForeignKey: true, description: 'Order key' },
          { name: 'order_date', type: 'DATE', description: 'Order date' },
          { name: 'customer_key', type: 'INTEGER', isForeignKey: true, description: 'Customer key' },
          { name: 'part_key', type: 'INTEGER', isForeignKey: true, description: 'Part key' },
          { name: 'supplier_key', type: 'INTEGER', isForeignKey: true, description: 'Supplier key' },
          { name: 'order_item_status_code', type: 'STRING', description: 'Order item status code' },
          { name: 'return_flag', type: 'STRING', description: 'Return flag' },
          { name: 'line_number', type: 'INTEGER', description: 'Line number' },
          { name: 'ship_date', type: 'DATE', description: 'Ship date' },
          { name: 'commit_date', type: 'DATE', description: 'Commit date' },
          { name: 'receipt_date', type: 'DATE', description: 'Receipt date' },
          { name: 'ship_mode', type: 'STRING', description: 'Ship mode' },
          { name: 'base_price', type: 'DECIMAL', description: 'Base price' },
          { name: 'discount_percentage', type: 'DECIMAL', description: 'Discount percentage' },
          { name: 'discounted_price', type: 'DECIMAL', description: 'Discounted price' },
          { name: 'tax_rate', type: 'DECIMAL', description: 'Tax rate' },
          { name: 'quantity', type: 'DECIMAL', description: 'Quantity' },
          { name: 'gross_item_sales_amount', type: 'DECIMAL', description: 'Gross item sales amount' },
          { name: 'discounted_item_sales_amount', type: 'DECIMAL', description: 'Discounted item sales amount' },
          { name: 'item_discount_amount', type: 'DECIMAL', description: 'Item discount amount' },
          { name: 'item_tax_amount', type: 'DECIMAL', description: 'Item tax amount' },
          { name: 'net_item_sales_amount', type: 'DECIMAL', description: 'Net item sales amount' },
        ],
      },
    },
    {
      id: 'part_suppliers',
      type: 'tableNode',
      position: { x: 950, y: 850 },
      data: {
        label: 'part_suppliers',
        schema: 'intermediate',
        type: 'transformation',
        level: 2,
        description: 'Joined part and supplier data',
        columns: [
          { name: 'part_key', type: 'INTEGER', isPrimaryKey: true, description: 'Part key' },
          { name: 'supplier_key', type: 'INTEGER', isPrimaryKey: true, description: 'Supplier key' },
          { name: 'cost', type: 'DECIMAL', description: 'Supply cost' },
          { name: 'nation_key', type: 'INTEGER', isForeignKey: true, description: 'Nation key' },
        ],
      },
    },
  ];

  // Level 3: Fact Table
  const factNodes: TableNode[] = [
    {
      id: 'fct_order_items',
      type: 'tableNode',
      position: { x: 1400, y: 550 },
      data: {
        label: 'fct_order_items',
        schema: 'mart',
        type: 'mart_fact',
        level: 3,
        highlighted: true,
        description: 'Order items fact table with calculated metrics',
        columns: [
          { name: 'order_item_key', type: 'STRING', isPrimaryKey: true, description: 'Order item key' },
          { name: 'order_key', type: 'INTEGER', isForeignKey: true, description: 'Order key' },
          { name: 'order_date', type: 'DATE', description: 'Order date' },
          { name: 'customer_key', type: 'INTEGER', isForeignKey: true, description: 'Customer key' },
          { name: 'part_key', type: 'INTEGER', isForeignKey: true, description: 'Part key' },
          { name: 'supplier_key', type: 'INTEGER', isForeignKey: true, description: 'Supplier key' },
          { name: 'order_item_status_code', type: 'STRING', description: 'Order item status code' },
          { name: 'return_flag', type: 'STRING', description: 'Return flag' },
          { name: 'line_number', type: 'INTEGER', description: 'Line number' },
          { name: 'ship_date', type: 'DATE', description: 'Ship date' },
          { name: 'commit_date', type: 'DATE', description: 'Commit date' },
          { name: 'receipt_date', type: 'DATE', description: 'Receipt date' },
          { name: 'ship_mode', type: 'STRING', description: 'Ship mode' },
          { name: 'supplier_cost', type: 'DECIMAL', description: 'Supplier cost' },
          { name: 'base_price', type: 'DECIMAL', description: 'Base price' },
          { name: 'discount_percentage', type: 'DECIMAL', description: 'Discount percentage' },
          { name: 'discounted_price', type: 'DECIMAL', description: 'Discounted price' },
          { name: 'tax_rate', type: 'DECIMAL', description: 'Tax rate' },
          { name: 'nation_key', type: 'INTEGER', isForeignKey: true, description: 'Nation key' },
          { name: 'order_item_count', type: 'INTEGER', description: 'Order item count (literal value of 1)' },
          { name: 'quantity', type: 'DECIMAL', description: 'Quantity' },
          { name: 'gross_item_sales_amount', type: 'DECIMAL', description: 'Gross item sales amount' },
          { name: 'discounted_item_sales_amount', type: 'DECIMAL', description: 'Discounted item sales amount' },
          { name: 'item_discount_amount', type: 'DECIMAL', description: 'Item discount amount' },
          { name: 'item_tax_amount', type: 'DECIMAL', description: 'Item tax amount' },
          { name: 'net_item_sales_amount', type: 'DECIMAL', description: 'Net item sales amount' },
        ],
      },
    },
  ];

  // Combine all nodes
  const nodes = [...sourceNodes, ...stagingNodes, ...intermediateNodes, ...factNodes];

  // Define edges - source to staging
  const sourceStagingEdges: RelationshipEdge[] = [
    {
      id: 'lineitem-to-stg_line_items',
      source: 'tpch_lineitem',
      target: 'stg_tpch_line_items',
      type: 'relationship',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#2AB7A9',
      },
      data: {
        relationship: 'Source to Staging',
        description: 'Transforms raw line item data with column renames and standardization',
        transformationType: 'column_rename'
      },
    },
    {
      id: 'orders-to-stg_orders',
      source: 'tpch_orders',
      target: 'stg_tpch_orders',
      type: 'relationship',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#2AB7A9',
      },
      data: {
        relationship: 'Source to Staging',
        description: 'Transforms raw orders data with column renames and standardization',
        transformationType: 'column_rename'
      },
    },
    {
      id: 'partsupp-to-stg_part_suppliers',
      source: 'tpch_partsupp',
      target: 'stg_tpch_part_suppliers',
      type: 'relationship',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#2AB7A9',
      },
      data: {
        relationship: 'Source to Staging',
        description: 'Transforms raw part supplier data with column renames and standardization',
        transformationType: 'column_rename'
      },
    },
    {
      id: 'supplier-to-stg_suppliers',
      source: 'tpch_supplier',
      target: 'stg_tpch_suppliers',
      type: 'relationship',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#2AB7A9',
      },
      data: {
        relationship: 'Source to Staging',
        description: 'Transforms raw supplier data with column renames and standardization',
        transformationType: 'column_rename'
      },
    },
  ];

  // Define edges - staging to intermediate
  const stagingIntermediateEdges: RelationshipEdge[] = [
    {
      id: 'stg_line_items-to-order_items',
      source: 'stg_tpch_line_items',
      target: 'order_items',
      type: 'relationship',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4F46E5',
      },
      data: {
        relationship: 'Join Transformation',
        description: 'Joins line items with orders and adds calculated fields',
        transformationType: 'inner_join'
      },
    },
    {
      id: 'stg_orders-to-order_items',
      source: 'stg_tpch_orders',
      target: 'order_items',
      type: 'relationship',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4F46E5',
      },
      data: {
        relationship: 'Join Transformation',
        description: 'Joins orders with line items',
        transformationType: 'inner_join'
      },
    },
    {
      id: 'stg_part_suppliers-to-part_suppliers',
      source: 'stg_tpch_part_suppliers',
      target: 'part_suppliers',
      type: 'relationship',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4F46E5',
      },
      data: {
        relationship: 'Join Transformation',
        description: 'Combines part supplier data with supplier information',
        transformationType: 'inner_join'
      },
    },
    {
      id: 'stg_suppliers-to-part_suppliers',
      source: 'stg_tpch_suppliers',
      target: 'part_suppliers',
      type: 'relationship',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#4F46E5',
      },
      data: {
        relationship: 'Join Transformation',
        description: 'Adds supplier nation key to part supplier data',
        transformationType: 'inner_join'
      },
    },
  ];

  // Define edges - intermediate to fact
  const intermediateFactEdges: RelationshipEdge[] = [
    {
      id: 'order_items-to-fct_order_items',
      source: 'order_items',
      target: 'fct_order_items',
      type: 'relationship',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 3 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#F59E0B',
      },
      data: {
        relationship: 'Final Transformation',
        description: 'Creates fact table combining order items with part supplier information',
        transformationType: 'inner_join'
      },
    },
    {
      id: 'part_suppliers-to-fct_order_items',
      source: 'part_suppliers',
      target: 'fct_order_items',
      type: 'relationship',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 3 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#F59E0B',
      },
      data: {
        relationship: 'Final Transformation',
        description: 'Adds supplier cost and nation information to fact table',
        transformationType: 'inner_join'
      },
    },
  ];

  // Combine all edges
  const edges = [...sourceStagingEdges, ...stagingIntermediateEdges, ...intermediateFactEdges];

  return {
    nodes,
    edges,
  };
}
