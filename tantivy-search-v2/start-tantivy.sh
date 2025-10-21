#!/bin/bash

# Tantivy Search V2 - Startup Script
# This script starts the Tantivy search microservice

set -e

echo "🚀 Starting Tantivy Search V2 Service..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please copy .env.example to .env and configure it:"
    echo "   cp .env.example .env"
    exit 1
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Error: Rust/Cargo not found!"
    echo "   Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check if already built
if [ ! -d "target/release" ]; then
    echo "📦 Building Tantivy service (first time only)..."
    cargo build --release
    echo ""
fi

# Start the service
echo "🌐 Starting service on http://localhost:3002..."
echo "   Press Ctrl+C to stop"
echo ""

cargo run --release
