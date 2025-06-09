/**
 * Windsurf Task Master™ - Branding Helper Utilities
 * 
 * Provides utility functions to apply consistent branding to tool responses
 */

import { BRANDING } from '../constants/branding.js';

/**
 * Creates a branded success response with consistent formatting
 * 
 * @param {string} message - The main message content
 * @param {Object} options - Additional options
 * @param {string[]} options.suggestions - Optional array of suggestions to include
 * @param {boolean} options.includeTrademark - Whether to include trademark notice (default: true)
 * @returns {Object} - Formatted response object for MCP tools
 */
export function createBrandedSuccessResponse(message, options = {}) {
    const { suggestions = [], includeTrademark = true } = options;
    
    let responseText = `✅ ${message}`;
    
    // Add suggestions if provided
    if (suggestions && suggestions.length > 0) {
        responseText += '\n\n💡 Smart suggestions applied:';
        suggestions.forEach(suggestion => {
            responseText += `\n- ${suggestion}`;
        });
    }
    
    // Add trademark notice if requested
    if (includeTrademark) {
        responseText += `\n\n---\n${BRANDING.TRADEMARK_NOTICE}`;
    }
    
    return {
        content: [{
            type: 'text',
            text: responseText
        }]
    };
}

/**
 * Creates a branded error response with consistent formatting
 * 
 * @param {string|Error} error - The error message or Error object
 * @param {Object} options - Additional options
 * @param {boolean} options.includeSupport - Whether to include support link (default: true)
 * @returns {Object} - Formatted error response object for MCP tools
 */
export function createBrandedErrorResponse(error, options = {}) {
    const { includeSupport = true } = options;
    
    const errorMessage = error instanceof Error ? error.message : error;
    let responseText = `❌ Error in ${BRANDING.PRODUCT_NAME_SHORT}: ${errorMessage}`;
    
    // Add support link if requested
    if (includeSupport) {
        responseText += `\n\nNeed help? Visit: ${BRANDING.URLS.SUPPORT}`;
    }
    
    return {
        content: [{
            type: 'text',
            text: responseText
        }],
        isError: true
    };
}

/**
 * Enhances an existing error handler to apply branding to error responses
 * 
 * @param {Function} originalErrorHandler - The original error handler function
 * @returns {Function} - Enhanced error handler with branding
 */
export function enhanceErrorHandlerWithBranding(originalErrorHandler) {
    return (error, args) => {
        const errorResponse = originalErrorHandler(error, args);
        
        // Add branding to error message if it's a valid response
        if (errorResponse && errorResponse.content && errorResponse.content.length > 0) {
            errorResponse.content[0].text = `❌ Error in ${BRANDING.PRODUCT_NAME_SHORT}: ${errorResponse.content[0].text}\n\nNeed help? Visit: ${BRANDING.URLS.SUPPORT}`;
        }
        
        return errorResponse;
    };
}
