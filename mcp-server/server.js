#!/usr/bin/env node

import WindsurfTaskMCPServer from './src/index.js';

/**
 * Start the MCP server for Windsurf Task Master
 */
async function startServer() {
    const server = new WindsurfTaskMCPServer();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
    });

    try {
        await server.start();
    } catch (error) {
        console.error(`Failed to start MCP server: ${error.message}`);
        process.exit(1);
    }
}

// Start the server
startServer();
