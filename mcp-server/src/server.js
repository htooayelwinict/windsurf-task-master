/**
 * Entry point for the Windsurf Task Master MCP Server
 * Includes direct stdin end detection for clean shutdown
 */

import WindsurfTaskMCPServer from './index.js';
import { logger } from './utils/logger.js';

// Track if shutdown is in progress
let isShuttingDown = false;

// Declare variables for intervals
let parentProcessInterval;
let stdinHeartbeatInterval;

// Create server instance
const server = new WindsurfTaskMCPServer();

// Immediately set up stdin end detection before anything else
setupStdinEndDetection();

/**
 * Set up stdin end detection with immediate forced exit
 */
function setupStdinEndDetection() {
    // Direct stdin end handler - most important event
    process.stdin.on('end', () => {
        handleShutdown('stdin-end');
    });
    
    // Also handle stdin close event
    process.stdin.on('close', () => {
        handleShutdown('stdin-close');
    });
    
    // Handle error events
    process.stdin.on('error', (error) => {
        logger.error(`Stdin error: ${error.message}`);
        handleShutdown('stdin-error');
    });
    
    // Set up parent process monitoring
    setupParentProcessMonitoring();
    
    // Handle process signals
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    
    logger.info('Stdin end detection set up');
}

/**
 * Handle shutdown from any trigger
 */
function handleShutdown(trigger) {
    if (isShuttingDown) {
        logger.info(`Shutdown already in progress, ignoring ${trigger}`);
        return;
    }
    
    isShuttingDown = true;
    logger.info(`Client disconnected (${trigger}), shutting down...`);
    
    // Clear all intervals immediately
    clearAllIntervals();
    
    // Clean up stdin
    cleanupStdin();
    
    try {
        // Stop the server
        server.stop().catch(error => {
            logger.error(`Error stopping server: ${error.message}`);
        }).finally(() => {
            // Force immediate exit
            forceExit();
        });
    } catch (error) {
        logger.error(`Error during shutdown: ${error.message}`);
        forceExit();
    }
}

/**
 * Force process exit with minimal delay
 */
function forceExit() {
    // Clean up any remaining resources
    cleanupResources();
    
    // Force exit immediately
    logger.info('Forcing process exit');
    process.exit(0);
}

/**
 * Clean up all resources before exit
 */
function cleanupResources() {
    try {
        // Clean up active handles
        const activeHandles = process._getActiveHandles();
        logger.info(`Active handles: ${activeHandles.length}`);
        
        activeHandles.forEach((handle, index) => {
            logger.info(`Handle ${index}: ${handle.constructor.name}`);
            if (typeof handle.destroy === 'function') {
                handle.destroy();
                logger.info(`Destroyed ${handle.constructor.name} handle`);
            }
        });
        
        // Log active requests
        const activeRequests = process._getActiveRequests();
        logger.info(`${activeRequests.length > 0 ? `Active requests: ${activeRequests.length}` : 'No active requests'}`);
        
        logger.info('Server stopped successfully');
    } catch (error) {
        logger.error(`Error cleaning up resources: ${error.message}`);
    }
}

/**
 * Clear all intervals in the process
 */
function clearAllIntervals() {
    try {
        // Clear parent process monitor
        if (parentProcessInterval) {
            clearInterval(parentProcessInterval);
            logger.info('Cleared parent process monitor interval');
        }
        
        // Clear stdin heartbeat
        if (stdinHeartbeatInterval) {
            clearInterval(stdinHeartbeatInterval);
            logger.info('Cleared stdin heartbeat interval');
        }
        
        // Clear all other intervals
        const dummyInterval = setInterval(() => {}, 100000);
        for (let i = 1; i < dummyInterval; i++) {
            clearInterval(i);
        }
        clearInterval(dummyInterval);
        
        logger.info('Cleared all timers and intervals');
    } catch (error) {
        logger.error(`Error clearing intervals: ${error.message}`);
    }
}

/**
 * Clean up stdin
 */
function cleanupStdin() {
    try {
        // Log stdin state
        const stdinState = {
            readable: process.stdin.readable,
            destroyed: process.stdin.destroyed,
            isPaused: process.stdin.isPaused()
        };
        logger.info(`Stdin state: ${JSON.stringify(stdinState)}`);
        
        // Unref stdin
        process.stdin.unref();
        logger.info('Stdin unreferenced');
        
        // Remove all listeners
        process.stdin.removeAllListeners('data');
        process.stdin.removeAllListeners('end');
        process.stdin.removeAllListeners('close');
        process.stdin.removeAllListeners('error');
        logger.info('Stdin listeners removed');
        
        // Destroy stdin
        if (!process.stdin.destroyed) {
            process.stdin.destroy();
            logger.info('Stdin destroyed');
        }
    } catch (error) {
        logger.error(`Error cleaning up stdin: ${error.message}`);
    }
}

/**
 * Set up parent process monitoring
 */
function setupParentProcessMonitoring() {
    const parentPid = process.ppid;
    parentProcessInterval = setInterval(() => {
        try {
            // Check if parent process is still running
            process.kill(parentPid, 0);
        } catch (error) {
            // Parent process is gone, shut down
            logger.info('Parent process no longer running, shutting down...');
            handleShutdown('parent-process-gone');
        }
    }, 1000);
}

// Setup heartbeat to check stdin
stdinHeartbeatInterval = setInterval(() => {
    if (!process.stdin.readable || process.stdin.destroyed) {
        logger.info('Stdin no longer readable, shutting down...');
        handleShutdown('stdin-not-readable');
    }
}, 1000);

// Start the server
server.start().catch(error => {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
});
