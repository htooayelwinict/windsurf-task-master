import chalk from 'chalk';

/**
 * Logger utility for the Windsurf Task Master system.
 * 
 * This module provides structured logging functionality with different log levels,
 * colorized output, and metadata support. It helps with debugging, error tracking,
 * and monitoring application behavior.
 * 
 * @module logger
 */
class Logger {
    constructor() {
        this.levels = {
            error: { color: 'red', priority: 0 },
            warn: { color: 'yellow', priority: 1 },
            info: { color: 'blue', priority: 2 },
            debug: { color: 'gray', priority: 3 }
        };
        
        this.level = process.env.LOG_LEVEL || 'info';
    }

    /**
     * Format a log message with metadata for consistent output.
     * 
     * This function formats a log message with timestamp and structured metadata,
     * making it easier to parse and analyze logs. The metadata is formatted as
     * a JSON string and appended to the message.
     * 
     * @param {string} level - The log level (e.g., error, warn, info, debug)
     * @param {string} message - The main log message
     * @param {Object} context - Additional contextual data to include in the log
     * @returns {string} Formatted log message with timestamp and metadata
     * @private
     */
    formatMessage(level, message, context = {}) {
        const timestamp = new Date().toISOString();
        const levelUpper = level.toUpperCase();
        const contextStr = Object.keys(context).length 
            ? `\n${JSON.stringify(context, null, 2)}`
            : '';

        return `${timestamp} [${levelUpper}] ${message}${contextStr}`;
    }

    /**
     * Determine if a log message should be logged based on the current log level.
     * 
     * This method checks if the priority of the given log level is less than or
     * equal to the priority of the current log level.
     * 
     * @param {string} level - The log level to check
     * @returns {boolean} True if the message should be logged, false otherwise
     */
    shouldLog(level) {
        return this.levels[level].priority <= this.levels[this.level].priority;
    }

    /**
     * Log a message with optional metadata.
     * 
     * This method logs a message at the specified level with colorization.
     * It's intended for logging general information, warnings, errors, and debug messages.
     * 
     * @param {string} level - The log level (e.g., error, warn, info, debug)
     * @param {string} message - The log message to display
     * @param {Object} context - Additional contextual data about the log message
     * @returns {void}
     */
    log(level, message, context = {}) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, context);
        const coloredMessage = chalk[this.levels[level].color](formattedMessage);
        
        if (level === 'error') {
            console.error(coloredMessage);
        } else {
            console.log(coloredMessage);
        }
    }

    /**
     * Log an error message with optional metadata.
     * 
     * This method logs a message at the ERROR level with red colorization.
     * It's intended for logging errors, exceptions, and critical issues
     * that require immediate attention.
     * 
     * @param {string} message - The error message to log
     * @param {Object} context - Additional contextual data about the error
     * @returns {void}
     * 
     * @example
     * logger.error('Failed to save task', { 
     *   taskId: 123, 
     *   projectId: 'my-project',
     *   error: new Error('File system error')
     * });
     */
    error(message, context = {}) {
        this.log('error', message, context);
    }

    /**
     * Log a warning message with optional metadata.
     * 
     * This method logs a message at the WARN level with yellow colorization.
     * It's intended for logging potential issues, unexpected events, and warnings.
     * 
     * @param {string} message - The warning message to log
     * @param {Object} context - Additional contextual data about the warning
     * @returns {void}
     * 
     * @example
     * logger.warn('Task deadline approaching', { 
     *   taskId: 123, 
     *   projectId: 'my-project',
     *   deadline: new Date('2023-03-15T14:30:00.000Z')
     * });
     */
    warn(message, context = {}) {
        this.log('warn', message, context);
    }

    /**
     * Log an informational message with optional metadata.
     * 
     * This method logs a message at the INFO level with blue colorization.
     * It's intended for logging general information about application state,
     * important events, and successful operations.
     * 
     * @param {string} message - The informational message to log
     * @param {Object} context - Additional contextual data
     * @returns {void}
     * 
     * @example
     * logger.info('Task created successfully', { 
     *   taskId: 123, 
     *   projectId: 'my-project',
     *   title: 'Implement feature X'
     * });
     */
    info(message, context = {}) {
        this.log('info', message, context);
    }

    /**
     * Log a debug message with optional metadata.
     * 
     * This method logs a message at the DEBUG level with gray colorization.
     * It's intended for logging detailed information about application behavior,
     * internal state, and debugging data.
     * 
     * @param {string} message - The debug message to log
     * @param {Object} context - Additional contextual data about the debug message
     * @returns {void}
     * 
     * @example
     * logger.debug('Task data loaded', { 
     *   taskId: 123, 
     *   projectId: 'my-project',
     *   data: { foo: 'bar', baz: 'qux' }
     * });
     */
    debug(message, context = {}) {
        this.log('debug', message, context);
    }

    /**
     * Log a task operation with optional metadata.
     * 
     * This method logs a message at the INFO level with blue colorization.
     * It's intended for logging task-related operations, such as creation, updates, and deletions.
     * 
     * @param {string} operation - The task operation (e.g., create, update, delete)
     * @param {number} taskId - The ID of the task
     * @param {string} projectId - The ID of the project
     * @param {Object} details - Additional contextual data about the task operation
     * @returns {void}
     */
    taskOp(operation, taskId, projectId, details = {}) {
        this.info(`Task Operation: ${operation}`, {
            taskId,
            projectId,
            ...details
        });
    }

    /**
     * Log a file system operation with optional metadata.
     * 
     * This method logs a message at the DEBUG level with gray colorization.
     * It's intended for logging file system-related operations, such as file creation, updates, and deletions.
     * 
     * @param {string} operation - The file system operation (e.g., create, update, delete)
     * @param {string} path - The file path
     * @param {Object} details - Additional contextual data about the file system operation
     * @returns {void}
     */
    fsOp(operation, path, details = {}) {
        this.debug(`File System Operation: ${operation}`, {
            path,
            ...details
        });
    }
}

export const logger = new Logger();
