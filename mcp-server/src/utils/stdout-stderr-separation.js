/**
 * Critical fix for stdout/stderr separation in MCP server
 * This ensures all logging goes to stderr while keeping stdout clean for JSON-RPC
 */

import { logger } from './logger.js';

/**
 * Patch the console methods to ensure all logs go to stderr
 */
export function enforceStderrLogging() {
    // Store original console methods
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    const originalConsoleDebug = console.debug;
    
    // Redirect all console methods to stderr except when explicitly writing JSON-RPC
    console.log = (...args) => {
        try {
            const message = args.join(' ');
            // Check if this looks like a JSON-RPC message
            if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
                try {
                    JSON.parse(message);
                    // It's valid JSON, let it go to stdout
                    originalConsoleLog.apply(console, args);
                    return;
                } catch (e) {
                    // Not valid JSON, send to stderr
                }
            }
            // Send to stderr instead
            process.stderr.write(`${message}\n`);
        } catch (error) {
            // Fallback to stderr
            process.stderr.write(`${args.join(' ')}\n`);
        }
    };
    
    // Always send these to stderr
    console.info = (...args) => process.stderr.write(`[INFO] ${args.join(' ')}\n`);
    console.warn = (...args) => process.stderr.write(`[WARN] ${args.join(' ')}\n`);
    console.error = (...args) => process.stderr.write(`[ERROR] ${args.join(' ')}\n`);
    console.debug = (...args) => process.stderr.write(`[DEBUG] ${args.join(' ')}\n`);
    
    logger.info('Console methods patched to enforce stderr logging');
}

/**
 * Create a safe JSON-RPC writer function
 */
export function createSafeJsonRpcWriter() {
    return function writeJsonRpc(data) {
        try {
            // If data is a string, check if it's valid JSON
            if (typeof data === 'string') {
                // Try to parse it to ensure it's valid JSON
                try {
                    JSON.parse(data);
                    // It's valid JSON, write directly to stdout
                    process.stdout.write(data + '\n');
                } catch (parseError) {
                    // Not JSON, this is an error - log to stderr and skip stdout
                    process.stderr.write(`[ERROR] Attempted to write non-JSON to stdout: ${data}\n`);
                    throw new Error('Non-JSON data cannot be written to stdout in MCP');
                }
            } else {
                // Convert object to JSON string
                const jsonString = JSON.stringify(data);
                process.stdout.write(jsonString + '\n');
            }
        } catch (error) {
            process.stderr.write(`[ERROR] Failed to write JSON-RPC: ${error.message}\n`);
            throw error;
        }
    };
}

/**
 * Patch process.stdout.write to ensure only JSON is written
 */
export function enforceJsonOnlyStdout() {
    const originalStdoutWrite = process.stdout.write;
    
    process.stdout.write = function(chunk, encoding, callback) {
        try {
            const data = chunk.toString();
            
            // Skip empty data or whitespace
            if (!data.trim()) {
                return originalStdoutWrite.call(this, chunk, encoding, callback);
            }
            
            // Check if this is valid JSON
            try {
                const trimmed = data.trim();
                // Only allow objects or arrays that are valid JSON
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                    (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    JSON.parse(trimmed);
                    // It's valid JSON, allow it through
                    return originalStdoutWrite.call(this, chunk, encoding, callback);
                } else {
                    throw new Error('Not a JSON object or array');
                }
            } catch (parseError) {
                // Not valid JSON - this should not go to stdout
                process.stderr.write(`[ERROR] Blocked non-JSON from stdout: ${data.substring(0, 100)}...\n`);
                process.stderr.write(`[ERROR] This should be sent to stderr instead\n`);
                
                // Redirect to stderr instead
                process.stderr.write(data);
                
                // Call the callback with success to prevent errors
                if (typeof encoding === 'function') {
                    // encoding is actually the callback in this case
                    encoding(null);
                } else if (callback) {
                    callback(null);
                }
                
                // Don't write anything to stdout
                return true;
            }
        } catch (error) {
            process.stderr.write(`[ERROR] Error in stdout write enforcement: ${error.message}\n`);
            // Redirect to stderr instead of stdout
            process.stderr.write(chunk.toString());
            
            // Call the callback with success
            if (typeof encoding === 'function') {
                encoding(null);
            } else if (callback) {
                callback(null);
            }
            
            return true;
        }
    };
    
    logger.info('stdout.write patched to enforce JSON-only output');
}

export default {
    enforceStderrLogging,
    createSafeJsonRpcWriter,
    enforceJsonOnlyStdout
};
