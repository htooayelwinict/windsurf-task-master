import { FastMCP } from 'fastmcp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { TaskManager } from './core/task-manager.js';
import { registerTaskTools } from './tools/index.js';
import { FileWatcher } from './core/file-watcher.js';
import TaskCleanupService from './core/task-cleanup-service.js';
import { logger } from './utils/logger.js';
import {
    safeParseJson,
    safeStringifyJson,
    createJsonRpcResponse,
    createJsonRpcErrorResponse,
    handleMissingMethod
} from './utils/message-handler.js';
import {
    handleCommunicationError,
    resetErrorCount
} from './utils/error-recovery-fixed.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    enforceStderrLogging,
    createSafeJsonRpcWriter,
    enforceJsonOnlyStdout
} from './utils/stdout-stderr-separation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Message handler for intercepting and processing MCP messages
 */
class MessageHandler {
    constructor() {
        // Ensure all logging goes to stderr from the start
        enforceStderrLogging();
        
        logger.info('Initializing custom message handler for MCP server');
        
        // Set up process error handlers
        this.setupErrorHandlers();
        
        // Create safe JSON-RPC writer
        this.jsonRpcWriter = createSafeJsonRpcWriter();
    }
    
    /**
     * Set up global error handlers for the process
     */
    setupErrorHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error(`Uncaught exception: ${error.message}`);
            console.error(`Uncaught exception: ${error.message}`);
            console.error(error.stack);
            
            // Use error recovery utilities
            handleCommunicationError(error, 0);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error(`Unhandled rejection: ${reason}`);
            console.error(`Unhandled rejection: ${reason}`);
            
            // Use error recovery utilities
            handleCommunicationError(new Error(`Unhandled rejection: ${reason}`), 0);
        });
    }
    
    /**
     * Safely send a message to stdout
     * @param {object} message - The message to send
     */
    sendMessage(message) {
        try {
            // Use the safe JSON-RPC writer
            this.jsonRpcWriter(message);
            
            // Reset error count on successful send
            resetErrorCount();
        } catch (error) {
            logger.error(`Error sending message: ${error.message}`);
            console.error(`Error sending message: ${error.message}`);
            
            // Handle communication error
            const requestId = message.id || 0;
            const errorResponse = handleCommunicationError(error, requestId);
            if (errorResponse) {
                try {
                    this.jsonRpcWriter(JSON.parse(errorResponse));
                } catch (writeError) {
                    logger.error(`Failed to write error response: ${writeError.message}`);
                }
            }
        }
    }
    
    /**
     * Process an incoming message
     * @param {string} message - The raw message string
     * @param {Function} callback - The callback to invoke with the parsed message
     * @returns {boolean} - Whether the message was handled
     */
    processMessage(message, callback) {
        let requestId = 0;
        try {
            // Use safe JSON parsing
            const parsed = safeParseJson(message);
            if (!parsed) {
                logger.error('Failed to parse message');
                return false;
            }
            
            // Store the request ID for error handling
            requestId = parsed.id || 0;
            
            // Handle missing methods
            const missingMethods = [
                'prompts/list',
                'resources/list',
                'resources/templates/list',
                'resources/read',
                'prompts/get'
            ];
            
            if (parsed.method && missingMethods.includes(parsed.method)) {
                logger.info(`Intercepting missing method: ${parsed.method}`);
                const response = handleMissingMethod(parsed.method, parsed.params, parsed.id);
                this.sendMessage(JSON.parse(response));
                
                // Reset error count on successful handling
                resetErrorCount();
                return true;
            }
            
            // Log the method being processed
            if (parsed.method) {
                logger.info(`Processing method: ${parsed.method}`);
            }
            
            // Reset error count on successful parsing
            resetErrorCount();
            
            // Pass the parsed message to the callback
            callback(parsed);
            return true;
        } catch (error) {
            logger.error(`Error processing message: ${error.message}`);
            console.error(`Error processing message: ${error.message}`);
            
            // Use error recovery utilities
            const errorResponse = handleCommunicationError(error, requestId);
            if (errorResponse) {
                try {
                    this.jsonRpcWriter(JSON.parse(errorResponse));
                } catch (sendError) {
                    logger.error(`Failed to send error response: ${sendError.message}`);
                }
            }
            return false;
        }
    }
}

/**
 * Main MCP server class for Windsurf Task Master
 */
class WindsurfTaskMCPServer {
    constructor() {
        try {
            // First, ensure all logging goes to stderr
            enforceStderrLogging();
            
            // Get version from package.json
            const packagePath = path.join(__dirname, '../../package.json');
            const packageContent = fs.readFileSync(packagePath, 'utf8');
            
            // Use safe JSON parsing to handle BOM and other issues
            const packageJson = safeParseJson(packageContent);
            
            this.options = {
                name: 'Windsurf Task Master MCP Server',
                version: packageJson.version
            };
            
            console.error(`Initializing MCP server with version: ${packageJson.version}`);
            logger.info(`Initializing MCP server with version: ${packageJson.version}`);
            
            this.server = new FastMCP(this.options);
            this.initialized = false;
            
            // Initialize core components
            this.taskManager = new TaskManager();
            this.fileWatcher = new FileWatcher(this.taskManager);
            this.taskCleanupService = new TaskCleanupService(this.taskManager);
            
            // Make the cleanup service accessible from the task manager
            this.taskManager.taskCleanupService = this.taskCleanupService;
            
            // Create message handler
            this.messageHandler = new MessageHandler();
            
            // Enforce JSON-only stdout
            enforceJsonOnlyStdout();
        } catch (error) {
            console.error(`Error initializing MCP server: ${error.message}`);
            logger.error('Error initializing MCP server:', error);
            throw error;
        }
    }

    /**
     * Set up message handling for stdin/stdout communication
     */
    setupMessageHandling() {
        // Store the original stdin data event listeners
        const originalStdinListeners = process.stdin.listeners('data');
        
        // Remove all existing data event listeners from stdin
        process.stdin.removeAllListeners('data');
        
        // Add our custom data event listener to stdin
        process.stdin.on('data', (data) => {
            const message = data.toString().trim();
            logger.debug(`Received raw message: ${message.substring(0, 100)}...`);
            
            // Process the message using our message handler
            const handled = this.messageHandler.processMessage(message, (parsedMessage) => {
                // If the message was not handled by our custom handler,
                // pass it to the original listeners
                for (const listener of originalStdinListeners) {
                    try {
                        listener(data);
                    } catch (error) {
                        logger.error(`Error in original stdin listener: ${error.message}`);
                    }
                }
            });
            
            // If the message was handled by our custom handler, don't pass it to the original listeners
            if (handled) {
                logger.debug('Message was handled by custom handler');
            }
        });
        
        // Note: We don't need to monkey-patch stdout.write anymore
        // The enforceJsonOnlyStdout() already handles this
    }

    /**
     * Initialize the MCP server with necessary tools and routes
     * @returns {Promise<WindsurfTaskMCPServer>} - The initialized server instance
     */
    async init() {
        try {
            // Only initialize once
            if (this.initialized) {
                logger.info('MCP server already initialized');
                return this;
            }

            // Register task management tools
            registerTaskTools(this.server, this.taskManager);
            logger.info('Task management tools registered');

            // Register task cleanup service hooks
            this.taskCleanupService.registerHooks();
            logger.info('Task Cleanup Service initialized and hooks registered');

            // Mark as initialized but not yet started
            this.initialized = true;
            logger.info('MCP server initialization completed');
            return this;
        } catch (error) {
            logger.error(`Failed to initialize MCP server: ${error.message}`);
            console.error(`Failed to initialize MCP server: ${error.message}`);
            throw error;
        }
    }

    /**
     * Register all tools with the FastMCP server
     * @returns {Promise<void>}
     */
    async registerTools() {
        try {
            // Register task management tools
            registerTaskTools(this.server, this.taskManager);
            logger.info('Task management tools registered');
        } catch (error) {
            logger.error(`Failed to register tools: ${error.message}`);
            console.error(`Failed to register tools: ${error.message}`);
            throw error;
        }
    }

    /**
     * Start the MCP server
     * @returns {Promise<WindsurfTaskMCPServer>} - The started server instance
     */
    async start() {
        try {
            // Initialize if not already done
            if (!this.initialized) {
                await this.init();
            }
            
            // Start the file watcher if not already started
            if (!this.fileWatcher.isRunning) {
                await this.fileWatcher.start();
                logger.info('File watcher started for Windsurf integration');
            }

            // Set up direct stdin/stdout interception for message handling
            this.setupMessageHandling();
            logger.info('Custom message handling set up');
            
            // Start the FastMCP server with standard stdio transport
            // Use empty options to avoid accessing undefined properties
            await this.server.start({
                transportType: 'stdio',
                options: {}
            });
            
            // Register event handlers
            this.server.on('connect', ({ session }) => {
                logger.info('Client connected to MCP server');
                console.error('Client connected to MCP server');
            });
            
            this.server.on('error', (error) => {
                logger.error(`MCP server error: ${error.message}`);
                console.error(`MCP server error: ${error.message}`);
            });

            logger.info('Windsurf Task Master MCP Server started successfully');
            console.error('Windsurf Task Master MCP Server started successfully');
            return this;
        } catch (error) {
            logger.error(`Failed to start MCP server: ${error.message}`);
            console.error(`Failed to start MCP server: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stop the MCP server
     */
    async stop() {
        if (this.fileWatcher) {
            await this.fileWatcher.stop();
        }
        
        if (this.server) {
            await this.server.stop();
        }
        
        logger.info('Windsurf Task Master MCP Server stopped');
    }
}

export default WindsurfTaskMCPServer;
