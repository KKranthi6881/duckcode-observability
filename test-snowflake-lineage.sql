-- Create a test schema with constraints and views to verify lineage extraction
-- Run this in your Snowflake account to test lineage functionality

USE DATABASE SNOWFLAKE_SAMPLE_DATA;
CREATE SCHEMA IF NOT EXISTS LINEAGE_TEST;
USE SCHEMA LINEAGE_TEST;

-- Create base tables with Primary Keys
CREATE OR REPLACE TABLE customers (
    customer_id INT PRIMARY KEY,
    customer_name VARCHAR(100),
    email VARCHAR(100)
);

CREATE OR REPLACE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT,
    order_date DATE,
    total_amount DECIMAL(10,2),
    -- Foreign Key creates table lineage!
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE OR REPLACE TABLE order_items (
    item_id INT PRIMARY KEY,
    order_id INT,
    product_name VARCHAR(100),
    quantity INT,
    price DECIMAL(10,2),
    -- Foreign Key creates table lineage!
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Insert sample data
INSERT INTO customers VALUES 
    (1, 'John Doe', 'john@example.com'),
    (2, 'Jane Smith', 'jane@example.com');

INSERT INTO orders VALUES 
    (101, 1, '2024-01-15', 150.00),
    (102, 2, '2024-01-16', 200.00);

INSERT INTO order_items VALUES 
    (1001, 101, 'Widget A', 2, 50.00),
    (1002, 101, 'Widget B', 1, 50.00),
    (1003, 102, 'Widget C', 4, 50.00);

-- Create a VIEW for column-level lineage
CREATE OR REPLACE VIEW customer_orders AS
SELECT 
    c.customer_id,
    c.customer_name,
    c.email,
    o.order_id,
    o.order_date,
    o.total_amount
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id;

-- Create another VIEW with aggregation
CREATE OR REPLACE VIEW customer_summary AS
SELECT 
    c.customer_id,
    c.customer_name,
    COUNT(o.order_id) as total_orders,
    SUM(o.total_amount) as total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.customer_name;

-- Verify the setup
SELECT 'Tables created with constraints' as status;
SHOW PRIMARY KEYS IN TABLE customers;
SHOW IMPORTED KEYS IN TABLE orders;
SHOW IMPORTED KEYS IN TABLE order_items;
SELECT 'Views created for column lineage' as status;
SHOW VIEWS IN SCHEMA LINEAGE_TEST;
