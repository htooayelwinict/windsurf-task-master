/**
 * Debugging patch for stdout to help diagnose JSON parsing errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, '../../debug_logs/stdout_debug.log');

// Ensure log directory exists
const logDir = path.dirname(logPath);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Clear the log file at startup
fs.writeFileSync(logPath, '=== New Session Started ===\n');

/**
 * Patch stdout.write to log all outgoing messages
 */
export function patchStdoutForDebugging() {
    const originalStdoutWrite = process.stdout.write;
    
    process.stdout.write = function(data, ...args) {
        try {
            // Log the raw data to file
            const timestamp = new Date().toISOString();
            const dataStr = data.toString();
            
            // Log every single byte of data being sent
            const logEntry = `[${timestamp}] STDOUT WRITE:\n` +
                           `  Raw: ${JSON.stringify(dataStr)}\n` +
                           `  Length: ${dataStr.length}\n` +
                           `  Hex: ${Buffer.from(dataStr).toString('hex')}\n` +
                           `  Ends with newline: ${dataStr.endsWith('\\n')}\n` +
                           `----------------------------------------\n`;
            
            fs.appendFileSync(logPath, logEntry);
            
            // Also send to stderr for immediate debugging
            console.error(`[DEBUG] Writing to stdout (length ${dataStr.length}): ${JSON.stringify(dataStr.substring(0, 100))}`);
            
        } catch (error) {
            console.error('Error in stdout debug logging:', error);
        }
        
        // Call the original function
        return originalStdoutWrite.apply(this, [data, ...args]);
    };
    
    console.error(`Stdout debugging enabled. Logs will be written to: ${logPath}`);
}

// Export a function to read the debug logs
export function readDebugLogs() {
    try {
        return fs.readFileSync(logPath, 'utf8');
    } catch (error) {
        return `Error reading logs: ${error.message}`;
    }
}
