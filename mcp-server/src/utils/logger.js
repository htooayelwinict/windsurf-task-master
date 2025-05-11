/**
 * Simple logger utility for the Windsurf Task Master system.
 * 
 * This module provides basic logging functionality that writes directly to stderr
 * to prevent interference with JSON-RPC messages on stdout.
 * 
 * @module logger
 */
class SimpleLogger {
    /**
     * Format a log message with timestamp
     * @param {string} level - The log level
     * @param {string} message - The message to log
     * @returns {string} - Formatted message
     */
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `${timestamp} [${level}] ${message}`;
    }
    
    /**
     * Log an error message
     * @param {string} message - The message to log
     */
    error(message) {
        // Always write to stderr to avoid interfering with JSON-RPC
        process.stderr.write(this.formatMessage('ERROR', message) + '\n');
    }
    
    /**
     * Log a warning message
     * @param {string} message - The message to log
     */
    warn(message) {
        process.stderr.write(this.formatMessage('WARN', message) + '\n');
    }
    
    /**
     * Log an info message
     * @param {string} message - The message to log
     */
    info(message) {
        process.stderr.write(this.formatMessage('INFO', message) + '\n');
    }
    
    /**
     * Log a debug message
     * @param {string} message - The message to log
     */
    debug(message) {
        // Only log debug messages if DEBUG environment variable is set
        if (process.env.DEBUG) {
            process.stderr.write(this.formatMessage('DEBUG', message) + '\n');
        }
    }
    
    /**
     * Log a task operation
     * @param {string} operation - The operation
     * @param {number} taskId - The task ID
     * @param {string} projectId - The project ID
     */
    taskOp(operation, taskId, projectId) {
        this.info(`Task Operation: ${operation} (Task: ${taskId}, Project: ${projectId})`);
    }
    
    /**
     * Log a file system operation
     * @param {string} operation - The operation
     * @param {string} path - The file path
     */
    fsOp(operation, path) {
        this.debug(`File System Operation: ${operation} (Path: ${path})`);
    }
}

export const logger = new SimpleLogger();
