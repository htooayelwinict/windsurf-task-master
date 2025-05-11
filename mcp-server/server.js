/**
 * Entry point for the Windsurf Task Master MCP Server
 */

import WindsurfTaskMCPServer from './src/index.js';

// Track if shutdown is in progress
let isShuttingDown = false;

// Create and start the server
const server = new WindsurfTaskMCPServer();

// Handle stdin end for clean shutdown
process.stdin.on('end', () => {
    if (!isShuttingDown) {
        isShuttingDown = true;
        console.error('Stdin end detected, shutting down...');
        
        // Stop the server and exit
        server.stop().catch(error => {
            console.error(`Error stopping server: ${error.message}`);
        }).finally(() => {
            process.exit(0);
        });
    }
});

// Start the server
server.start().catch(error => {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
});
