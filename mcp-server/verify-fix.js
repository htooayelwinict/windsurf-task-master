#!/usr/bin/env node

/**
 * Verification script for MCP server fixes
 * Tests the stdout/stderr separation and error recovery mechanisms
 */

import WindsurfTaskMCPServer from './src/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create debug logs directory if it doesn't exist
const debugLogsDir = path.join(__dirname, '..', 'debug_logs');
if (!fs.existsSync(debugLogsDir)) {
    fs.mkdirSync(debugLogsDir, { recursive: true });
}

// Set up log files
const stderrLogFile = path.join(debugLogsDir, 'verify_stderr.log');
const stdoutLogFile = path.join(debugLogsDir, 'verify_stdout.log');

// Clear previous log files
fs.writeFileSync(stderrLogFile, '=== MCP Server Verification Test ===\n');
fs.writeFileSync(stdoutLogFile, '');

// Capture original stdout and stderr
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;

// Set up log file streams
const stderrStream = fs.createWriteStream(stderrLogFile, { flags: 'a' });
const stdoutStream = fs.createWriteStream(stdoutLogFile, { flags: 'a' });

// Intercept stdout and stderr for logging
process.stdout.write = function(chunk, encoding, callback) {
    // Write to original stdout
    originalStdout.apply(process.stdout, arguments);
    
    // Also log to file
    stdoutStream.write(`[${new Date().toISOString()}] STDOUT: ${chunk}`);
    
    // Check if it's valid JSON
    try {
        const data = chunk.toString().trim();
        if (data && (data.startsWith('{') || data.startsWith('['))) {
            JSON.parse(data);
            stderrStream.write(`[${new Date().toISOString()}] VALID JSON detected in stdout\n`);
        }
    } catch (e) {
        stderrStream.write(`[${new Date().toISOString()}] INVALID JSON detected in stdout: ${e.message}\n`);
    }
};

process.stderr.write = function(chunk, encoding, callback) {
    // Write to original stderr
    originalStderr.apply(process.stderr, arguments);
    
    // Also log to file
    stderrStream.write(`[${new Date().toISOString()}] STDERR: ${chunk}`);
};

// Test function to simulate different JSON responses
async function testJsonResponses() {
    console.error('=== Testing JSON Responses ===');
    
    // Test various JSON primitives that might cause issues
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
            
            // Simulate sending this as a response
            const testMessage = {
                jsonrpc: "2.0",
                id: 1,
                result: testCase
            };
            
            // Write to stdout like the MCP server would
            const jsonString = JSON.stringify(testMessage);
            console.log(jsonString);  // This goes to stdout
            
            // Add a small delay to see each message clearly
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error testing ${JSON.stringify(testCase)}: ${error.message}`);
        }
    }
    
    // Test invalid outputs that should be blocked
    console.error('\n=== Testing Invalid Outputs ===');
    
    const invalidOutputs = [
        "This is not JSON",
        "{ invalid: json }",
        "2025-05-10T19:40:33.720Z [WARN] Approaching error threshold (1210037/5)",
        "null", // This should be blocked as it's not an object or array
        "true", // This should be blocked as it's not an object or array
        "42"    // This should be blocked as it's not an object or array
    ];
    
    for (const invalid of invalidOutputs) {
        console.error(`\n--- Testing invalid output: ${invalid} ---`);
        console.log(invalid);  // This should be redirected to stderr
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

// Test error recovery mechanism
async function testErrorRecovery() {
    console.error('\n=== Testing Error Recovery ===');
    
    // Import the error recovery functions
    const { handleCommunicationError, resetErrorCount, getErrorCount } = await import('./src/utils/error-recovery.js');
    
    // Generate a series of errors to test the error count mechanism
    for (let i = 0; i < 10; i++) {
        const error = new Error(`Test error ${i}`);
        handleCommunicationError(error, i);
        console.error(`Current error count: ${getErrorCount()}`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Reset the error count
    console.error('\n--- Testing Error Count Reset ---');
    resetErrorCount();
    console.error(`Error count after reset: ${getErrorCount()}`);
    
    // Test error pattern detection
    console.error('\n--- Testing Error Pattern Detection ---');
    for (let i = 0; i < 15; i++) {
        const error = new Error('Repeated error pattern');
        handleCommunicationError(error, 100 + i);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Reset again
    resetErrorCount();
}

let server;

async function main() {
    try {
        console.error('Starting MCP Server verification test');
        
        // Test JSON responses and error recovery first
        await testJsonResponses();
        await testErrorRecovery();
        
        console.error('\n=== Starting MCP Server ===');
        
        // Start the server
        server = new WindsurfTaskMCPServer();
        await server.start();
        
        // Keep the server running for a short time to test
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Stop the server
        console.error('\n=== Stopping MCP Server ===');
        await server.stop();
        
        // Print verification results
        console.error('\n=== Verification Complete ===');
        console.error(`Stdout log: ${stdoutLogFile}`);
        console.error(`Stderr log: ${stderrLogFile}`);
        
        process.exit(0);
    } catch (error) {
        console.error(`Error during verification: ${error.message}`);
        console.error(error.stack);
        
        if (server) {
            try {
                await server.stop();
            } catch (stopError) {
                console.error(`Error stopping server: ${stopError.message}`);
            }
        }
        
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.error('Shutting down verification test...');
    if (server) {
        await server.stop();
    }
    process.exit(0);
});

main();
