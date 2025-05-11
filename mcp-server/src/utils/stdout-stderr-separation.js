/**
 * Simple stdout/stderr separation for MCP server
 * This ensures clean JSON-RPC communication by keeping stdout for JSON only
 */

import { logger } from './logger.js';

/**
 * Patch console methods to redirect all logs to stderr
 */
export function enforceStderrLogging() {
    // Redirect console methods to stderr
    console.log = (...args) => process.stderr.write(`${args.join(' ')}\n`);
    console.info = (...args) => process.stderr.write(`${args.join(' ')}\n`);
    console.warn = (...args) => process.stderr.write(`${args.join(' ')}\n`);
    console.error = (...args) => process.stderr.write(`${args.join(' ')}\n`);
    console.debug = (...args) => process.stderr.write(`${args.join(' ')}\n`);
    
    logger.info('Console methods redirected to stderr');
}

/**
 * Create a simple JSON-RPC writer function
 */
export function createSafeJsonRpcWriter() {
    return function writeJsonRpc(data) {
        try {
            // Convert to JSON string if needed
            const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
            // Write directly to stdout with newline
            process.stdout.write(jsonString + '\n');
        } catch (error) {
            process.stderr.write(`Failed to write JSON-RPC: ${error.message}\n`);
        }
    };
}

/**
 * Simple passthrough for stdout.write
 * No validation or redirection to prevent JSON parsing errors
 */
export function enforceJsonOnlyStdout() {
    // No patching of stdout.write - let it pass through normally
    logger.info('Using direct stdout for JSON communication');
}

export default {
    enforceStderrLogging,
    createSafeJsonRpcWriter,
    enforceJsonOnlyStdout
};
