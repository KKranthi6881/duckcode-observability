# dbt-runner Docker Image

## Purpose

This Docker image is used by `DbtRunner.ts` to execute `dbt parse` on user repositories. The container runs ephemerally (starts, parses, exits).

## Current Image

**Image:** `dbt-runner:latest`  
**dbt Version:** 1.8.7  
**Adapters:** snowflake, postgres, bigquery, redshift, duckdb

## Rebuild (if needed)

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend/docker/dbt-runner
docker build -t dbt-runner:latest .
```

## Test

```bash
# Test dbt version
docker run --rm dbt-runner:latest dbt --version

# Test on jaffle-shop
git clone https://github.com/dbt-labs/jaffle-shop.git /tmp/jaffle-shop
docker run --rm \
  -v /tmp/jaffle-shop:/project \
  dbt-runner:latest \
  sh -c "dbt deps && dbt parse --target-path ./target"
ls /tmp/jaffle-shop/target/manifest.json
```

## Usage

The image is automatically used by:
- `backend/src/services/metadata/extraction/DbtRunner.ts`
- Environment variable: `DBT_DOCKER_IMAGE` (defaults to `dbt-runner:latest`)

## No Manual Setup Required

The backend automatically:
1. Clones the user's repository
2. Finds `dbt_project.yml`
3. Runs: `docker run --rm -v [repo]:/project dbt-runner:latest sh -c "cd /project && dbt deps && dbt parse"`
4. Reads the generated `manifest.json`
5. Cleans up the container (automatic with `--rm` flag)

**You don't need to start this container manually!**
