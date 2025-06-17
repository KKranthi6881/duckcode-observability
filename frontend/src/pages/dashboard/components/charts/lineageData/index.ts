export * from './customerLineage';
export * from './orderLineage';

// Export available lineage models for selection in the UI
export const lineageModels = [
  {
    id: 'customer',
    name: 'Customer Lineage',
    description: 'End-to-end customer data flow from source to dimension table',
  },
  {
    id: 'order',
    name: 'Order Lineage',
    description: 'Order processing flow including fact tables and calculated metrics',
  }
];
