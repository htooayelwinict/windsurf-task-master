import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Core task management functionality
 */
export class TaskManager {
    constructor() {
        this.baseTasksDir = path.join(__dirname, '../../../tasks');
        this.projectsMap = new Map(); // Map project IDs to their task files
        this.projectTasks = new Map(); // Store tasks for each project
        this.initialized = false;
        this.windsurfTasks = new Map(); // Track tasks assigned to Windsurf
        this.currentProject = null; // Current active project
    }

    /**
     * Initialize the task manager by loading existing tasks
     * @param {string} projectId - Required project ID to load tasks for a specific project
     */
    async init(projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to initialize task manager');
        }

        try {
            // Ensure the base tasks directory exists
            await fs.mkdir(this.baseTasksDir, { recursive: true });
            
            // Set as the current project
            this.currentProject = projectId;
            const projectDir = path.join(this.baseTasksDir, projectId);
            const projectTasksPath = path.join(projectDir, 'tasks.json');
            
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
            } catch (error) {
                // If file doesn't exist, create it with empty tasks
                this.projectTasks.set(projectId, []);
                await this.saveTasks(projectId);
            }

            this.initialized = true;
        } catch (error) {
            console.error(`Failed to initialize TaskManager for project ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Save tasks to file
     * @param {string} projectId - Required project ID to save tasks for a specific project
     */
    async saveTasks(projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to save tasks');
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
            
            // Get the tasks for this project
            const tasks = this.projectTasks.get(projectId) || [];
            
            // Save the tasks to the project-specific file
            await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2));
            console.error(`Saved tasks for project ${projectId} to ${tasksPath}`);
        } catch (error) {
            console.error(`Failed to save tasks for project ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new task
     * @param {Object} taskData - Task data
     * @param {string} projectId - Required project ID to create the task for a specific project
     */
    async createTask({ title, description, priority = 'medium', dependencies = [] }, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to create a task');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the current tasks for this project
        const projectTasks = this.projectTasks.get(projectId) || [];
        
        // Create the new task
        const newTask = {
            id: projectTasks.length + 1,
            title,
            description,
            status: 'pending',
            priority,
            dependencies,
            projectId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add the task to the project's tasks
        projectTasks.push(newTask);
        this.projectTasks.set(projectId, projectTasks);
        
        // Save the tasks to the project-specific file
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
     */
    async updateTask(id, updates, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to update a task');
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
     * Get a task by ID
     * @param {number} id - Task ID
     * @param {string} projectId - Required project ID to get a task from a specific project
     */
    async getTask(id, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to get a task');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const projectTasks = this.projectTasks.get(projectId) || [];
        
        // Find and return the task
        return projectTasks.find(task => task.id === id);
    }

    /**
     * Get tasks by status
     * @param {string} status - Task status
     * @param {string} projectId - Required project ID to get tasks from a specific project
     */
    async getTasksByStatus(status, projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to get tasks by status');
        }
        
        // Initialize for the project
        await this.init(projectId);
        
        // Get the tasks for this project
        const projectTasks = this.projectTasks.get(projectId) || [];
        
        // Filter and return tasks by status
        return projectTasks.filter(task => task.status === status);
    }

    /**
     * Reload tasks from file (for external updates)
     * @param {string} projectId - Required project ID to reload tasks for a specific project
     */
    async reloadTasks(projectId) {
        if (!projectId) {
            throw new Error('Project ID is required to reload tasks');
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
            throw new Error(`Task with id ${id} not found in project ${projectId}`);
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
     * Get all tasks assigned to Windsurf
     * @param {string} projectId - Optional project ID to get tasks from a specific project
     */
    async getWindsurfTasks(projectId = null) {
        // If a specific project is requested, get tasks only from that project
        if (projectId) {
            await this.init(projectId);
            const projectTasks = this.projectTasks.get(projectId) || [];
            return projectTasks.filter(task => task.assignedTo === 'windsurf');
        }
        
        // If no specific project is requested, collect Windsurf tasks from all projects
        const allWindsurfTasks = [];
        
        // Check each project in the map
        for (const [projectId, _] of this.projectsMap) {
            try {
                await this.init(projectId);
                const projectTasks = this.projectTasks.get(projectId) || [];
                const windsurfTasks = projectTasks
                    .filter(task => task.assignedTo === 'windsurf')
                    .map(task => ({ ...task, projectId }));
                allWindsurfTasks.push(...windsurfTasks);
            } catch (error) {
                console.error(`Error getting Windsurf tasks for project ${projectId}:`, error);
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
        
        // Get the task
        const task = await this.getTask(id, projectId);
        if (!task) {
            throw new Error(`Task with id ${id} not found in project ${projectId}`);
        }
        
        if (task.assignedTo !== 'windsurf') {
            throw new Error(`Task with id ${id} in project ${projectId} is not assigned to Windsurf`);
        }
        
        // If progress is 100%, mark as completed
        if (progress === 100) {
            console.error(`Completing task #${id} in project ${projectId} with 100% progress`);
            return this.completeTask(id, projectId);
        }
        
        // Update the task progress
        const updatedTask = await this.updateTask(id, { 
            progress,
            updatedAt: new Date().toISOString()
        }, projectId);
        
        console.error(`Updated progress for task #${id} in project ${projectId} to ${progress}%`);
        return updatedTask;
    }
}
