/**
 * Error recovery utilities for the Windsurf Task Master MCP server
 * Provides mechanisms to recover from communication errors
 */

import { logger } from './logger.js';

/**
 * Maximum number of consecutive errors before forcing a restart
 * @type {number}
 */
const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Counter for consecutive errors
 * @type {number}
 */
let consecutiveErrorCount = 0;

/**
 * Last error timestamp to detect error patterns
 * @type {number}
 */
let lastErrorTimestamp = 0;

/**
 * Handle a communication error and attempt recovery
 * @param {Error} error - The error that occurred
 * @param {number|string} requestId - The ID of the request that caused the error
 * @returns {string|null} - Error response to send, or null if recovery failed
 */
export function handleCommunicationError(error, requestId = 0) {
    const now = Date.now();
    
    // Clean up old errors (older than 5 seconds)
    if (now - lastErrorTimestamp > 5000) {
        logger.info(`Resetting error count due to time gap (${(now - lastErrorTimestamp)/1000}s)`);
        consecutiveErrorCount = 0;
    }
    
    // Update timestamp
    lastErrorTimestamp = now;
    
    // Increment error count
    consecutiveErrorCount++;
    
    // Log to stderr
    logger.error(`Communication error: ${error.message}`);
    
    // Log warning if approaching threshold
    if (consecutiveErrorCount > 1) {
        logger.warn(`Approaching error threshold (${consecutiveErrorCount}/${MAX_CONSECUTIVE_ERRORS})`);
    }
    
    // Check if we need to force a restart
    if (consecutiveErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        logger.error(`Error threshold reached (${consecutiveErrorCount}/${MAX_CONSECUTIVE_ERRORS}). Server should be restarted.`);
        // Reset the counter to prevent infinite loops
        consecutiveErrorCount = 0;
    }
    
    // Create a simple error response
    try {
        return JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            error: {
                code: -32603,
                message: `Internal error: ${error.message}`
            }
        }) + '\n';
    } catch (responseError) {
        logger.error(`Failed to create error response: ${responseError.message}`);
        return null;
    }
}

/**
 * Reset the consecutive error count after successful communication
 */
export function resetErrorCount() {
    if (consecutiveErrorCount > 0) {
        logger.info(`Resetting error count from ${consecutiveErrorCount} to 0`);
        consecutiveErrorCount = 0;
    }
    
    // Update timestamp to prevent false resets
    lastErrorTimestamp = Date.now();
}

/**
 * Get the current consecutive error count
 * @returns {number} - The current consecutive error count
 */
export function getErrorCount() {
    return consecutiveErrorCount;
}



export default {
    handleCommunicationError,
    resetErrorCount,
    getErrorCount
};
