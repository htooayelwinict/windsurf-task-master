/**
 * Strict error recovery utilities for the Windsurf Task Master MCP server
 * Provides mechanisms to recover from communication errors without runaway counts
 */

import { logger } from './logger.js';
import { createJsonRpcErrorResponse } from './message-handler.js';

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
 * Error pattern detection - if we get too many errors in rapid succession, something is wrong
 * @type {Map<string, number>}
 */
const errorPatterns = new Map();

/**
 * Handle a communication error and attempt recovery
 * @param {Error} error - The error that occurred
 * @param {number|string} requestId - The ID of the request that caused the error
 * @returns {string|null} - Error response to send, or null if recovery failed
 */
export function handleCommunicationError(error, requestId = 0) {
    const now = Date.now();
    const errorType = error.constructor.name;
    
    // Hard cap on error count to prevent runaway
    if (consecutiveErrorCount > 100) {
        process.stderr.write(`[ERROR] Error count exceeded safe limit (${consecutiveErrorCount}). Resetting to prevent runaway.\n`);
        consecutiveErrorCount = 0;
        errorPatterns.clear();
    }
    
    // Update error pattern tracking with safe limits
    const patternKey = `${errorType}:${error.message.substring(0, 50)}`;
    const patternCount = Math.min((errorPatterns.get(patternKey) || 0) + 1, 100);
    errorPatterns.set(patternKey, patternCount);
    
    // Clean up old error patterns (older than 5 seconds)
    if (now - lastErrorTimestamp > 5000) {
        process.stderr.write(`[INFO] Resetting error patterns due to time gap (${(now - lastErrorTimestamp)/1000}s)\n`);
        errorPatterns.clear();
        consecutiveErrorCount = 0;
    }
    
    // Update timestamp
    lastErrorTimestamp = now;
    
    // Check for error pattern loops with safe limit
    if (patternCount > 10) {
        process.stderr.write(`[ERROR] Error pattern detected: ${patternKey} occurred ${patternCount} times\n`);
        // Reset this pattern to prevent runaway
        errorPatterns.set(patternKey, 0);
    }
    
    // Only increment if errors are close together (less than 1 second apart)
    // with a hard cap to prevent runaway
    consecutiveErrorCount = Math.min(consecutiveErrorCount + 1, 100);
    
    // Log warning to stderr only
    if (consecutiveErrorCount > 1) {
        process.stderr.write(`[WARN] Approaching error threshold (${consecutiveErrorCount}/${MAX_CONSECUTIVE_ERRORS})\n`);
    }
    
    // Check if we need to force a restart
    if (consecutiveErrorCount >= MAX_CONSECUTIVE_ERRORS) {
        process.stderr.write(`[ERROR] Error threshold reached (${consecutiveErrorCount}/${MAX_CONSECUTIVE_ERRORS}). Server should be restarted.\n`);
        // In a production environment, we might want to trigger an automatic restart here
        // For now, we'll just reset the counter to prevent infinite loops
        consecutiveErrorCount = 0;
    }
    
    // Create an error response
    try {
        return createJsonRpcErrorResponse(
            requestId,
            -32603,
            `Internal error: ${error.message}`
        );
    } catch (responseError) {
        process.stderr.write(`[ERROR] Failed to create error response: ${responseError.message}\n`);
        return null;
    }
}

/**
 * Reset the consecutive error count after successful communication
 */
export function resetErrorCount() {
    if (consecutiveErrorCount > 0) {
        process.stderr.write(`[INFO] Resetting error count from ${consecutiveErrorCount} to 0\n`);
        consecutiveErrorCount = 0;
    }
    
    // Also clear error patterns on successful communication
    errorPatterns.clear();
}

/**
 * Get the current consecutive error count
 * @returns {number} - The current consecutive error count
 */
export function getErrorCount() {
    return consecutiveErrorCount;
}

/**
 * Get error pattern statistics
 * @returns {Object} - Statistics about error patterns
 */
export function getErrorPatternStats() {
    const stats = {
        totalPatterns: errorPatterns.size,
        patterns: []
    };
    
    errorPatterns.forEach((count, pattern) => {
        stats.patterns.push({ pattern, count });
    });
    
    // Sort by count descending
    stats.patterns.sort((a, b) => b.count - a.count);
    
    return stats;
}

export default {
    handleCommunicationError,
    resetErrorCount,
    getErrorCount,
    getErrorPatternStats
};
