import { logger } from './logger.js';

/**
 * Custom error classes and error handling utilities for the Windsurf Task Master system.
 * 
 * This module provides a set of error classes and utility functions for handling and logging errors in a consistent and structured way.
 */

// Base error class for task-master specific errors
/**
 * Base error class for the Windsurf Task Master system.
 * 
 * This class extends the standard Error class and adds additional properties
 * for better error tracking and debugging. All specific error types in the
 * system should extend this base class.
 * 
 * @class
 * @extends Error
 */
export class TaskMasterError extends Error {
    /**
     * Create a new TaskMasterError.
     * 
     * @param {string} message - Error message describing the issue
     * @param {string} code - Unique error code for the error type
     * @param {object} details - Additional error details (optional)
     */
    constructor(message, code, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }

    /**
     * Convert the error object to a JSON representation.
     * 
     * This method returns a JSON object with the error details, including the error name, message, code, and timestamp.
     * 
     * @returns {object} JSON representation of the error object
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

/**
 * Error thrown when a task cannot be found in a project.
 * 
 * This error is typically thrown when attempting to access, update, or delete
 * a task that doesn't exist in the specified project.
 * 
 * @class
 * @extends TaskMasterError
 */
export class TaskNotFoundError extends TaskMasterError {
    /**
     * Create a new TaskNotFoundError.
     * 
     * @param {number} taskId - The ID of the task that wasn't found
     * @param {string} projectId - The ID of the project where the task was expected
     */
    constructor(taskId, projectId) {
        super(`Task with id ${taskId} not found in project ${projectId}`, 'TASK_NOT_FOUND', { taskId, projectId });
        this.taskId = taskId;
        this.projectId = projectId;
    }
}

/**
 * Error thrown when a task validation fails.
 * 
 * This error is typically thrown when attempting to create or update a task
 * with invalid or missing data.
 * 
 * @class
 * @extends TaskMasterError
 */
export class TaskValidationError extends TaskMasterError {
    /**
     * Create a new TaskValidationError.
     * 
     * @param {string} message - Error message describing the issue
     * @param {object} validationErrors - Validation error details
     */
    constructor(message, validationErrors) {
        super(message, 'TASK_VALIDATION_ERROR', { validationErrors });
    }
}

/**
 * Error thrown when an invalid task state transition is attempted.
 * 
 * This error is typically thrown when attempting to perform an action
 * that is not valid for the current state of a task, such as trying to
 * update progress on a completed task.
 * 
 * @class
 * @extends Error
 */
export class TaskStateError extends Error {
    /**
     * Create a new TaskStateError.
     * 
     * @param {string} message - Error message describing the issue
     * @param {number} taskId - The ID of the task with the invalid state transition
     * @param {string} currentState - The current state of the task
     * @param {string} action - The action that was attempted
     */
    constructor(message, taskId, currentState, action) {
        super(message);
        this.name = 'TaskStateError';
        this.taskId = taskId;
        this.currentState = currentState;
        this.action = action;
    }
}

// Project-related errors
export class ProjectNotFoundError extends TaskMasterError {
    constructor(projectId) {
        super(
            `Project ${projectId} not found`,
            'PROJECT_NOT_FOUND',
            { projectId }
        );
    }
}

// File system errors
export class FileSystemError extends TaskMasterError {
    constructor(message, operation, path, originalError) {
        super(
            message,
            'FILE_SYSTEM_ERROR',
            { 
                operation,
                path,
                originalError: originalError?.message
            }
        );
    }
}

// Error logging utility
export function logError(error, context = {}) {
    const errorLog = {
        timestamp: new Date().toISOString(),
        error: error instanceof TaskMasterError ? error.toJSON() : {
            name: error.name,
            message: error.message,
            stack: error.stack
        },
        context
    };

    logger.error('Error occurred', errorLog);
    return errorLog;
}

// Error handler middleware for MCP tools
export function createErrorHandler(toolName) {
    return async (error, args = {}) => {
        // Log the error with detailed information for debugging
        const errorLog = logError(error, {
            tool: toolName,
            args: JSON.stringify(args)
        });

        // Include error details in the console for debugging
        console.error(`Error in ${toolName}:`, JSON.stringify(errorLog));

        // Only return the content field in the response to comply with MCP protocol
        return {
            content: [{
                type: 'text',
                text: error instanceof TaskMasterError
                    ? `Error in ${toolName}: ${error.message}`
                    : `Unexpected error in ${toolName}: ${error.message}`
            }]
        };
    };
}
