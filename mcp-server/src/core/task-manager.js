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
import TaskCleanupService from './task-cleanup-service.js';
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
        
        // Initialize the TaskCleanupService
        this.taskCleanupService = new TaskCleanupService(this);
        this.taskCleanupService.registerHooks();
        
        // Task indices for faster lookups
        this.taskIndices = new Map(); // Map of project IDs to task indices
        
        // Save debounce delay
        this.saveDelay = 1000; // 1 second delay for debounced saves
        
        // Subtask tracking
        this.subtaskParentMap = new Map(); // Map subtask IDs to parent task IDs
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
     * @param {number} parentTaskId - Optional parent task ID for subtasks
     */
    async createTask(taskData, projectId, parentTaskId = null) {
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
            projectId,
            subtasks: [],
            isSubtask: parentTaskId !== null
        };
        
        // Add to tasks list
        tasks.push(newTask);
        this.projectTasks.set(projectId, tasks);
        
        // If this is a subtask, add it to the parent task's subtasks array
        if (parentTaskId) {
            const parentTaskIndex = tasks.findIndex(task => task.id === parentTaskId);
            if (parentTaskIndex !== -1) {
                if (!tasks[parentTaskIndex].subtasks) {
                    tasks[parentTaskIndex].subtasks = [];
                }
                tasks[parentTaskIndex].subtasks.push(newTask.id);
                
                // Track the parent-child relationship
                this.subtaskParentMap.set(`${projectId}_${newTask.id}`, parentTaskId);
            }
        }
        
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
        
        // If progress is being updated, update subtasks progress accordingly
        if (updates.progress !== undefined && projectTasks[taskIndex].subtasks && projectTasks[taskIndex].subtasks.length > 0) {
            // Only propagate progress if all subtasks are completed
            const allSubtasksCompleted = projectTasks[taskIndex].subtasks.every(subtaskId => {
                const subtask = projectTasks.find(task => task.id === subtaskId);
                return subtask && subtask.status === 'completed';
            });
            
            if (allSubtasksCompleted && updates.progress < 100) {
                // If all subtasks are completed but progress is less than 100, adjust it
                projectTasks[taskIndex].progress = 100;
            }
        }
        
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
    
    /**
     * Delete a task by ID
     * @param {number} id - Task ID to delete
     * @param {string} projectId - Required project ID to delete a task from a specific project
     * @param {boolean} reorganizeIds - Whether to reorganize task IDs after deletion
     * @throws {ProjectNotFoundError} If project ID is not provided or invalid
     * @throws {TaskNotFoundError} If task is not found
     * @returns {Promise<Object>} The deleted task
     */
    async deleteTask(id, projectId, reorganizeIds = false) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to delete a task');
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
        
        // Find the task to delete
        const taskIndex = projectTasks.findIndex(task => task.id === id);
        if (taskIndex === -1) {
            throw new TaskNotFoundError(id, projectId);
        }
        
        // Get the task before removing it
        const deletedTask = { ...projectTasks[taskIndex] };
        
        // Check if this task has subtasks and delete them first
        if (deletedTask.subtasks && deletedTask.subtasks.length > 0) {
            // Create a copy of subtasks array to avoid modification during iteration
            const subtaskIds = [...deletedTask.subtasks];
            for (const subtaskId of subtaskIds) {
                await this.deleteTask(subtaskId, projectId, false); // Don't reorganize IDs yet
            }
        }
        
        // Check if this task is a subtask and remove it from parent's subtasks array
        const parentTaskId = this.subtaskParentMap.get(`${projectId}_${id}`);
        if (parentTaskId) {
            const parentTaskIndex = projectTasks.findIndex(task => task.id === parentTaskId);
            if (parentTaskIndex !== -1 && projectTasks[parentTaskIndex].subtasks) {
                projectTasks[parentTaskIndex].subtasks = projectTasks[parentTaskIndex].subtasks.filter(subtaskId => subtaskId !== id);
            }
            // Remove from subtask tracking map
            this.subtaskParentMap.delete(`${projectId}_${id}`);
        }
        
        // Remove the task
        projectTasks.splice(taskIndex, 1);
        
        // Reorganize task IDs if requested
        if (reorganizeIds) {
            this.reorganizeTaskIds(projectTasks);
        }
        
        // Update the project tasks
        this.projectTasks.set(projectId, projectTasks);
        
        // Save tasks
        await this.saveTasks(projectId);
        
        return deletedTask;
    }
    
    /**
     * Delete multiple tasks by criteria
     * @param {Object} criteria - Criteria for selecting tasks to delete
     * @param {string} projectId - Required project ID to delete tasks from a specific project
     * @throws {ProjectNotFoundError} If project ID is not provided or invalid
     * @returns {Promise<Array>} The deleted tasks
     */
    async deleteTasks(criteria, projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to delete tasks');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const projectTasks = this.projectTasks.get(projectId) || [];
        const deletedTasks = [];
        
        // Filter tasks to delete based on criteria
        const tasksToDelete = [];
        
        // Handle different criteria
        if (criteria.ids && Array.isArray(criteria.ids)) {
            // Delete tasks by IDs
            for (const id of criteria.ids) {
                const taskIndex = projectTasks.findIndex(task => task.id === id);
                if (taskIndex !== -1) {
                    tasksToDelete.push(projectTasks[taskIndex]);
                }
            }
        } else if (criteria.status) {
            // Delete tasks by status
            projectTasks.forEach(task => {
                if (task.status === criteria.status) {
                    tasksToDelete.push(task);
                }
            });
        } else if (criteria.duplicates) {
            // Find and delete duplicate tasks (same title and description)
            const uniqueTasks = new Map();
            projectTasks.forEach(task => {
                const key = `${task.title}|${task.description}`;
                if (uniqueTasks.has(key)) {
                    tasksToDelete.push(task);
                } else {
                    uniqueTasks.set(key, task);
                }
            });
        } else if (criteria.unqualified) {
            // Delete tasks that don't meet quality criteria (e.g., missing required fields)
            projectTasks.forEach(task => {
                if (!task.title || !task.description || task.title.trim() === '' || task.description.trim() === '') {
                    tasksToDelete.push(task);
                }
            });
        }
        
        // Delete the tasks (in reverse order to avoid index issues)
        for (const task of tasksToDelete) {
            try {
                const deletedTask = await this.deleteTask(task.id, projectId, false); // Don't reorganize IDs yet
                deletedTasks.push(deletedTask);
            } catch (error) {
                logger.error(`Failed to delete task ${task.id}`, { error });
            }
        }
        
        // Reorganize task IDs after all deletions
        if (deletedTasks.length > 0) {
            const remainingTasks = this.projectTasks.get(projectId) || [];
            this.reorganizeTaskIds(remainingTasks);
            this.projectTasks.set(projectId, remainingTasks);
            await this.saveTasks(projectId);
        }
        
        return deletedTasks;
    }
    
    /**
     * Reorganize task IDs to ensure they are sequential
     * @param {Array} tasks - Array of tasks to reorganize
     * @private
     */
    reorganizeTaskIds(tasks) {
        // Create a map of old IDs to new IDs
        const idMap = new Map();
        
        // Sort tasks by ID to ensure proper ordering
        tasks.sort((a, b) => a.id - b.id);
        
        // Assign new sequential IDs
        tasks.forEach((task, index) => {
            const oldId = task.id;
            const newId = index + 1;
            idMap.set(oldId, newId);
            task.id = newId;
        });
        
        // Update dependencies and subtasks references
        tasks.forEach(task => {
            if (task.dependencies && task.dependencies.length > 0) {
                task.dependencies = task.dependencies.map(depId => idMap.get(depId) || depId);
            }
            
            if (task.subtasks && task.subtasks.length > 0) {
                task.subtasks = task.subtasks.map(subtaskId => idMap.get(subtaskId) || subtaskId);
            }
        });
        
        // Update subtask parent map
        const updatedSubtaskParentMap = new Map();
        for (const [key, parentId] of this.subtaskParentMap.entries()) {
            const [projectId, oldSubtaskId] = key.split('_');
            const newSubtaskId = idMap.get(Number(oldSubtaskId));
            const newParentId = idMap.get(parentId);
            
            if (newSubtaskId && newParentId) {
                updatedSubtaskParentMap.set(`${projectId}_${newSubtaskId}`, newParentId);
            }
        }
        
        this.subtaskParentMap = updatedSubtaskParentMap;
    }
    
    /**
     * Add a subtask to a parent task
     * @param {Object} subtaskData - Subtask data
     * @param {number} parentTaskId - Parent task ID
     * @param {string} projectId - Required project ID
     * @throws {ProjectNotFoundError} If project ID is not provided or invalid
     * @throws {TaskNotFoundError} If parent task is not found
     * @returns {Promise<Object>} The created subtask
     */
    async addSubtask(subtaskData, parentTaskId, projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to add a subtask');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }
        
        // Validate parent task ID
        if (!isValidTaskId(parentTaskId)) {
            throw new TaskValidationError(`Invalid parent task ID: ${parentTaskId}`, {
                field: 'parentTaskId',
                value: parentTaskId
            });
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const projectTasks = this.projectTasks.get(projectId) || [];
        
        // Find the parent task
        const parentTaskIndex = projectTasks.findIndex(task => task.id === parentTaskId);
        if (parentTaskIndex === -1) {
            throw new TaskNotFoundError(parentTaskId, projectId);
        }
        
        // Create the subtask
        const subtask = await this.createTask({
            ...subtaskData,
            priority: subtaskData.priority || projectTasks[parentTaskIndex].priority // Inherit priority from parent
        }, projectId, parentTaskId);
        
        return subtask;
    }
    
    /**
     * Get all subtasks for a parent task
     * @param {number} parentTaskId - Parent task ID
     * @param {string} projectId - Required project ID
     * @throws {ProjectNotFoundError} If project ID is not provided or invalid
     * @throws {TaskNotFoundError} If parent task is not found
     * @returns {Promise<Array>} The subtasks
     */
    /**
     * Get all available projects in the task manager
     * @returns {Promise<Array<string>>} Array of project IDs
     * @throws {FileSystemError} If there's an error accessing the file system
     */
    async getProjects() {
        try {
            // Ensure the base tasks directory exists
            await fs.mkdir(this.baseTasksDir, { recursive: true });
            
            // Read all project directories
            const projectDirs = await fs.readdir(this.baseTasksDir);
            
            // Filter out non-directory items and get project IDs
            const projectIds = [];
            for (const dir of projectDirs) {
                const fullPath = path.join(this.baseTasksDir, dir);
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory()) {
                    // Verify it's a valid project directory by checking for tasks.json
                    const tasksFile = path.join(fullPath, 'tasks.json');
                    try {
                        await fs.access(tasksFile);
                        projectIds.push(dir);
                    } catch (error) {
                        logger.debug(`Skipping invalid project directory: ${dir}`);
                    }
                }
            }
            
            // Sort project IDs alphabetically
            return projectIds.sort();
        } catch (error) {
            logger.error('Error getting projects:', error);
            throw new FileSystemError('Failed to get projects list', error);
        }
    }

    async getSubtasks(parentTaskId, projectId) {
        if (!projectId) {
            throw new ProjectNotFoundError('Project ID is required to get subtasks');
        }
        
        // Validate project ID to prevent path traversal attacks
        if (!isValidProjectId(projectId)) {
            throw new ProjectNotFoundError(`Invalid project ID format: ${projectId}`);
        }
        
        // Validate parent task ID
        if (!isValidTaskId(parentTaskId)) {
            throw new TaskValidationError(`Invalid parent task ID: ${parentTaskId}`, {
                field: 'parentTaskId',
                value: parentTaskId
            });
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const projectTasks = this.projectTasks.get(projectId) || [];
        
        // Find the parent task
        const parentTask = projectTasks.find(task => task.id === parentTaskId);
        if (!parentTask) {
            throw new TaskNotFoundError(parentTaskId, projectId);
        }
        
        // Get the subtasks
        if (!parentTask.subtasks || parentTask.subtasks.length === 0) {
            return [];
        }
        
        return projectTasks.filter(task => parentTask.subtasks.includes(task.id));
    }
}
