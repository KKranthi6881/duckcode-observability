import { MarkerType } from '@xyflow/react';
import { Column, TableNode, ColumnEdge, LineageData } from './customerLineage';

// Order Lineage Model based on dbt-example-keppel
export const createOrderLineage = (): LineageData => {
  // Source tables
  const sourceNodes: TableNode[] = [
    {
      id: 'tpch_orders',
      type: 'tableNode',
      position: { x: 100, y: 100 },
      data: {
        label: 'tpch_orders',
        schema: 'tpch',
        type: 'source',
        description: 'Source orders data from TPCH',
        columns: [
          { id: 'o_orderkey', name: 'o_orderkey', type: 'INTEGER', isPrimaryKey: true, description: 'Primary key for orders' },
          { id: 'o_custkey', name: 'o_custkey', type: 'INTEGER', isForeignKey: true, description: 'Foreign key to customers' },
          { id: 'o_orderstatus', name: 'o_orderstatus', type: 'VARCHAR', description: 'Status of the order' },
          { id: 'o_totalprice', name: 'o_totalprice', type: 'DECIMAL', description: 'Total price of the order' },
          { id: 'o_orderdate', name: 'o_orderdate', type: 'DATE', description: 'Date the order was placed' },
          { id: 'o_orderpriority', name: 'o_orderpriority', type: 'VARCHAR', description: 'Priority of the order' },
          { id: 'o_clerk', name: 'o_clerk', type: 'VARCHAR', description: 'Clerk who processed the order' },
          { id: 'o_shippriority', name: 'o_shippriority', type: 'INTEGER', description: 'Priority of shipping' },
          { id: 'o_comment', name: 'o_comment', type: 'VARCHAR', description: 'Order comment' },
        ],
      },
    },
    {
      id: 'tpch_line_items',
      type: 'tableNode',
      position: { x: 500, y: 100 },
      data: {
        label: 'tpch_line_items',
        schema: 'tpch',
        type: 'source',
        description: 'Source line items data from TPCH',
        columns: [
          { id: 'l_orderkey', name: 'l_orderkey', type: 'INTEGER', isForeignKey: true, description: 'Foreign key to orders' },
          { id: 'l_partkey', name: 'l_partkey', type: 'INTEGER', isForeignKey: true, description: 'Foreign key to parts' },
          { id: 'l_suppkey', name: 'l_suppkey', type: 'INTEGER', isForeignKey: true, description: 'Foreign key to suppliers' },
          { id: 'l_linenumber', name: 'l_linenumber', type: 'INTEGER', description: 'Line number within the order' },
          { id: 'l_quantity', name: 'l_quantity', type: 'DECIMAL', description: 'Quantity ordered' },
          { id: 'l_extendedprice', name: 'l_extendedprice', type: 'DECIMAL', description: 'Extended price' },
          { id: 'l_discount', name: 'l_discount', type: 'DECIMAL', description: 'Discount percentage' },
          { id: 'l_tax', name: 'l_tax', type: 'DECIMAL', description: 'Tax percentage' },
          { id: 'l_returnflag', name: 'l_returnflag', type: 'VARCHAR', description: 'Return flag' },
          { id: 'l_linestatus', name: 'l_linestatus', type: 'VARCHAR', description: 'Status of the line item' },
          { id: 'l_shipdate', name: 'l_shipdate', type: 'DATE', description: 'Date shipped' },
          { id: 'l_commitdate', name: 'l_commitdate', type: 'DATE', description: 'Date committed for shipping' },
          { id: 'l_receiptdate', name: 'l_receiptdate', type: 'DATE', description: 'Date received' },
          { id: 'l_shipinstruct', name: 'l_shipinstruct', type: 'VARCHAR', description: 'Shipping instructions' },
          { id: 'l_shipmode', name: 'l_shipmode', type: 'VARCHAR', description: 'Mode of shipping' },
          { id: 'l_comment', name: 'l_comment', type: 'VARCHAR', description: 'Line item comment' },
        ],
      },
    },
    {
      id: 'tpch_customers',
      type: 'tableNode',
      position: { x: 900, y: 100 },
      data: {
        label: 'tpch_customers',
        schema: 'tpch',
        type: 'source',
        description: 'Source customers data from TPCH',
        columns: [
          { id: 'c_custkey', name: 'c_custkey', type: 'INTEGER', isPrimaryKey: true, description: 'Primary key for customers' },
          { id: 'c_name', name: 'c_name', type: 'VARCHAR', description: 'Customer name' },
          { id: 'c_nationkey', name: 'c_nationkey', type: 'INTEGER', isForeignKey: true, description: 'Foreign key to nations' },
        ],
      },
    },
  ];

  // Staging models
  const stagingNodes: TableNode[] = [
    {
      id: 'stg_tpch_orders',
      type: 'tableNode',
      position: { x: 100, y: 400 },
      data: {
        label: 'stg_tpch_orders',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized order data',
        columns: [
          { id: 'order_id', name: 'order_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique order identifier' },
          { id: 'customer_id', name: 'customer_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to customer' },
          { id: 'status', name: 'status', type: 'VARCHAR', description: 'Order status code' },
          { id: 'total_price', name: 'total_price', type: 'DECIMAL', description: 'Total price of the order' },
          { id: 'order_date', name: 'order_date', type: 'DATE', description: 'Date the order was placed' },
          { id: 'order_priority', name: 'order_priority', type: 'VARCHAR', description: 'Priority classification' },
          { id: 'clerk', name: 'clerk', type: 'VARCHAR', description: 'Clerk identifier' },
          { id: 'ship_priority', name: 'ship_priority', type: 'INTEGER', description: 'Shipping priority code' },
        ],
      },
    },
    {
      id: 'stg_tpch_line_items',
      type: 'tableNode',
      position: { x: 500, y: 400 },
      data: {
        label: 'stg_tpch_line_items',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized line item data',
        columns: [
          { id: 'order_id', name: 'order_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to order' },
          { id: 'part_id', name: 'part_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to part' },
          { id: 'supplier_id', name: 'supplier_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to supplier' },
          { id: 'line_number', name: 'line_number', type: 'INTEGER', description: 'Line number within the order' },
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
      id: 'stg_tpch_customers',
      type: 'tableNode',
      position: { x: 900, y: 400 },
      data: {
        label: 'stg_tpch_customers',
        schema: 'staging',
        type: 'transformation',
        description: 'Cleaned and standardized customer data',
        columns: [
          { id: 'customer_id', name: 'customer_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique customer identifier' },
          { id: 'name', name: 'name', type: 'VARCHAR', description: 'Customer name' },
          { id: 'nation_id', name: 'nation_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to nation' },
        ],
      },
    },
  ];

  // Mart models
  const martNodes: TableNode[] = [
    {
      id: 'fct_orders',
      type: 'tableNode',
      position: { x: 100, y: 700 },
      data: {
        label: 'fct_orders',
        schema: 'marts_core',
        type: 'transformation',
        description: 'Order fact table with customer attributes',
        columns: [
          { id: 'order_id', name: 'order_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique order identifier' },
          { id: 'customer_id', name: 'customer_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to customer' },
          { id: 'customer_name', name: 'customer_name', type: 'VARCHAR', description: 'Customer name' },
          { id: 'order_date', name: 'order_date', type: 'DATE', description: 'Date order was placed' },
          { id: 'status', name: 'status', type: 'VARCHAR', description: 'Order status' },
          { id: 'total_price', name: 'total_price', type: 'DECIMAL', description: 'Total price of the order' },
          { id: 'item_count', name: 'item_count', type: 'INTEGER', description: 'Number of items in the order' },
        ],
      },
    },
    {
      id: 'fct_order_items',
      type: 'tableNode',
      position: { x: 500, y: 700 },
      data: {
        label: 'fct_order_items',
        schema: 'marts_core',
        type: 'transformation',
        description: 'Order items fact table with calculated metrics',
        columns: [
          { id: 'order_item_id', name: 'order_item_id', type: 'INTEGER', isPrimaryKey: true, description: 'Unique order item identifier' },
          { id: 'order_id', name: 'order_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to order' },
          { id: 'part_id', name: 'part_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to part' },
          { id: 'supplier_id', name: 'supplier_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to supplier' },
          { id: 'customer_id', name: 'customer_id', type: 'INTEGER', isForeignKey: true, description: 'Reference to customer' },
          { id: 'ship_date', name: 'ship_date', type: 'DATE', description: 'Date item was shipped' },
          { id: 'quantity', name: 'quantity', type: 'DECIMAL', description: 'Quantity ordered' },
          { id: 'gross_item_sales_amount', name: 'gross_item_sales_amount', type: 'DECIMAL', description: 'Price before discounts' },
          { id: 'discount_amount', name: 'discount_amount', type: 'DECIMAL', description: 'Discount amount' },
          { id: 'net_item_sales_amount', name: 'net_item_sales_amount', type: 'DECIMAL', description: 'Price after discounts' },
          { id: 'tax_amount', name: 'tax_amount', type: 'DECIMAL', description: 'Tax amount' },
          { id: 'ship_mode', name: 'ship_mode', type: 'VARCHAR', description: 'Shipping mode' },
        ],
      },
    },
  ];

  // Create edges between tables rather than columns for better visibility
  const tableEdges: ColumnEdge[] = [
    // Source to staging
    {
      id: 'tpch_orders-to-stg_tpch_orders',
      source: 'tpch_orders',
      target: 'stg_tpch_orders',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Source order data transformed to staging'
      },
    },
    {
      id: 'tpch_line_items-to-stg_tpch_line_items',
      source: 'tpch_line_items',
      target: 'stg_tpch_line_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Source line item data transformed to staging'
      },
    },
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

    // Staging to fact tables
    {
      id: 'stg_tpch_orders-to-fct_orders',
      source: 'stg_tpch_orders',
      target: 'fct_orders',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Staging order data used in order fact table'
      },
    },
    {
      id: 'stg_tpch_line_items-to-fct_order_items',
      source: 'stg_tpch_line_items',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#2AB7A9', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Transforms',
        description: 'Staging line item data used in order items fact table'
      },
    },

    // Joins between staging and facts
    {
      id: 'stg_tpch_customers-to-fct_orders',
      source: 'stg_tpch_customers',
      target: 'fct_orders',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Joins',
        description: 'Customer data joined to order fact table'
      },
    },
    {
      id: 'stg_tpch_line_items-to-fct_orders',
      source: 'stg_tpch_line_items',
      target: 'fct_orders',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Joins',
        description: 'Line item data aggregated in order fact table'
      },
    },

    // Fact to fact relationship
    {
      id: 'fct_orders-to-fct_order_items',
      source: 'fct_orders',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#9333EA', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'References',
        description: 'Order reference in order items'
      },
    },
    {
      id: 'stg_tpch_customers-to-fct_order_items',
      source: 'stg_tpch_customers',
      target: 'fct_order_items',
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#F59E0B', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { 
        relationship: 'Joins',
        description: 'Customer data joined to order items fact table'
      },
    },
  ];

  return {
    nodes: [...sourceNodes, ...stagingNodes, ...martNodes],
    edges: tableEdges, // Using table-level edges instead of column-level for better visibility
  };
};
