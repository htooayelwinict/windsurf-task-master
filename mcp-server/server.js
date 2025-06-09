/**
 * Entry point for the Windsurf Task Master MCP Server
 */

import WindsurfTaskMCPServer from './src/index.js';
import { BRANDING, formatBrandedMessage } from './src/constants/branding.js';

// Track if shutdown is in progress
let isShuttingDown = false;

// Add branded startup message
console.error(formatBrandedMessage('Initializing server...', 'primary'));

// Create and start the server
const server = new WindsurfTaskMCPServer();

// Handle stdin end for clean shutdown
process.stdin.on('end', () => {
    if (!isShuttingDown) {
        isShuttingDown = true;
        console.error(formatBrandedMessage('Stdin end detected, shutting down...', 'warning'));
        
        // Stop the server and exit
        server.stop().catch(error => {
            console.error(formatBrandedMessage(`Error stopping server: ${error.message}`, 'error'));
        }).finally(() => {
            process.exit(0);
        });
    }
});

// Start the server
server.start().catch(error => {
    console.error(formatBrandedMessage(`Fatal error: ${error.message}`, 'error'));
    console.error(formatBrandedMessage('Please report this issue at ' + BRANDING.URLS.GITHUB, 'warning'));
    process.exit(1);
});
