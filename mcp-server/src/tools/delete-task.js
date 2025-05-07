import { z } from 'zod';
import { TaskValidationError, createErrorHandler } from '../utils/errors.js';
import { isValidProjectId, isValidTaskId } from '../utils/security.js';
import { logger } from '../utils/logger.js';

/**
 * Delete a task
 */
export function registerDeleteTaskTool(server, taskManager) {
    server.addTool({
        name: 'delete_task',
        description: 'Delete a task by ID',
        parameters: z.object({
            id: z.number().positive('Task ID must be positive').describe('The ID of the task to delete'),
            projectId: z.string()
                .min(1, 'Project ID is required')
                .max(50, 'Project ID is too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID the task belongs to'),
            reorganizeIds: z.boolean().optional().default(true).describe('Whether to reorganize task IDs after deletion')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('delete_task');
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
                    logger.warn('Invalid task ID format detected', { taskId: args.id });
                    throw new TaskValidationError('Invalid task ID format', {
                        field: 'id',
                        value: args.id
                    });
                }
                
                const deletedTask = await taskManager.deleteTask(args.id, args.projectId, args.reorganizeIds);
                
                return {
                    content: [{
                        type: 'text',
                        text: `Task #${deletedTask.id}: "${deletedTask.title}" has been deleted from project ${args.projectId}`
                    }]
                };
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}
