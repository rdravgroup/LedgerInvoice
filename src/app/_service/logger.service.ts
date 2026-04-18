import { Injectable } from '@angular/core';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  stack?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private logs: LogEntry[] = [];
  private logLevel = LogLevel.DEBUG;
  private maxLogs = 500; // Keep last 500 logs
  private enableConsole = true; // Log to console
  private enableStorage = true; // Log to localStorage

  constructor() {
    this.loadLogs();
  }

  /**
   * Log debug message
   */
  debug(module: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, module, message, data);
  }

  /**
   * Log info message
   */
  info(module: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, module, message, data);
  }

  /**
   * Log warning message
   */
  warn(module: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, module, message, data);
  }

  /**
   * Log error message
   */
  error(module: string, message: string, data?: any, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      module,
      message,
      data,
      stack: error?.stack
    };
    this.addLog(entry);
  }

  /**
   * API request logging
   */
  logApiRequest(method: string, url: string, body?: any): void {
    const message = `${method} ${url}`;
    this.info('API_REQUEST', message, {
      method,
      url,
      body: this.sanitizeData(body)
    });
  }

  /**
   * API response logging
   */
  logApiResponse(method: string, url: string, status: number, response?: any): void {
    const message = `${method} ${url} - Status: ${status}`;
    this.info('API_RESPONSE', message, {
      method,
      url,
      status,
      response: this.sanitizeData(response)
    });
  }

  /**
   * API error logging
   */
  logApiError(method: string, url: string, status: number, error?: any): void {
    const message = `${method} ${url} - Error: ${status}`;
    this.error('API_ERROR', message, {
      method,
      url,
      status,
      error: this.sanitizeError(error)
    });
  }

  /**
   * Form validation logging
   */
  logFormValidation(formName: string, isValid: boolean, errors?: any): void {
    const status = isValid ? 'VALID' : 'INVALID';
    this.debug('FORM_VALIDATION', `${formName} - ${status}`, {
      formName,
      isValid,
      errors
    });
  }

  /**
   * Authentication event logging
   */
  logAuthEvent(event: string, details?: any): void {
    this.info('AUTH_EVENT', event, details);
  }

  /**
   * Component lifecycle logging
   */
  logComponentLifecycle(component: string, lifecycle: string): void {
    this.debug('COMPONENT_LIFECYCLE', `${component} - ${lifecycle}`);
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs by module
   */
  getLogsByModule(module: string): LogEntry[] {
    return this.logs.filter(log => log.module === module);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    if (this.enableStorage) {
      localStorage.removeItem('app_logs');
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Download logs as file
   */
  downloadLogs(): void {
    const logsJson = this.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs_${new Date().toISOString()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Get recent logs (last N entries)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs within time range
   */
  getLogsByTimeRange(from: Date, to: Date): LogEntry[] {
    return this.logs.filter(log => log.timestamp >= from && log.timestamp <= to);
  }

  /**
   * Get error summary
   */
  getErrorSummary(): { module: string; errorCount: number; lastError: LogEntry | null }[] {
    const summary = new Map<string, { count: number; lastError: LogEntry | null }>();

    this.logs
      .filter(log => log.level === LogLevel.ERROR)
      .forEach(log => {
        const moduleData = summary.get(log.module) || { count: 0, lastError: null };
        moduleData.count++;
        moduleData.lastError = log;
        summary.set(log.module, moduleData);
      });

    return Array.from(summary.entries()).map(([module, data]) => ({
      module,
      errorCount: data.count,
      lastError: data.lastError
    }));
  }

  /**
   * Private method to log entry
   */
  private log(level: LogLevel, module: string, message: string, data?: any): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      module,
      message,
      data: this.sanitizeData(data)
    };

    this.addLog(entry);
  }

  /**
   * Add log entry and maintain max size
   */
  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Maintain max logs size
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output if enabled
    if (this.enableConsole) {
      this.outputToConsole(entry);
    }

    // Save to localStorage if enabled
    if (this.enableStorage) {
      this.saveLogs();
    }
  }

  /**
   * Output log to browser console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toLocaleTimeString();
    const prefix = `[${timestamp}] [${LogLevel[entry.level]}] [${entry.module}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(message, entry.data);
        if (entry.stack) {
          console.error('Stack:', entry.stack);
        }
        break;
    }
  }

  /**
   * Save logs to localStorage
   */
  private saveLogs(): void {
    try {
      const logsJson = JSON.stringify(this.logs.slice(-100)); // Store last 100 logs
      localStorage.setItem('app_logs', logsJson);
    } catch (e) {
      console.warn('Failed to save logs to localStorage', e);
    }
  }

  /**
   * Load logs from localStorage
   */
  private loadLogs(): void {
    try {
      const logsJson = localStorage.getItem('app_logs');
      if (logsJson) {
        const parsedLogs = JSON.parse(logsJson);
        this.logs = parsedLogs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (e) {
      console.warn('Failed to load logs from localStorage', e);
    }
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    const sensitiveKeys = ['password', 'token', 'refreshToken', 'secret', 'apiKey', 'authorization'];
    const sanitized = JSON.parse(JSON.stringify(data));

    const sanitizeObject = (obj: any) => {
      for (const key in obj) {
        if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey.toLowerCase()))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    };

    if (typeof sanitized === 'object') {
      sanitizeObject(sanitized);
    }

    return sanitized;
  }

  /**
   * Sanitize error objects
   */
  private sanitizeError(error: any): any {
    if (!error) return error;

    return {
      message: error.message || String(error),
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      type: error.type,
      headers: this.sanitizeData(error.headers)
    };
  }
}
