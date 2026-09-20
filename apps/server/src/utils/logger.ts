import fs from 'node:fs';
import path from 'node:path';

// Resolve logs directory to monorepo project root
const findProjectRoot = () => {
  let curr = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(curr, 'pnpm-workspace.yaml'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
};

const defaultLogsDir = path.resolve(findProjectRoot(), 'logs');

if (!fs.existsSync(defaultLogsDir)) {
  try {
    fs.mkdirSync(defaultLogsDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
}

const serverLogPath = path.join(defaultLogsDir, 'server.log');
const errorLogPath = path.join(defaultLogsDir, 'server.error.log');

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeToFile(filePath: string, line: string): void {
  try {
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  } catch (err) {
    console.error(`Failed writing to log file ${filePath}:`, err);
  }
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
  private service: string;

  constructor(service = 'Server') {
    this.service = service;
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const ts = formatTimestamp();
    const extra = args.length > 0 ? ' ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') : '';
    return `[${ts}] [${level}] [${this.service}] ${message}${extra}`;
  }

  info(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage('INFO', message, ...args);
    console.log(formatted);
    writeToFile(serverLogPath, formatted);
  }

  warn(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage('WARN', message, ...args);
    console.warn(formatted);
    writeToFile(serverLogPath, formatted);
  }

  error(message: string, ...args: unknown[]): void {
    const formatted = this.formatMessage('ERROR', message, ...args);
    console.error(formatted);
    writeToFile(serverLogPath, formatted);
    writeToFile(errorLogPath, formatted);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env['DEBUG'] || process.env['NODE_ENV'] !== 'production') {
      const formatted = this.formatMessage('DEBUG', message, ...args);
      console.log(formatted);
      writeToFile(serverLogPath, formatted);
    }
  }
}

export const logger = new Logger('App');
