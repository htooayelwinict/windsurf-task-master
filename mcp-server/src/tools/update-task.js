import { z } from 'zod';
import { TaskValidationError, createErrorHandler } from '../utils/errors.js';
import { isValidProjectId, isValidTaskId } from '../utils/security.js';
import { logger } from '../utils/logger.js';

/**
 * Update an existing task
 */
export function registerUpdateTaskTool(server, taskManager) {
    server.addTool({
        name: 'update_task',
        description: 'Update an existing task',
        parameters: z.object({
            id: z.number().positive('Task ID must be positive').describe('The ID of the task to update'),
            title: z.string().max(100, 'Title is too long').optional().describe('New title for the task'),
            description: z.string().max(1000, 'Description is too long').optional().describe('New description for the task'),
            status: z.enum(['pending', 'in-progress', 'completed']).optional().describe('New status for the task'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority for the task'),
            dependencies: z.array(z.number().positive('Task IDs must be positive')).optional().describe('New dependencies for the task'),
            projectId: z.string()
                .min(1, 'Project ID is required')
                .max(50, 'Project ID is too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID the task belongs to')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('update_task');
            try {
                // Validate project ID format to prevent path traversal attacks
                if (!isValidProjectId(args.projectId)) {
                    logger.warn('Invalid project ID format detected', { projectId: args.projectId });
                    throw new TaskValidationError('Invalid project ID format', {
                        field: 'projectId',
                        value: args.projectId
                    });
                }
                
                // Validate task ID
                if (!isValidTaskId(args.id)) {
                    logger.warn('Invalid task ID detected', { taskId: args.id });
                    throw new TaskValidationError('Invalid task ID', {
                        field: 'id',
                        value: args.id
                    });
                }
                
                const { id, projectId, ...updates } = args;
                const updatedTask = await taskManager.updateTask(id, updates, projectId);
                
                return {
                    content: [{
                        type: 'text',
                        text: `Successfully updated task #${updatedTask.id}: ${updatedTask.title}`
                    }]
                };
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}
