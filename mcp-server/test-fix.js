#!/usr/bin/env node

/**
 * Test script to help debug JSON parsing errors
 * Simulates the MCP server with enhanced debugging
 */

import WindsurfTaskMCPServer from './src/index-fixed.js';
import { readDebugLogs } from './src/debug-stdout-patch.js';
import fs from 'fs';

let server;

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
            console.error(`\\n--- Testing: ${JSON.stringify(testCase)} ---`);
            
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
}

async function main() {
    try {
        console.error('Starting Windsurf Task Master MCP Server with debugging...');
        console.error('This will help diagnose JSON parsing errors.');
        console.error('');
        
        server = new WindsurfTaskMCPServer();
        
        // Test responses first
        await testJsonResponses();
        
        console.error('\\n=== Debug Log Contents ===');
        console.error(readDebugLogs());
        console.error('\\n=== Starting MCP Server ===');
        
        await server.start();
    } catch (error) {
        console.error(`Error starting test: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.error('Shutting down server...');
    if (server) {
        await server.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.error('Terminating server...');
    if (server) {
        await server.stop();
    }
    process.exit(0);
});

main();
