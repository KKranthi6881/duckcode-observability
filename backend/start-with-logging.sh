#!/bin/bash

# Create logs directory
mkdir -p logs

# Generate log filename with timestamp
LOG_FILE="logs/extraction-$(date +%Y%m%d-%H%M%S).log"

echo "Starting backend with logging to: $LOG_FILE"

# Run backend and log to file
npm run dev 2>&1 | tee "$LOG_FILE"
