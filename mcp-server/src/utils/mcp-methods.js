/**
 * Stub implementations for missing MCP methods
 * These methods are expected by Claude Desktop but not implemented in the Windsurf Task Master MCP server
 */

import { logger } from './logger.js';
import {
    createJsonRpcResponse,
    createJsonRpcErrorResponse
} from './message-handler.js';

/**
 * Handle prompts/list method
 * @param {object} params - Method parameters
 * @param {string|number} id - Request ID
 * @returns {string} - JSON-RPC response
 */
export function handlePromptsList(params, id) {
    logger.info('Handling prompts/list method');
    
    // Return an empty list of prompts
    return createJsonRpcResponse(id, { prompts: [] });
}

/**
 * Handle resources/list method
 * @param {object} params - Method parameters
 * @param {string|number} id - Request ID
 * @returns {string} - JSON-RPC response
 */
export function handleResourcesList(params, id) {
    logger.info('Handling resources/list method');
    
    // Return an empty list of resources
    return createJsonRpcResponse(id, { resources: [] });
}

/**
 * Handle resources/templates/list method
 * @param {object} params - Method parameters
 * @param {string|number} id - Request ID
 * @returns {string} - JSON-RPC response
 */
export function handleResourcesTemplatesList(params, id) {
    logger.info('Handling resources/templates/list method');
    
    // Return an empty list of resource templates
    return createJsonRpcResponse(id, { templates: [] });
}

/**
 * Handle resources/read method
 * @param {object} params - Method parameters
 * @param {string|number} id - Request ID
 * @returns {string} - JSON-RPC response
 */
export function handleResourcesRead(params, id) {
    logger.info(`Handling resources/read method for URI: ${params?.uri}`);
    
    // Return a not found error
    return createJsonRpcErrorResponse(id, -32602, 'Resource not found');
}

/**
 * Handle prompts/get method
 * @param {object} params - Method parameters
 * @param {string|number} id - Request ID
 * @returns {string} - JSON-RPC response
 */
export function handlePromptsGet(params, id) {
    logger.info(`Handling prompts/get method for ID: ${params?.id}`);
    
    // Return a not found error
    return createJsonRpcErrorResponse(id, -32602, 'Prompt not found');
}

/**
 * Route a method call to the appropriate handler
 * @param {string} method - Method name
 * @param {object} params - Method parameters
 * @param {string|number} id - Request ID
 * @returns {string} - JSON-RPC response
 */
export function routeMethod(method, params, id) {
    switch (method) {
        case 'prompts/list':
            return handlePromptsList(params, id);
        
        case 'resources/list':
            return handleResourcesList(params, id);
        
        case 'resources/templates/list':
            return handleResourcesTemplatesList(params, id);
        
        case 'resources/read':
            return handleResourcesRead(params, id);
        
        case 'prompts/get':
            return handlePromptsGet(params, id);
        
        default:
            logger.warn(`Unhandled method: ${method}`);
            return createJsonRpcErrorResponse(id, -32601, 'Method not found');
    }
}

export default {
    handlePromptsList,
    handleResourcesList,
    handleResourcesTemplatesList,
    handleResourcesRead,
    handlePromptsGet,
    routeMethod
};
