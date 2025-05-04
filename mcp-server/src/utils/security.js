/**
 * Security utilities for the Windsurf Task Master system.
 * 
 * This module provides security-related utilities for input validation,
 * path sanitization, and other security measures to prevent common
 * vulnerabilities like path traversal attacks.
 * 
 * @module security
 */

import path from 'path';
import { logger } from './logger.js';

/**
 * Validates a project ID to ensure it only contains safe characters.
 * This prevents path traversal and command injection attacks.
 * 
 * @param {string} projectId - The project ID to validate
 * @returns {boolean} True if the project ID is valid, false otherwise
 */
export function isValidProjectId(projectId) {
    if (!projectId || typeof projectId !== 'string') {
        return false;
    }
    
    // Only allow alphanumeric characters, hyphens, and underscores
    const validProjectIdPattern = /^[a-zA-Z0-9-_]+$/;
    return validProjectIdPattern.test(projectId);
}

/**
 * Validates a task ID to ensure it's a positive integer.
 * 
 * @param {number|string} taskId - The task ID to validate
 * @returns {boolean} True if the task ID is valid, false otherwise
 */
export function isValidTaskId(taskId) {
    if (taskId === undefined || taskId === null) {
        return false;
    }
    
    // Convert to number if it's a string
    const id = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
    
    // Check if it's a positive integer
    return Number.isInteger(id) && id > 0;
}

/**
 * Sanitizes a file path to prevent path traversal attacks.
 * This function normalizes the path and ensures it's within the allowed directory.
 * 
 * @param {string} basePath - The base directory that should contain the file
 * @param {string} userPath - The user-provided path component
 * @returns {string|null} The sanitized path or null if the path is invalid
 */
export function sanitizePath(basePath, userPath) {
    if (!basePath || !userPath) {
        return null;
    }
    
    // Validate the user path component
    if (!isValidProjectId(userPath)) {
        logger.warn('Invalid path component detected', { userPath });
        return null;
    }
    
    // Create the full path
    const fullPath = path.join(basePath, userPath);
    
    // Normalize the path to resolve any '..' or '.' segments
    const normalizedPath = path.normalize(fullPath);
    
    // Ensure the normalized path starts with the base path
    if (!normalizedPath.startsWith(path.normalize(basePath))) {
        logger.error('Path traversal attempt detected', { 
            basePath, 
            userPath, 
            normalizedPath 
        });
        return null;
    }
    
    return normalizedPath;
}

/**
 * Validates and sanitizes a project directory path.
 * 
 * @param {string} basePath - The base tasks directory
 * @param {string} projectId - The project ID
 * @returns {string|null} The sanitized project directory path or null if invalid
 */
export function getProjectDirPath(basePath, projectId) {
    if (!isValidProjectId(projectId)) {
        logger.warn('Invalid project ID detected', { projectId });
        return null;
    }
    
    return sanitizePath(basePath, projectId);
}

/**
 * Validates and sanitizes a tasks file path.
 * 
 * @param {string} projectDirPath - The project directory path
 * @param {string} filename - The tasks filename (usually 'tasks.json')
 * @returns {string|null} The sanitized tasks file path or null if invalid
 */
export function getTasksFilePath(projectDirPath, filename) {
    if (!projectDirPath) {
        return null;
    }
    
    // Only allow specific filenames
    if (filename !== 'tasks.json') {
        logger.warn('Invalid tasks filename detected', { filename });
        return null;
    }
    
    return path.join(projectDirPath, filename);
}

/**
 * Redacts sensitive information from error messages and objects.
 * 
 * @param {string|object} input - The input to redact
 * @returns {string|object} The redacted input
 */
export function redactSensitiveInfo(input) {
    if (!input) {
        return input;
    }
    
    if (typeof input === 'string') {
        // Redact file paths
        return input.replace(/\/[a-zA-Z0-9_/.-]+/g, '/[REDACTED_PATH]');
    }
    
    if (typeof input === 'object') {
        const redacted = { ...input };
        
        // Redact sensitive fields
        const sensitiveFields = ['path', 'filepath', 'directory', 'basePath'];
        for (const field of sensitiveFields) {
            if (redacted[field] && typeof redacted[field] === 'string') {
                redacted[field] = '[REDACTED]';
            }
        }
        
        return redacted;
    }
    
    return input;
}
