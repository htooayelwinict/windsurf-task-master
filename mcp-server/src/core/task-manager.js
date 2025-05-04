import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
    TaskNotFoundError,
    ProjectNotFoundError,
    FileSystemError,
    TaskStateError,
    TaskValidationError,
    logError
} from '../utils/errors.js';
import { taskCache } from '../utils/cache.js';
import { debouncer } from '../utils/debounce.js';
import { logger } from '../utils/logger.js';
import { 
    isValidProjectId, 
    isValidTaskId, 
    getProjectDirPath, 
    getTasksFilePath 
} from '../utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Core task management functionality for the Windsurf Task Master system.
 * 
 * The TaskManager is responsible for managing tasks across different projects,
 * providing methods for creating, updating, and retrieving tasks. It implements
 * performance optimizations including caching, debouncing, and task indexing.
 * 
 * @class
 * @example
 * const taskManager = new TaskManager();
 * await taskManager.init('my-project');
 * const task = await taskManager.createTask({
 *   title: 'Implement feature',
 *   description: 'Add new functionality'
 * }, 'my-project');
 */
export class TaskManager {
    constructor() {
        this.baseTasksDir = path.join(__dirname, '../../../tasks');
        this.projectsMap = new Map(); // Map project IDs to their task files
        this.projectTasks = new Map(); // Store tasks for each project
        this.initialized = false;
        this.windsurfTasks = new Map(); // Track tasks assigned to Windsurf
        this.currentProject = null; // Current active project
        
        // Task indices for faster lookups
        this.taskIndices = new Map(); // Map of project IDs to task indices
        
        // Save debounce delay
        this.saveDelay = 1000; // 1 second delay for debounced saves
    }

    /**
     * Initialize the task manager by loading existing tasks for a specific project.
     * This method ensures the project directory exists, loads tasks from the file system,
     * and builds indices for efficient task lookup. It also implements caching to avoid
     * unnecessary file system reads.
     * 
     * @param {string} projectId - Required project ID to load tasks for a specific project
     * @throws {ProjectNotFoundError} If project ID is not provided or invalid
     * @throws {FileSystemError} If there's an error accessing the file system
     * @returns {Promise<void>}
     */
    async init(projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to initialize task manager');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }

        try {
            // Check cache first
            const cachedTasks = taskCache.get(`tasks_${projectId}`);
            if (cachedTasks) {
                logger.debug('Using cached tasks', { projectId });
                this.projectTasks.set(projectId, cachedTasks);
                return;
            }

            // Ensure the base tasks directory exists
            await fs.mkdir(this.baseTasksDir, { recursive: true });
            
            // Set as the current project
            this.currentProject = projectId;
            
            // Get sanitized paths to prevent path traversal attacks
            const projectDir = getProjectDirPath(this.baseTasksDir, projectId);
            if (!projectDir) {
                throw new FileSystemError(
                    `Invalid project directory path for project ${projectId}`,
                    'init',
                    this.baseTasksDir
                );
            }
            
            const projectTasksPath = getTasksFilePath(projectDir, 'tasks.json');
            
            // Ensure the project directory exists
            await fs.mkdir(projectDir, { recursive: true });
            
            // Map the project ID to its tasks file path
            this.projectsMap.set(projectId, projectTasksPath);
            
            // Check if we've already loaded tasks for this project
            if (this.projectTasks.has(projectId)) {
                return;
            }
            
            // Try to load existing tasks for this project
            try {
                const data = await fs.readFile(projectTasksPath, 'utf-8');
                const tasks = JSON.parse(data);
                this.projectTasks.set(projectId, tasks);
                
                // Cache the tasks
                taskCache.set(`tasks_${projectId}`, tasks);
                
                // Build indices
                this.buildTaskIndices(projectId);
            } catch (error) {
                // If file doesn't exist, create it with empty tasks
                this.projectTasks.set(projectId, []);
                await this.saveTasks(projectId);
            }

            this.initialized = true;
        } catch (error) {
            const fsError = new FileSystemError(
                `Failed to initialize TaskManager for project ${projectId}`,
                'init',
                this.baseTasksDir,
                error
            );
            logError(fsError);
            throw fsError;
        }
    }

    /**
     * Save tasks to file for a specific project.
     * This method implements debouncing to optimize file system writes by
     * grouping multiple write operations within a short time window.
     * 
     * @param {string} projectId - Required project ID to save tasks for a specific project
     * @throws {ProjectNotFoundError} If project ID is not provided
     * @throws {FileSystemError} If there's an error writing to the file system
     * @returns {Promise<void>}
     */
    async saveTasks(projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to save tasks');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }
        
        try {
            let tasksPath = this.projectsMap.get(projectId);
            
            // If path not found, create it
            if (!tasksPath) {
                // Get sanitized paths to prevent path traversal attacks
                const projectDir = getProjectDirPath(this.baseTasksDir, projectId);
                if (!projectDir) {
                    throw new FileSystemError(
                        `Invalid project directory path for project ${projectId}`,
                        'saveTasks',
                        this.baseTasksDir
                    );
                }
                
                tasksPath = getTasksFilePath(projectDir, 'tasks.json');
                if (!tasksPath) {
                    throw new FileSystemError(
                        `Invalid tasks file path for project ${projectId}`,
                        'saveTasks',
                        projectDir
                    );
                }
                
                // Ensure the project directory exists
                await fs.mkdir(projectDir, { recursive: true });
                
                // Map the project ID to its tasks file path
                this.projectsMap.set(projectId, tasksPath);
            }
            
            // Get the tasks for this project
            const tasks = this.projectTasks.get(projectId) || [];
            
            // Update cache
            taskCache.set(`tasks_${projectId}`, tasks);
            
            // Debounce the save operation
            await debouncer.debounce(
                `save_${projectId}`,
                async () => {
                    await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2));
                    logger.debug(`Saved tasks for project ${projectId}`, { 
                        path: tasksPath,
                        taskCount: tasks.length 
                    });
                },
                this.saveDelay
            );
        } catch (error) {
            const fsError = new FileSystemError(
                `Failed to save tasks for project ${projectId}`,
                'save',
                tasksPath,
                error
            );
            logError(fsError);
            throw fsError;
        }
    }

    /**
     * Create a new task
     * @param {Object} taskData - Task data
     * @param {string} projectId - Required project ID to create the task for a specific project
     */
    async createTask(taskData, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to create a task');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const tasks = this.projectTasks.get(projectId) || [];
        
        // Create new task
        const newTask = {
            ...taskData,
            id: tasks.length + 1,
            status: taskData.status || 'pending',
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dependencies: taskData.dependencies || [],
            priority: taskData.priority || 'medium',
            projectId
        };
        
        // Add to tasks list
        tasks.push(newTask);
        this.projectTasks.set(projectId, tasks);
        
        // Save tasks
        await this.saveTasks(projectId);
        
        return newTask;
    }

    /**
     * List all tasks
     * @param {string} projectId - Required project ID to list tasks for a specific project
     */
    async listTasks(projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to list tasks');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Return the tasks for this project
        return this.projectTasks.get(projectId) || [];
    }

    /**
     * Update a task
     * @param {number} id - Task ID
     * @param {Object} updates - Task updates
     * @param {string} projectId - Required project ID to update a task for a specific project
     * @throws {ProjectNotFoundError} If project ID is not provided or invalid
     * @throws {TaskNotFoundError} If task is not found
     * @throws {TaskValidationError} If updates are invalid
     * @returns {Promise<Object>} The updated task
     */
    async updateTask(id, updates, projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to update a task');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }
        
        // Validate task ID
        if (!isValidTaskId(id)) {
            throw new TaskValidationError(`Invalid task ID: ${id}`, {
                field: 'id',
                value: id
            });
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const projectTasks = this.projectTasks.get(projectId) || [];
        
        // Find the task to update
        const taskIndex = projectTasks.findIndex(task => task.id === id);
        if (taskIndex === -1) {
            throw new Error(`Task with id ${id} not found in project ${projectId}`);
        }

        // Update the task
        projectTasks[taskIndex] = {
            ...projectTasks[taskIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        // Update the project tasks
        this.projectTasks.set(projectId, projectTasks);

        // Save the tasks to the project-specific file
        await this.saveTasks(projectId);
        
        return projectTasks[taskIndex];
    }

    /**
     * Complete a task
     * @param {number} id - Task ID
     * @param {string} projectId - Required project ID to complete a task for a specific project
     */
    async completeTask(id, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to complete a task');
        }
        
        return this.updateTask(id, { 
            status: 'completed', 
            completedAt: new Date().toISOString(),
            progress: 100 // Ensure progress is set to 100% when completed
        }, projectId);
    }

    /**
     * Get tasks filtered by status for a specific project.
     * This method uses the status index for efficient filtering when available,
     * falling back to array filtering when necessary.
     * 
     * @param {string} status - Task status (e.g., 'pending', 'in-progress', 'completed')
     * @param {string} projectId - Required project ID to get tasks from a specific project
     * @throws {Error} If project ID is not provided
     * @returns {Promise<Array<Object>>} Array of tasks with the specified status
     */
    async getTasksByStatus(status, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to get tasks by status');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Check indices first
        const indices = this.taskIndices.get(projectId);
        if (indices?.byStatus.has(status)) {
            const taskIds = indices.byStatus.get(status);
            return Array.from(taskIds).map(id => indices.byId.get(id));
        }
        
        // Fallback to filter
        const tasks = this.projectTasks.get(projectId) || [];
        return tasks.filter(task => task.status === status);
    }
    
    /**
     * Get a task by ID
     * @param {number} id - Task ID
     * @param {string} projectId - Required project ID to get a task from a specific project
     * @throws {ProjectNotFoundError} If project ID is not provided or invalid
     * @throws {TaskNotFoundError} If task is not found
     * @returns {Promise<Object>} - The task with the specified ID
     */
    async getTask(id, projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to get a task');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }
        
        // Validate task ID
        if (!isValidTaskId(id)) {
            throw new TaskValidationError(`Invalid task ID: ${id}`, {
                field: 'id',
                value: id
            });
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Check indices first for efficient lookup
        const indices = this.taskIndices.get(projectId);
        if (indices?.byId.has(id)) {
            return indices.byId.get(id);
        }
        
        // Fallback to find in array
        const tasks = this.projectTasks.get(projectId) || [];
        const task = tasks.find(task => task.id === id);
        
        // If task not found, throw an error
        if (!task) {
            throw new TaskNotFoundError(`Task with ID ${id} not found in project ${projectId}`);
        }
        
        return task;
    }

    /**
     * Reload tasks from file (for external updates)
     * @param {string} projectId - Required project ID to reload tasks for a specific project
     */
    async reloadTasks(projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to reload tasks');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }
        
        try {
            // Get the project-specific tasks file path
            let tasksPath = this.projectsMap.get(projectId);
            if (!tasksPath) {
                // If the project ID is not in the map, create a new project directory and tasks file
                const projectDir = path.join(this.baseTasksDir, projectId);
                tasksPath = path.join(projectDir, 'tasks.json');
                
                // Ensure the project directory exists
                await fs.mkdir(projectDir, { recursive: true });
                
                // Map the project ID to its tasks file path
                this.projectsMap.set(projectId, tasksPath);
            }
            
            try {
                const data = await fs.readFile(tasksPath, 'utf-8');
                const tasks = JSON.parse(data);
                this.projectTasks.set(projectId, tasks);
                console.error(`Reloaded tasks for project ${projectId} from ${tasksPath}`);
                return true;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // If file doesn't exist, create it with empty tasks
                    this.projectTasks.set(projectId, []);
                    await this.saveTasks(projectId);
                    return true;
                }
                throw error;
            }
        } catch (error) {
            console.error(`Failed to reload tasks for project ${projectId}:`, error);
            return false;
        }
    }

    /**
     * Assign a task to Windsurf
     * @param {number} id - Task ID
     * @param {string} projectId - Required project ID to assign a task from a specific project
     */
    async assignToWindsurf(id, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to assign a task to Windsurf');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the task
        const task = await this.getTask(id, projectId);
        if (!task) {
            throw new TaskNotFoundError(id, projectId);
        }
        
        // Update the task
        const updatedTask = await this.updateTask(id, { 
            status: 'in-progress', 
            assignedTo: 'windsurf',
            assignedAt: new Date().toISOString(),
            progress: 0 // Initialize progress to 0%
        }, projectId);
        
        // Store the task with its project ID for tracking
        const taskKey = `${projectId}_${id}`;
        this.windsurfTasks.set(taskKey, {
            ...updatedTask,
            projectId
        });
        
        console.error(`Assigned task #${id} to Windsurf in project ${projectId}`);
        return updatedTask;
    }

    /**
     * Get all tasks assigned to Windsurf across all projects or from a specific project.
     * This method uses the assignee index for efficient filtering when available,
     * falling back to array filtering when necessary.
     * 
     * @param {string} projectId - Optional project ID to get tasks from a specific project
     * @returns {Promise<Array<Object>>} Array of tasks assigned to Windsurf
     */
    async getWindsurfTasks(projectId = null) {
        // If a specific project is requested, get tasks only from that project
        if (projectId) {
            await this.init(projectId);
            
            // Check indices first
            const indices = this.taskIndices.get(projectId);
            if (indices?.byAssignee.has('windsurf')) {
                const taskIds = indices.byAssignee.get('windsurf');
                return Array.from(taskIds).map(id => indices.byId.get(id));
            }
            
            // Fallback to filter
            const projectTasks = this.projectTasks.get(projectId) || [];
            return projectTasks.filter(task => task.assignedTo === 'windsurf');
        }
        
        // If no specific project is requested, collect Windsurf tasks from all projects
        const allWindsurfTasks = [];
        
        // Check each project in the map
        for (const [pid, _] of this.projectsMap) {
            try {
                await this.init(pid);
                
                // Check indices first
                const indices = this.taskIndices.get(pid);
                if (indices?.byAssignee.has('windsurf')) {
                    const taskIds = indices.byAssignee.get('windsurf');
                    const tasks = Array.from(taskIds)
                        .map(id => ({ ...indices.byId.get(id), projectId: pid }));
                    allWindsurfTasks.push(...tasks);
                    continue;
                }
                
                // Fallback to filter
                const projectTasks = this.projectTasks.get(pid) || [];
                const windsurfTasks = projectTasks
                    .filter(task => task.assignedTo === 'windsurf')
                    .map(task => ({ ...task, projectId: pid }));
                allWindsurfTasks.push(...windsurfTasks);
            } catch (error) {
                logger.error(`Error getting Windsurf tasks for project ${pid}`, { error });
            }
        }
        
        return allWindsurfTasks;
    }

    /**
     * Update task progress from Windsurf
     * @param {number} id - Task ID
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} projectId - Required project ID to update a task from a specific project
     */
    async updateWindsurfTaskProgress(id, progress, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to update task progress');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const tasks = this.projectTasks.get(projectId) || [];
        const taskIndex = tasks.findIndex(t => t.id === id);
        
        if (taskIndex === -1) {
            throw new TaskNotFoundError(id, projectId);
        }
        
        const task = tasks[taskIndex];
        
        if (task.assignedTo !== 'windsurf') {
            throw new TaskStateError(
                `Task with id ${id} in project ${projectId} is not assigned to Windsurf`,
                id,
                task.status,
                'update_progress'
            );
        }
        
        // If progress is 100%, mark as completed
        if (progress === 100) {
            task.status = 'completed';
            task.progress = progress;
            task.updatedAt = new Date().toISOString();
        } else {
            task.progress = progress;
            task.updatedAt = new Date().toISOString();
        }
        
        // Update task in the list
        tasks[taskIndex] = task;
        this.projectTasks.set(projectId, tasks);
        
        // Save tasks
        await this.saveTasks(projectId);
        
        return task;
    }
}
