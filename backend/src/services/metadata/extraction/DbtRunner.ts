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

      // Build docker command
      // Mount project directory and run dbt parse
      const dockerCommand = `
        docker run --rm \
          -v ${projectPath}:/project \
          -e DBT_PROFILES_DIR=/project \
          ${this.dockerImage} \
          sh -c "cd /project && dbt deps && dbt parse"
      `.replace(/\s+/g, ' ').trim();

      console.log(`   Docker command: ${dockerCommand}`);

      const { stdout, stderr } = await execAsync(dockerCommand, {
        timeout: 600000, // 10 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      console.log(`✅ dbt parse completed in Docker`);
      if (stdout) console.log(`   Output: ${stdout.substring(0, 200)}...`);

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
      errors.push(error.message);

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
    let projectPath: string | null = null;

    try {
      // Step 1: Clone repository
      projectPath = await this.cloneRepository(repoUrl, branch, token, provider);

      // Step 2: Detect dbt version
      const dbtVersion = await this.detectDbtVersion(projectPath);

      // Step 3: Run dbt parse in Docker
      const result = await this.runDbtParse(projectPath);

      return result;
    } catch (error: any) {
      console.error(`❌ Extraction failed:`, error.message);
      throw error;
    } finally {
      // Always cleanup
      if (projectPath) {
        await this.cleanup(projectPath);
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
