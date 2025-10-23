import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

const execAsync = promisify(exec);

interface DbtProjectConfig {
  name: string;
  version: string;
  require_dbt_version?: string;
  profile?: string;
}

interface DbtRunResult {
  success: boolean;
  manifestPath: string;
  manifest: any;
  duration: number;
  errors: string[];
}

export class DbtRunner {
  private workDir: string;
  private dockerImage: string;

  constructor() {
    this.workDir = process.env.DBT_WORK_DIR || '/tmp/dbt-extractions';
    this.dockerImage = process.env.DBT_DOCKER_IMAGE || 'dbt-runner:latest';
  }

  /**
   * Clone a GitHub or GitLab repository
   */
  async cloneRepository(
    repoUrl: string,
    branch: string,
    token: string,
    provider: 'github' | 'gitlab' = 'github'
  ): Promise<string> {
    const repoName = this.extractRepoName(repoUrl);
    const timestamp = Date.now();
    const clonePath = path.join(this.workDir, `${repoName}-${timestamp}`);

    console.log(`📦 Cloning ${provider} repository: ${repoUrl}`);
    console.log(`   Branch: ${branch}`);
    console.log(`   Target: ${clonePath}`);

    await fs.mkdir(this.workDir, { recursive: true });

    const authenticatedUrl = this.buildAuthenticatedUrl(repoUrl, token, provider);

    try {
      const { stdout, stderr } = await execAsync(
        `git clone --depth 1 --branch ${branch} ${authenticatedUrl} ${clonePath}`,
        { timeout: 300000 }
      );

      console.log(`✅ Repository cloned successfully`);
      if (stderr) console.log(`   Git output: ${stderr}`);

      return clonePath;
    } catch (error: any) {
      console.error(`❌ Failed to clone repository:`, error.message);
      throw new Error(`Git clone failed: ${error.message}`);
    }
  }

  /**
   * Recursively search for dbt_project.yml in repository
   */
  async findDbtProject(projectPath: string): Promise<string | null> {
    console.log(`🔍 Searching for dbt_project.yml in repository...`);
    
    try {
      // Use find command to search for dbt_project.yml recursively
      // Limit depth to 10 levels to handle deeply nested structures
      const { stdout } = await execAsync(
        `find "${projectPath}" -maxdepth 10 -name "dbt_project.yml" -type f`,
        { timeout: 30000 }
      );

      const foundPaths = stdout.trim().split('\n').filter(p => p);
      
      if (foundPaths.length === 0) {
        console.warn(`⚠️  Could not find dbt_project.yml in repository`);
        return null;
      }

      // Use the first found dbt_project.yml
      const dbtProjectFile = foundPaths[0];
      const dbtProjectDir = path.dirname(dbtProjectFile);
      
      const relativePath = path.relative(projectPath, dbtProjectDir);
      if (relativePath) {
        console.log(`✅ Found dbt_project.yml in /${relativePath}/ directory`);
      } else {
        console.log(`✅ Found dbt_project.yml in root directory`);
      }
      
      return dbtProjectDir;
    } catch (error: any) {
      console.error(`❌ Error searching for dbt_project.yml:`, error.message);
      return null;
    }
  }

  /**
   * Detect dbt version from dbt_project.yml
   */
  async detectDbtVersion(projectPath: string): Promise<string> {
    const dbtProjectPath = path.join(projectPath, 'dbt_project.yml');

    try {
      const content = await fs.readFile(dbtProjectPath, 'utf-8');
      const config = yaml.load(content) as DbtProjectConfig;

      console.log(`📋 dbt project: ${config.name}`);

      if (config.require_dbt_version) {
        const versionMatch = config.require_dbt_version.match(/[\d.]+/);
        if (versionMatch) {
          console.log(`   Required dbt version: ${versionMatch[0]}`);
          return versionMatch[0];
        }
      }

      console.log(`   No version requirement, using default: 1.7.0`);
      return '1.7.0';
    } catch (error) {
      console.warn(`⚠️  Could not read dbt_project.yml, using default version`);
      return '1.7.0';
    }
  }

  /**
   * Get profile name from dbt_project.yml
   */
  async getProfileName(projectPath: string): Promise<string> {
    const dbtProjectPath = path.join(projectPath, 'dbt_project.yml');
    
    try {
      const content = await fs.readFile(dbtProjectPath, 'utf-8');
      const config = yaml.load(content) as DbtProjectConfig;
      return config.profile || 'default';
    } catch (error) {
      console.warn(`⚠️  Could not read profile name, using 'default'`);
      return 'default';
    }
  }

  /**
   * Scan dbt project for env_var references and extract variable names
   */
  async scanForEnvVars(projectPath: string): Promise<string[]> {
    try {
      // Search for env_var() calls in SQL and YAML files
      const { stdout } = await execAsync(
        `grep -r "env_var(" "${projectPath}" --include="*.sql" --include="*.yml" --include="*.yaml" || true`,
        { timeout: 30000 }
      );

      // Extract variable names from env_var('VAR_NAME') or env_var("VAR_NAME")
      const envVarMatches = stdout.matchAll(/env_var\(['"]([^'"]+)['"]\)/g);
      const envVars = new Set<string>();
      
      for (const match of envVarMatches) {
        envVars.add(match[1]);
      }

      console.log(`🔍 Found ${envVars.size} unique env_var references in project`);
      return Array.from(envVars);
    } catch (error) {
      console.warn(`⚠️  Could not scan for env vars:`, error);
      return [];
    }
  }

  /**
   * Handle packages.yml to filter out private SSH repos but keep public packages
   */
  async handlePackagesFile(projectPath: string): Promise<void> {
    const packagesPath = path.join(projectPath, 'packages.yml');
    const packagesBackupPath = path.join(projectPath, 'packages.yml.backup');

    try {
      await fs.access(packagesPath);
      
      // Read and parse packages.yml
      const content = await fs.readFile(packagesPath, 'utf-8');
      const packages = yaml.load(content) as any;

      if (!packages || !packages.packages) {
        console.log(`   No packages defined in packages.yml`);
        return;
      }

      // Backup original
      await fs.writeFile(packagesBackupPath, content, 'utf-8');

      // Filter out git packages (SSH repos), keep only public packages from dbt hub
      const publicPackages = packages.packages.filter((pkg: any) => {
        // Keep packages that use 'package' key (dbt hub packages like dbt_utils)
        // Remove packages that use 'git' key (private SSH repos)
        return pkg.package && !pkg.git;
      });

      if (publicPackages.length === 0) {
        // No public packages, remove packages.yml entirely
        await fs.rename(packagesPath, packagesBackupPath);
        console.log(`✅ Disabled packages.yml (only private repos found)`);
      } else {
        // Write filtered packages.yml with only public packages
        const filteredPackages = { packages: publicPackages };
        await fs.writeFile(packagesPath, yaml.dump(filteredPackages), 'utf-8');
        console.log(`✅ Filtered packages.yml: kept ${publicPackages.length} public packages, removed private repos`);
      }
    } catch (error) {
      // No packages.yml file or error reading it
      console.log(`   No packages.yml found or error reading it`);
    }
  }

  /**
   * Create dummy profiles.yml for dbt parse
   */
  async createDummyProfile(projectPath: string): Promise<void> {
    const profilesPath = path.join(projectPath, 'profiles.yml');
    const profileName = await this.getProfileName(projectPath);

    const dummyProfile = `
${profileName}:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: /tmp/dummy.duckdb
`;

    await fs.writeFile(profilesPath, dummyProfile, 'utf-8');
    console.log(`✅ Created dummy profiles.yml with profile: ${profileName}`);
  }

  /**
   * Run dbt parse using Docker container
   */
  async runDbtParse(projectPath: string): Promise<DbtRunResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    console.log(`🐳 Running dbt parse in Docker container...`);

    try {
      // Create dummy profile
      await this.createDummyProfile(projectPath);

      // Handle packages.yml - remove or stub it to avoid SSH dependency issues
      await this.handlePackagesFile(projectPath);

      // Scan project for env_var references
      const projectEnvVars = await this.scanForEnvVars(projectPath);

      // Build docker command with comprehensive dummy environment variables
      // dbt projects often reference env vars in their SQL code (e.g., {{ env_var('DB_NAME') }})
      // We provide dummy values so dbt parse can compile the templates without actual credentials
      const baseEnvVars = [
        'DBT_PROFILES_DIR=/project',
        // Snowflake connection variables
        'SNOWFLAKE_ACCOUNT=dummy',
        'SNOWFLAKE_USER=dummy',
        'SNOWFLAKE_TRANSFORM_USER=dummy',
        'SNOWFLAKE_PASSWORD=dummy',
        'SNOWFLAKE_ROLE=dummy',
        'SNOWFLAKE_TRANSFORM_ROLE=dummy',
        'SNOWFLAKE_DATABASE=dummy',
        'SNOWFLAKE_WAREHOUSE=dummy',
        'SNOWFLAKE_TRANSFORM_WAREHOUSE=dummy',
        'SNOWFLAKE_SCHEMA=INFORMATION_SCHEMA',
        'SNOWFLAKE_TIMEZONE=America/Los_Angeles',
        // Snowflake database variables
        'SNOWFLAKE_PREP_DATABASE=dummy',
        'SNOWFLAKE_PROD_DATABASE=PROD',
        'SNOWFLAKE_LOAD_DATABASE=dummy',
        'SNOWFLAKE_SNAPSHOT_DATABASE=dummy',
        'SNOWFLAKE_TRANSFORM_DATABASE=dummy',
        'SNOWFLAKE_RAW_DATABASE=dummy',
        'SNOWFLAKE_ANALYTICS_DATABASE=dummy',
        // GitLab-specific variables
        'DATA_TEST_BRANCH=main',
        'CI_COMMIT_BRANCH=main',
        'CI_PROJECT_DIR=/project',
        // Generic database variables
        'DBT_DATABASE=dummy',
        'DBT_SCHEMA=dummy',
        'TARGET_DATABASE=dummy',
        'TARGET_SCHEMA=dummy',
        'DATABASE=dummy',
        'SCHEMA=dummy',
        // Environment variables
        'ENV=dev',
        'ENVIRONMENT=dev',
        'DBT_ENV=dev',
        'TARGET=dev'
      ];

      // Add dynamically discovered env vars with dummy values
      const discoveredEnvVars = projectEnvVars.map(varName => `${varName}=dummy`);
      
      // Combine all env vars and format for Docker
      const allEnvVars = [...baseEnvVars, ...discoveredEnvVars]
        .map(v => `-e ${v}`)
        .join(' ');

      console.log(`   Providing ${baseEnvVars.length + discoveredEnvVars.length} environment variables`);

      // Run dbt deps first (to install public packages like dbt_utils), then dbt parse
      // We filtered packages.yml to only include public packages, so this is safe
      const dockerCommand = `docker run --rm -v ${projectPath}:/project ${allEnvVars} ${this.dockerImage} sh -c "cd /project && dbt deps && dbt parse --no-partial-parse"`;

      console.log(`   Docker command: ${dockerCommand}`);

      const { stdout, stderr } = await execAsync(dockerCommand, {
        timeout: 600000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      console.log(`✅ dbt parse completed in Docker`);
      if (stdout) console.log(`   stdout: ${stdout.substring(0, 500)}...`);
      if (stderr) console.log(`   stderr: ${stderr.substring(0, 500)}...`);

      // Check if manifest was generated
      const manifestPath = path.join(projectPath, 'target', 'manifest.json');
      await fs.access(manifestPath);

      // Read and parse manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const duration = Date.now() - startTime;

      console.log(`📊 Manifest generated successfully`);
      console.log(`   Models: ${Object.keys(manifest.nodes || {}).filter(k => k.startsWith('model.')).length}`);
      console.log(`   Sources: ${Object.keys(manifest.sources || {}).length}`);
      console.log(`   Duration: ${duration}ms`);

      return {
        success: true,
        manifestPath,
        manifest,
        duration,
        errors
      };
    } catch (error: any) {
      console.error(`❌ dbt parse failed:`, error.message);
      if (error.stdout) console.error(`   Docker stdout:`, error.stdout);
      if (error.stderr) console.error(`   Docker stderr:`, error.stderr);
      if (error.code) console.error(`   Exit code:`, error.code);
      
      errors.push(error.message);
      if (error.stderr) errors.push(`stderr: ${error.stderr}`);

      return {
        success: false,
        manifestPath: '',
        manifest: null,
        duration: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Clean up cloned repository
   */
  async cleanup(projectPath: string): Promise<void> {
    try {
      console.log(`🧹 Cleaning up: ${projectPath}`);
      await fs.rm(projectPath, { recursive: true, force: true });
      console.log(`✅ Cleanup completed`);
    } catch (error: any) {
      console.warn(`⚠️  Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Full extraction workflow
   */
  async extractMetadata(
    repoUrl: string,
    branch: string,
    token: string,
    provider: 'github' | 'gitlab' = 'github'
  ): Promise<DbtRunResult> {
    let clonePath: string | null = null;

    try {
      // Step 1: Clone repository
      clonePath = await this.cloneRepository(repoUrl, branch, token, provider);

      // Step 2: Find dbt project (may be in subdirectory)
      const dbtProjectPath = await this.findDbtProject(clonePath);
      if (!dbtProjectPath) {
        throw new Error('Could not find dbt_project.yml in repository. This may not be a dbt project.');
      }

      // Step 3: Detect dbt version
      const dbtVersion = await this.detectDbtVersion(dbtProjectPath);

      // Step 4: Run dbt parse in Docker
      const result = await this.runDbtParse(dbtProjectPath);

      return result;
    } catch (error: any) {
      console.error(`❌ Extraction failed:`, error.message);
      throw error;
    } finally {
      // Always cleanup (cleanup the clone path, not the dbt project path)
      if (clonePath) {
        await this.cleanup(clonePath);
      }
    }
  }

  // Helper methods

  private extractRepoName(repoUrl: string): string {
    const match = repoUrl.match(/\/([^\/]+)\.git$/) || repoUrl.match(/\/([^\/]+)$/);
    return match ? match[1] : 'repo';
  }

  private buildAuthenticatedUrl(repoUrl: string, token: string, provider: 'github' | 'gitlab' = 'github'): string {
    if (repoUrl.startsWith('https://')) {
      if (provider === 'gitlab') {
        // GitLab uses oauth2:TOKEN format
        return repoUrl.replace('https://', `https://oauth2:${token}@`);
      } else {
        // GitHub uses TOKEN as username
        return repoUrl.replace('https://', `https://${token}@`);
      }
    }
    return repoUrl;
  }
}
