# Windsurf AI Prompt: Fix JSON Parsing Error in MCP Server

## Problem Description

I'm getting this error when the MCP server communicates with Claude Desktop:

```
[error] Unexpected non-whitespace character after JSON at position 4 (line 1 column 5) {"context":"connection","stack":"SyntaxError: Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)\n at JSON.parse (<anonymous>)
```

This error occurs when the MCP server sends JSON responses that have unexpected characters appended after valid JSON, typically affecting simple primitive values like `null`, `true`, `false`, or numbers.

## Analysis

The issue is in how the `stdout.write` method is being intercepted in `/mcp-server/src/index.js`. The current implementation only properly handles JSON objects (starting with `{` and ending with `}`), but fails to handle JSON primitives correctly. When the server sends simple values, something appends extra characters (like semicolons or quotes), causing the parsing error at position 4 (the 5th character).

## Required Fix

Please update the MCP server code to:

1. **Properly handle all JSON types**: Update the `stdout.write` interceptor to correctly detect and handle JSON primitives (null, booleans, numbers, strings) in addition to objects and arrays.

2. **Ensure clean JSON output**: Make sure no extra characters are appended to JSON responses.

3. **Add comprehensive logging**: Include detailed logging of all stdout traffic to help debug future issues.

4. **Implement consistent newline handling**: Ensure every JSON message ends with exactly one newline character.

## Files to Update

### 1. `/mcp-server/src/index.js`

Update the `setupMessageHandling` function to properly handle all JSON types:

```javascript
setupMessageHandling() {
    // ... existing stdin handling code ...
    
    // Monkey patch the stdout.write method to intercept outgoing messages
    const originalStdoutWrite = process.stdout.write;
    process.stdout.write = function(data, ...args) {
        try {
            const dataStr = data.toString();
            console.error(`[STDOUT-INTERCEPT] Raw data being written: ${JSON.stringify(dataStr)}`);
            
            // Check if it's valid JSON (could be object, array, string, number, boolean, or null)
            let isValidJson = false;
            let parsedJson = null;
            
            try {
                parsedJson = JSON.parse(dataStr.trim());
                isValidJson = true;
            } catch (e) {
                // Not valid JSON, might be part of a larger message
                console.error(`[STDOUT-INTERCEPT] Not valid JSON: ${e.message}`);
            }
            
            if (isValidJson && parsedJson !== undefined) {
                // It's valid JSON, ensure proper formatting
                const safeMessage = safeStringifyJson(parsedJson);
                const messageToWrite = safeMessage.endsWith('\n') ? safeMessage : safeMessage + '\n';
                console.error(`[STDOUT-INTERCEPT] Writing formatted JSON: ${JSON.stringify(messageToWrite)}`);
                return originalStdoutWrite.call(this, messageToWrite, ...args);
            } else {
                // Not JSON or failed to parse, pass through as-is
                console.error(`[STDOUT-INTERCEPT] Passing through non-JSON data`);
                return originalStdoutWrite.call(this, data, ...args);
            }
        } catch (error) {
            console.error(`[STDOUT-INTERCEPT] Error: ${error.message}`);
            return originalStdoutWrite.call(this, data, ...args);
        }
    };
}
```

### 2. Create Debug Logging Module

Create `/mcp-server/src/debug-stdout-patch.js` to log all stdout traffic:

```javascript
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
                           `  Ends with newline: ${dataStr.endsWith('\n')}\n` +
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
```

### 3. Update Constructor to Enable Debugging

Add this to the `WindsurfTaskMCPServer` constructor:

```javascript
// Enable debugging
import { patchStdoutForDebugging } from './debug-stdout-patch.js';

// In constructor after creating message handler:
patchStdoutForDebugging();
```

### 4. Create Test Script

Create `/mcp-server/test-json-parsing.js` to verify the fix:

```javascript
#!/usr/bin/env node

import WindsurfTaskMCPServer from './src/index.js';

async function testJsonPrimitives() {
    console.error('=== Testing JSON Primitives ===');
    
    const testCases = [
        null,
        true,
        false,
        42,
        "test string",
        { test: "object" },
        [1, 2, 3],
        "",
        0
    ];
    
    for (const testCase of testCases) {
        try {
            console.error(`\n--- Testing: ${JSON.stringify(testCase)} ---`);
            
            const testMessage = {
                jsonrpc: "2.0",
                id: 1,
                result: testCase
            };
            
            const jsonString = JSON.stringify(testMessage);
            console.log(jsonString);  // This goes to stdout
            
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error testing ${JSON.stringify(testCase)}: ${error.message}`);
        }
    }
}

async function main() {
    try {
        await testJsonPrimitives();
        
        const server = new WindsurfTaskMCPServer();
        await server.start();
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

main();
```

## Implementation Steps

1. Apply the above changes to your MCP server code
2. Run the test script to verify the fix works
3. Check the debug logs in `/debug_logs/stdout_debug.log` for any issues
4. Restart Claude Desktop and test the connection

## Testing the Fix

After implementing these changes:

1. The debug logs will show exactly what's being sent to stdout
2. The fixed stdout handler will properly format all JSON types
3. No extra characters should be appended to JSON responses
4. The error "Unexpected non-whitespace character after JSON at position 4" should be resolved

## Additional Considerations

- Make sure all debug logs use `console.error()` instead of `console.log()` to avoid mixing with stdout
- Consider temporarily enabling detailed logging to catch any remaining issues
- The fix can be applied gradually with extensive testing to ensure stability
