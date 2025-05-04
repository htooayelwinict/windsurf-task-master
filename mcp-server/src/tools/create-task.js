import { z } from 'zod';
import { TaskValidationError, createErrorHandler } from '../utils/errors.js';
import { isValidProjectId } from '../utils/security.js';
import { logger } from '../utils/logger.js';

/**
 * Create a new task
 */
export function registerCreateTaskTool(server, taskManager) {
    server.addTool({
        name: 'create_task',
        description: 'Create a new task',
        parameters: z.object({
            title: z.string().min(1, 'Title is required').max(100, 'Title is too long').describe('Task title'),
            description: z.string().max(1000, 'Description is too long').describe('Task description'),
            priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Task priority'),
            dependencies: z.array(z.number().positive('Task IDs must be positive')).optional().describe('List of task IDs that this task depends on'),
            projectId: z.string()
                .min(1, 'Project ID is required')
                .max(50, 'Project ID is too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID to create a task for')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('create_task');
            try {
                // Validate project ID format to prevent path traversal attacks
                if (!isValidProjectId(args.projectId)) {
                    logger.warn('Invalid project ID format detected', { projectId: args.projectId });
                    throw new TaskValidationError('Invalid project ID format', {
                        field: 'projectId',
                        value: args.projectId
                    });
                }
                
                const task = await taskManager.createTask({
                    title: args.title,
                    description: args.description,
                    priority: args.priority,
                    dependencies: args.dependencies || []
                }, args.projectId);
                
                return {
                    content: [{
                        type: 'text',
                        text: `Task created successfully with ID: ${task.id} for project: ${args.projectId}`
                    }]
                };
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}
