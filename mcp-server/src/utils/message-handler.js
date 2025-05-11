/**
 * Custom message handler for the Windsurf Task Master MCP server
 * Handles proper JSON message formatting and serialization
 */

import { logger } from './logger.js';

/**
 * Safely parse a JSON string - simplified to prevent JSON parsing errors
 * @param {string} jsonString - The JSON string to parse
 * @returns {object|null} - The parsed JSON object or null if parsing fails
 */
export function safeParseJson(jsonString) {
    try {
        // Basic trim to remove whitespace
        const trimmed = jsonString.trim();
        
        // Simple direct parse - no complex handling
        return JSON.parse(trimmed);
    } catch (error) {
        // Minimal error logging to stderr only
        logger.error(`Error parsing JSON: ${error.message}`);
        return null;
    }
}

/**
 * Safely stringify a JSON object, ensuring proper formatting
 * @param {object} jsonObject - The JSON object to stringify
 * @returns {string} - The stringified JSON
 */
export function safeStringifyJson(jsonObject) {
    try {
        // Use standard JSON.stringify with proper formatting
        return JSON.stringify(jsonObject);
    } catch (error) {
        logger.error(`Error stringifying JSON: ${error.message}`);
        
        // Try to handle circular references
        try {
            const cache = new Set();
            const safeJson = JSON.stringify(jsonObject, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (cache.has(value)) {
                        return '[Circular Reference]';
                    }
                    cache.add(value);
                }
                return value;
            });
            return safeJson;
        } catch (secondError) {
            logger.error(`Failed to stringify JSON after handling circular references: ${secondError.message}`);
            return '{}';
        }
    }
}

/**
 * Create a properly formatted JSON-RPC response
 * @param {string|number} id - The request ID
 * @param {object} result - The result object
 * @returns {string} - The formatted JSON-RPC response
 */
export function createJsonRpcResponse(id, result) {
    const response = {
        jsonrpc: '2.0',
        id,
        result
    };
    return safeStringifyJson(response);
}

/**
 * Create a properly formatted JSON-RPC error response
 * @param {string|number} id - The request ID
 * @param {number} code - The error code
 * @param {string} message - The error message
 * @param {object} data - Additional error data (optional)
 * @returns {string} - The formatted JSON-RPC error response
 */
export function createJsonRpcErrorResponse(id, code, message, data = undefined) {
    const response = {
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message,
            ...(data && { data })
        }
    };
    return safeStringifyJson(response);
}

/**
 * Create a properly formatted JSON-RPC request
 * @param {string} method - The method name
 * @param {object} params - The method parameters
 * @param {string|number} id - The request ID
 * @returns {string} - The formatted JSON-RPC request
 */
export function createJsonRpcRequest(method, params, id) {
    const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
    };
    return safeStringifyJson(request);
}

/**
 * Create a properly formatted JSON-RPC notification
 * @param {string} method - The method name
 * @param {object} params - The method parameters (optional)
 * @returns {string} - The formatted JSON-RPC notification
 */
export function createJsonRpcNotification(method, params = undefined) {
    const notification = {
        jsonrpc: '2.0',
        method,
        ...(params && { params })
    };
    return safeStringifyJson(notification);
}

/**
 * Import the MCP methods router
 */
import { routeMethod } from './mcp-methods.js';

/**
 * Handle missing methods by providing a stub implementation
 * @param {string} method - The method name
 * @param {object} params - The method parameters
 * @param {string|number} id - The request ID
 * @returns {string} - The JSON-RPC response
 */
export function handleMissingMethod(method, params, id) {
    logger.info(`Handling missing method: ${method}`);
    
    // Use the MCP methods router to handle the method
    return routeMethod(method, params, id);
}

export default {
    safeParseJson,
    safeStringifyJson,
    createJsonRpcResponse,
    createJsonRpcErrorResponse,
    createJsonRpcRequest,
    createJsonRpcNotification,
    handleMissingMethod
};
