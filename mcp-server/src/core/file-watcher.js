import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { isValidProjectId, getProjectDirPath, getTasksFilePath } from '../utils/security.js';
import { logger } from '../utils/logger.js';
import { FileSystemError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Watch for task file changes to integrate with Windsurf
 */
export class FileWatcher {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.watchers = new Map(); // Map of project IDs to their watchers
        this.baseTasksDir = path.join(__dirname, '../../../tasks');
    }

    /**
     * Start watching for file changes
     */
    async start() {
        // Start watching the base tasks directory for new project directories
        await fs.mkdir(this.baseTasksDir, { recursive: true });
        
        // Watch for new project directories
        const dirWatcher = chokidar.watch(this.baseTasksDir, {
            persistent: true,
            ignoreInitial: false,
            depth: 1,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });
        
        // When a new directory is added, watch its tasks.json file
        dirWatcher.on('addDir', async (dirPath) => {
            // Skip the base tasks directory itself
            if (dirPath === this.baseTasksDir) return;
            
            const projectId = path.basename(dirPath);
            
            // Validate project ID to prevent path traversal attacks
            if (!isValidProjectId(projectId)) {
                logger.warn('Invalid project ID detected in directory watcher', { projectId });
                return;
            }
            
            // Get sanitized paths
            const projectDir = getProjectDirPath(this.baseTasksDir, projectId);
            if (!projectDir) {
                logger.warn('Invalid project directory path', { projectId });
                return;
            }
            
            const projectTasksPath = getTasksFilePath(projectDir, 'tasks.json');
            
            // Watch this project's tasks.json file
            this.watchTasksFile(projectId, projectTasksPath);
            
            // Add this project to the task manager's projects map
            this.taskManager.projectsMap.set(projectId, projectTasksPath);
            
            console.error(`Watching project directory: ${projectId}`);
        });
        
        // Store the directory watcher
        this.watchers.set('dirWatcher', dirWatcher);
        
        // Check for existing project directories
        try {
            const entries = await fs.readdir(this.baseTasksDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const projectId = entry.name;
                    
                    // Validate project ID to prevent path traversal attacks
                    if (!isValidProjectId(projectId)) {
                        logger.warn('Invalid project ID detected in directory scan', { projectId });
                        continue;
                    }
                    
                    // Get sanitized paths
                    const projectDir = getProjectDirPath(this.baseTasksDir, projectId);
                    if (!projectDir) {
                        logger.warn('Invalid project directory path', { projectId });
                        continue;
                    }
                    
                    const projectTasksPath = getTasksFilePath(projectDir, 'tasks.json');
                    
                    // Watch this project's tasks.json file
                    this.watchTasksFile(projectId, projectTasksPath);
                    
                    // Add this project to the task manager's projects map
                    this.taskManager.projectsMap.set(projectId, projectTasksPath);
                    
                    console.error(`Found existing project directory: ${projectId}`);
                }
            }
        } catch (error) {
            console.error('Error checking for existing project directories:', error);
        }
        
        console.error('File watcher started for Windsurf integration');
    }
    
    /**
     * Watch a specific tasks.json file
     * @param {string} projectId - Project ID for the project-specific tasks file
     * @param {string} tasksPath - Path to the tasks.json file
     */
    watchTasksFile(projectId, tasksPath) {
        // Skip if already watching this file
        if (this.watchers.has(projectId)) return;
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            logger.warn('Invalid project ID detected in watchTasksFile', { projectId });
            return;
        }
        
        // Validate tasks path
        if (!tasksPath || !tasksPath.endsWith('tasks.json')) {
            logger.warn('Invalid tasks path detected', { tasksPath });
            return;
        }
        
        const watcher = chokidar.watch(tasksPath, {
            persistent: true,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });
        
        // Watch for changes to tasks.json
        watcher.on('change', async (path) => {
            console.error(`Tasks file changed for project ${projectId}: ${path}`);
            try {
                await this.taskManager.reloadTasks(projectId);
                
                // Get the tasks for this project to show completion status
                const tasks = await this.taskManager.listTasks(projectId);
                
                // Calculate completion percentage
                const totalTasks = tasks.length;
                const completedTasks = tasks.filter(task => task.status === 'completed').length;
                const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
                
                const completionPercentage = totalTasks > 0 
                    ? Math.round((completedTasks / totalTasks) * 100) 
                    : 0;
                
                console.error(`Project ${projectId} status: ${completedTasks}/${totalTasks} tasks completed (${completionPercentage}%)`);
                console.error(`${inProgressTasks} tasks in progress`);
                
                // Show tasks assigned to Windsurf
                const windsurfTasks = tasks.filter(task => task.assignedTo === 'windsurf');
                if (windsurfTasks.length > 0) {
                    console.error(`${windsurfTasks.length} tasks assigned to Windsurf in project ${projectId}:`);
                    windsurfTasks.forEach(task => {
                        const progressInfo = task.progress !== undefined ? ` - Progress: ${task.progress}%` : '';
                        console.error(`  #${task.id} [${task.status.toUpperCase()}] ${task.title}${progressInfo}`);
                    });
                }
            } catch (error) {
                console.error(`Error reloading tasks for project ${projectId}:`, error);
            }
        });
        
        // Watch for new tasks.json files
        watcher.on('add', async (path) => {
            console.error(`Tasks file added for project ${projectId}: ${path}`);
            try {
                await this.taskManager.reloadTasks(projectId);
            } catch (error) {
                console.error(`Error reloading tasks for project ${projectId}:`, error);
            }
        });
        
        watcher.on('error', (error) => {
            console.error(`Watcher error for project ${projectId}: ${error}`);
        });
        
        // Store the watcher
        this.watchers.set(projectId, watcher);
    }

    /**
     * Stop watching for file changes
     */
    async stop() {
        // Close all watchers
        for (const [projectId, watcher] of this.watchers) {
            await watcher.close();
            console.error(`Stopped watching for project ${projectId}`);
        }
        
        // Clear the watchers map
        this.watchers.clear();
    }
}
