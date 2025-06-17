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
    sql?: string;
  };
}

export interface LineageData {
  nodes: TableNode[];
  edges: ColumnEdge[];
}

// Create lineage data for fct_order_items
export const createFctOrderItemsLineage = (): LineageData => {
  // Based on: https://github.com/dbt-labs/dbt-example-keppel/blob/main/models/marts/core/fct_order_items.sql
  
  // Source tables
  const sourceNodes: TableNode[] = [
    {
      id: 'stg_tpch_line_items',
      type: 'tableNode',
      position: { x: 300, y: 100 },
      data: {
        label: 'stg_tpch_line_items',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized line item data',
        columns: [
          { id: 'order_key', name: 'order_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to order' },
          { id: 'line_number', name: 'line_number', type: 'INTEGER', description: 'Line number within the order' },
          { id: 'part_key', name: 'part_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to part' },
          { id: 'supplier_key', name: 'supplier_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to supplier' },
          { id: 'quantity', name: 'quantity', type: 'DECIMAL', description: 'Quantity ordered' },
          { id: 'extended_price', name: 'extended_price', type: 'DECIMAL', description: 'Line item price before discount' },
          { id: 'discount_percentage', name: 'discount_percentage', type: 'DECIMAL', description: 'Discount rate' },
          { id: 'tax_rate', name: 'tax_rate', type: 'DECIMAL', description: 'Tax rate applied' },
          { id: 'return_flag', name: 'return_flag', type: 'VARCHAR', description: 'Return status flag' },
          { id: 'status', name: 'status', type: 'VARCHAR', description: 'Line item status' },
          { id: 'ship_date', name: 'ship_date', type: 'DATE', description: 'Date shipped' },
          { id: 'commit_date', name: 'commit_date', type: 'DATE', description: 'Committed ship date' },
          { id: 'receipt_date', name: 'receipt_date', type: 'DATE', description: 'Date received' },
          { id: 'ship_mode', name: 'ship_mode', type: 'VARCHAR', description: 'Shipping mode' },
        ],
      },
    },
    {
      id: 'stg_tpch_orders',
      type: 'tableNode',
      position: { x: 100, y: 100 },
      data: {
        label: 'stg_tpch_orders',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized order data',
        columns: [
          { id: 'order_key', name: 'order_key', type: 'INTEGER', isPrimaryKey: true, description: 'Unique order identifier' },
          { id: 'customer_key', name: 'customer_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to customer' },
          { id: 'status', name: 'status', type: 'VARCHAR', description: 'Order status code' },
          { id: 'order_date', name: 'order_date', type: 'DATE', description: 'Date the order was placed' },
          { id: 'priority', name: 'priority', type: 'VARCHAR', description: 'Priority classification' },
        ],
      },
    },
    {
      id: 'stg_tpch_customers',
      type: 'tableNode',
      position: { x: 500, y: 100 },
      data: {
        label: 'stg_tpch_customers',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized customer data',
        columns: [
          { id: 'customer_key', name: 'customer_key', type: 'INTEGER', isPrimaryKey: true, description: 'Unique customer identifier' },
          { id: 'name', name: 'name', type: 'VARCHAR', description: 'Customer name' },
          { id: 'nation_key', name: 'nation_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to nation' },
        ],
      },
    },
    {
      id: 'stg_tpch_parts',
      type: 'tableNode',
      position: { x: 700, y: 100 },
      data: {
        label: 'stg_tpch_parts',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized part data',
        columns: [
          { id: 'part_key', name: 'part_key', type: 'INTEGER', isPrimaryKey: true, description: 'Unique part identifier' },
          { id: 'name', name: 'name', type: 'VARCHAR', description: 'Part name' },
          { id: 'manufacturer', name: 'manufacturer', type: 'VARCHAR', description: 'Part manufacturer' },
          { id: 'type', name: 'type', type: 'VARCHAR', description: 'Part type' },
        ],
      },
    },
    {
      id: 'stg_tpch_suppliers',
      type: 'tableNode',
      position: { x: 900, y: 100 },
      data: {
        label: 'stg_tpch_suppliers',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized supplier data',
        columns: [
          { id: 'supplier_key', name: 'supplier_key', type: 'INTEGER', isPrimaryKey: true, description: 'Unique supplier identifier' },
          { id: 'name', name: 'name', type: 'VARCHAR', description: 'Supplier name' },
          { id: 'nation_key', name: 'nation_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to nation' },
        ],
      },
    },
  ];

  // Target fact table
  const targetNode: TableNode = {
    id: 'fct_order_items',
    type: 'tableNode',
    position: { x: 500, y: 400 },
    data: {
      label: 'fct_order_items',
      schema: 'marts_core',
      type: 'transformation',
      description: 'Order items fact table with calculated metrics',
      columns: [
        { id: 'order_item_key', name: 'order_item_key', type: 'INTEGER', isPrimaryKey: true, description: 'Unique order item identifier' },
        { id: 'order_key', name: 'order_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to order' },
        { id: 'customer_key', name: 'customer_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to customer' },
        { id: 'part_key', name: 'part_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to part' },
        { id: 'supplier_key', name: 'supplier_key', type: 'INTEGER', isForeignKey: true, description: 'Reference to supplier' },
        { id: 'order_date', name: 'order_date', type: 'DATE', description: 'Date order was placed' },
        { id: 'ship_date', name: 'ship_date', type: 'DATE', description: 'Date item was shipped' },
        { id: 'quantity', name: 'quantity', type: 'DECIMAL', description: 'Quantity ordered' },
        { id: 'gross_item_sales_amount', name: 'gross_item_sales_amount', type: 'DECIMAL', description: 'Extended price before discounts' },
        { id: 'discount_amount', name: 'discount_amount', type: 'DECIMAL', description: 'Calculated discount amount' },
        { id: 'discounted_item_sales_amount', name: 'discounted_item_sales_amount', type: 'DECIMAL', description: 'Price after discount' },
        { id: 'tax_amount', name: 'tax_amount', type: 'DECIMAL', description: 'Calculated tax amount' },
        { id: 'net_item_sales_amount', name: 'net_item_sales_amount', type: 'DECIMAL', description: 'Final price including discounts and taxes' },
        { id: 'ship_mode', name: 'ship_mode', type: 'VARCHAR', description: 'Shipping mode' },
        { id: 'status', name: 'status', type: 'VARCHAR', description: 'Line item status' },
      ],
    },
  };

  // Column-level edges - these connect specific columns between tables
  const columnEdges: ColumnEdge[] = [
    // stg_tpch_line_items to fct_order_items direct column mappings
    {
      id: 'line_items_order_key-to-order_key',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'order_key-source',
      targetHandle: 'order_key-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Direct mapping of order key'
      },
    },
    {
      id: 'line_items_part_key-to-part_key',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'part_key-source',
      targetHandle: 'part_key-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Direct mapping of part key'
      },
    },
    {
      id: 'line_items_supplier_key-to-supplier_key',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'supplier_key-source',
      targetHandle: 'supplier_key-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Direct mapping of supplier key'
      },
    },
    {
      id: 'line_items_ship_date-to-ship_date',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'ship_date-source',
      targetHandle: 'ship_date-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Direct mapping of ship date'
      },
    },
    {
      id: 'line_items_quantity-to-quantity',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'quantity-source',
      targetHandle: 'quantity-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Direct mapping of quantity'
      },
    },
    {
      id: 'line_items_extended_price-to-gross_item_sales_amount',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'extended_price-source',
      targetHandle: 'gross_item_sales_amount-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Mapped as gross item sales amount'
      },
    },
    {
      id: 'line_items_ship_mode-to-ship_mode',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'ship_mode-source',
      targetHandle: 'ship_mode-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Direct mapping of ship mode'
      },
    },
    {
      id: 'line_items_status-to-status',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'status-source',
      targetHandle: 'status-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Direct',
        description: 'Direct mapping of status'
      },
    },

    // Calculated fields
    {
      id: 'line_items_extended_price-and-discount-to-discount_amount',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'extended_price-source',
      targetHandle: 'discount_amount-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Calculated',
        description: 'Calculated as extended_price * discount_percentage',
        sql: 'extended_price * discount_percentage'
      },
    },
    {
      id: 'line_items_to-discounted_item_sales_amount',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'extended_price-source',
      targetHandle: 'discounted_item_sales_amount-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Calculated',
        description: 'Calculated as extended_price * (1 - discount_percentage)',
        sql: 'extended_price * (1 - discount_percentage)'
      },
    },
    {
      id: 'line_items_to-tax_amount',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'extended_price-source',
      targetHandle: 'tax_amount-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Calculated',
        description: 'Calculated as extended_price * (1 - discount_percentage) * tax_rate',
        sql: 'extended_price * (1 - discount_percentage) * tax_rate'
      },
    },
    {
      id: 'line_items_to-net_item_sales_amount',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      sourceHandle: 'extended_price-source',
      targetHandle: 'net_item_sales_amount-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#4F46E5', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Calculated',
        description: 'Calculated as extended_price * (1 - discount_percentage) * (1 + tax_rate)',
        sql: 'extended_price * (1 - discount_percentage) * (1 + tax_rate)'
      },
    },

    // Joins from other tables
    {
      id: 'orders_order_key-to-order_key',
      source: 'stg_tpch_orders',
      target: 'fct_order_items',
      sourceHandle: 'order_key-source',
      targetHandle: 'order_key-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Join',
        description: 'Join on order key'
      },
    },
    {
      id: 'orders_customer_key-to-customer_key',
      source: 'stg_tpch_orders',
      target: 'fct_order_items',
      sourceHandle: 'customer_key-source',
      targetHandle: 'customer_key-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Join',
        description: 'Customer key brought in through order join'
      },
    },
    {
      id: 'orders_order_date-to-order_date',
      source: 'stg_tpch_orders',
      target: 'fct_order_items',
      sourceHandle: 'order_date-source',
      targetHandle: 'order_date-target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Join',
        description: 'Order date brought in through order join'
      },
    },
  ];

  // Table-level relationships for a clearer high-level view
  const tableEdges: ColumnEdge[] = [
    {
      id: 'stg_tpch_line_items-to-fct_order_items',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 3 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Primary Source',
        description: 'Primary source data for fact table'
      },
    },
    {
      id: 'stg_tpch_orders-to-fct_order_items',
      source: 'stg_tpch_orders',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Join',
        description: 'Joined to bring in order details and customer reference'
      },
    },
    {
      id: 'stg_tpch_customers-to-fct_order_items',
      source: 'stg_tpch_customers',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#9333EA', strokeWidth: 1, strokeDasharray: '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Reference',
        description: 'Referenced through orders join'
      },
    },
    {
      id: 'stg_tpch_parts-to-fct_order_items',
      source: 'stg_tpch_parts',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#9333EA', strokeWidth: 1, strokeDasharray: '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Reference',
        description: 'Referenced through line items'
      },
    },
    {
      id: 'stg_tpch_suppliers-to-fct_order_items',
      source: 'stg_tpch_suppliers',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#9333EA', strokeWidth: 1, strokeDasharray: '5,5' },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Reference',
        description: 'Referenced through line items'
      },
    },
  ];

  return {
    nodes: [...sourceNodes, targetNode],
    edges: [...tableEdges], // Using table-level edges for better visibility
  };
};
