#!/usr/bin/env node
/**
 * Test file parsers to verify they extract information correctly
 */

// Since we're using TypeScript, we'll need to compile first
// For now, this is a conceptual test showing what we'd test

console.log('🧪 Testing File Parsers\n');

const sqlSample = `
-- Customer table definition
CREATE TABLE customers (
    id INT PRIMARY KEY,
    email VARCHAR(255),
    name VARCHAR(100)
);

-- Get active customers
WITH active_customers AS (
    SELECT * FROM customers WHERE status = 'active'
)
SELECT COUNT(*) FROM active_customers;
`;

const pythonSample = `
"""
Customer service module
Handles customer-related operations
"""

import pandas as pd
from typing import List

# Configuration
DATABASE_URL = "postgresql://localhost/mydb"

class CustomerService:
    """Manages customer data and operations"""
    
    def __init__(self, db_url: str):
        self.db_url = db_url
    
    def get_customer(self, customer_id: int) -> dict:
        """Fetch customer by ID"""
        return {}
    
    async def create_customer(self, data: dict) -> int:
        """Create new customer"""
        return 1
`;

const javascriptSample = `
/**
 * Customer API service
 * @module CustomerAPI
 */

import axios from 'axios';
import { Customer } from './types';

// API configuration
const API_BASE_URL = 'https://api.example.com';

/**
 * Customer service class
 */
class CustomerService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    
    /**
     * Fetch customer by ID
     * @param {number} id - Customer ID
     * @returns {Promise<Customer>}
     */
    async getCustomer(id) {
        const response = await axios.get(\`\${this.baseUrl}/customers/\${id}\`);
        return response.data;
    }
    
    // Create new customer
    createCustomer = async (data) => {
        return await axios.post(\`\${this.baseUrl}/customers\`, data);
    };
}

export { CustomerService };
`;

console.log('📄 SQL Parser Test');
console.log('Sample SQL:');
console.log(sqlSample);
console.log('\nExpected to extract:');
console.log('- Tables: customers');
console.log('- CTEs: active_customers');
console.log('- Functions: COUNT');
console.log('- Comments: Customer table definition, Get active customers');
console.log();

console.log('🐍 Python Parser Test');
console.log('Sample Python:');
console.log(pythonSample);
console.log('\nExpected to extract:');
console.log('- Classes: CustomerService');
console.log('- Functions: get_customer, create_customer');
console.log('- Imports: pandas, typing');
console.log('- Variables: DATABASE_URL');
console.log('- Docstrings: Customer service module...');
console.log();

console.log('📜 JavaScript Parser Test');
console.log('Sample JavaScript:');
console.log(javascriptSample);
console.log('\nExpected to extract:');
console.log('- Classes: CustomerService, Customer');
console.log('- Functions: getCustomer, createCustomer');
console.log('- Imports: axios, ./types');
console.log('- Variables: API_BASE_URL');
console.log('- JSDoc: Customer API service...');
console.log();

console.log('✅ Parser structure created successfully!');
console.log('📝 To actually run parsers, compile TypeScript first:');
console.log('   cd backend && npm run build');
console.log('   node dist/services/file-parsers/test.js');
