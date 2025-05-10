import { FastMCP } from 'fastmcp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { TaskManager } from './core/task-manager.js';
import { registerTaskTools } from './tools/index.js';
import { FileWatcher } from './core/file-watcher.js';
import TaskCleanupService from './core/task-cleanup-service.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main MCP server class for Windsurf Task Master
 */
class WindsurfTaskMCPServer {
    constructor() {
        // Get version from package.json
        const packagePath = path.join(__dirname, '../../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

        this.options = {
            name: 'Windsurf Task Master MCP Server',
            version: packageJson.version
        };

        this.server = new FastMCP(this.options);
        this.initialized = false;
        
        // Initialize core components
        this.taskManager = new TaskManager();
        this.fileWatcher = new FileWatcher(this.taskManager);
        this.taskCleanupService = new TaskCleanupService(this.taskManager);
        
        // Make the cleanup service accessible from the task manager
        this.taskManager.taskCleanupService = this.taskCleanupService;
    }

    /**
     * Initialize the MCP server with necessary tools and routes
     */
    async init() {
        if (this.initialized) return;

        // Register task management tools
        registerTaskTools(this.server, this.taskManager);

        // Start file watcher for Windsurf integration
        await this.fileWatcher.start();
        
        // Register task cleanup service hooks
        this.taskCleanupService.registerHooks();
        logger.info('Task Cleanup Service initialized and hooks registered');

        this.initialized = true;
        return this;
    }

    /**
     * Start the MCP server
     */
    async start() {
        if (!this.initialized) {
            await this.init();
        }

        // Start the FastMCP server with stdio transport
        await this.server.start({
            transportType: 'stdio'
        });

        console.error('Windsurf Task Master MCP Server started successfully');
        return this;
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
