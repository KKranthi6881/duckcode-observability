import fs from 'fs/promises';
import path from 'path';

/**
 * Enterprise-grade extraction logger
 * Writes logs to both console AND file for debugging
 */
export class ExtractionLogger {
  private logFilePath: string;
  private connectionId: string;
  private startTime: Date;
  private logs: string[] = [];

  constructor(connectionId: string) {
    this.connectionId = connectionId;
    this.startTime = new Date();
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs', 'extractions');
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logsDir, `extraction-${connectionId}-${timestamp}.log`);
    
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory() {
    const logsDir = path.dirname(this.logFilePath);
    try {
      await fs.mkdir(logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * Log a message to both console and file
   */
  async log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logLine = data 
      ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}`
      : `[${timestamp}] ${message}`;
    
    // Console output
    console.log(message, data || '');
    
    // File output
    this.logs.push(logLine);
    
    try {
      await fs.appendFile(this.logFilePath, logLine + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Log section header
   */
  async section(title: string) {
    const separator = '='.repeat(80);
    await this.log(`\n${separator}`);
    await this.log(`  ${title}`);
    await this.log(separator);
  }

  /**
   * Log subsection
   */
  async subsection(title: string) {
    await this.log(`\n--- ${title} ---`);
  }

  /**
   * Log statistics
   */
  async stats(stats: Record<string, number | string>) {
    await this.log('\n📊 Statistics:');
    for (const [key, value] of Object.entries(stats)) {
      await this.log(`   ${key}: ${value}`);
    }
  }

  /**
   * Log warning
   */
  async warn(message: string, data?: any) {
    await this.log(`⚠️  WARNING: ${message}`, data);
  }

  /**
   * Log error
   */
  async error(message: string, error?: any) {
    await this.log(`❌ ERROR: ${message}`, error);
  }

  /**
   * Log success
   */
  async success(message: string, data?: any) {
    await this.log(`✅ ${message}`, data);
  }

  /**
   * Get summary of extraction
   */
  async summary() {
    const duration = Date.now() - this.startTime.getTime();
    const durationMin = (duration / 1000 / 60).toFixed(2);
    
    await this.section('EXTRACTION SUMMARY');
    await this.log(`Connection ID: ${this.connectionId}`);
    await this.log(`Start Time: ${this.startTime.toISOString()}`);
    await this.log(`Duration: ${durationMin} minutes`);
    await this.log(`Log File: ${this.logFilePath}`);
    await this.log(`Total Log Lines: ${this.logs.length}`);
  }

  /**
   * Get log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }
}
