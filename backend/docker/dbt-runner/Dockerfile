# dbt-runner Docker Image
# This image is used by DbtRunner.ts to run dbt parse on user repositories

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        build-essential \
        libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install dbt with multiple adapters
RUN pip install --no-cache-dir \
    dbt-core==1.8.7 \
    dbt-snowflake==1.8.4 \
    dbt-postgres==1.8.7 \
    dbt-bigquery==1.8.7 \
    dbt-redshift==1.8.7 \
    dbt-duckdb==1.8.7

# Set working directory
WORKDIR /project

# Default command
CMD ["dbt", "--version"]
