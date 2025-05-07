import { z } from 'zod';
import { TaskValidationError, createErrorHandler } from '../utils/errors.js';
import { isValidProjectId } from '../utils/security.js';
import { logger } from '../utils/logger.js';

/**
 * Delete multiple tasks based on criteria
 */
export function registerDeleteTasksTool(server, taskManager) {
    server.addTool({
        name: 'delete_tasks',
        description: 'Delete multiple tasks based on criteria',
        parameters: z.object({
            projectId: z.string()
                .min(1, 'Project ID is required')
                .max(50, 'Project ID is too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID to delete tasks from'),
            ids: z.array(z.number().positive('Task IDs must be positive')).optional()
                .describe('Array of task IDs to delete'),
            status: z.enum(['pending', 'in-progress', 'completed']).optional()
                .describe('Delete all tasks with this status'),
            duplicates: z.boolean().optional().default(false)
                .describe('Delete duplicate tasks (same title and description)'),
            unqualified: z.boolean().optional().default(false)
                .describe('Delete tasks that do not meet quality criteria (missing title or description)')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('delete_tasks');
            try {
                // Validate project ID format to prevent path traversal attacks
                if (!isValidProjectId(args.projectId)) {
                    logger.warn('Invalid project ID format detected', { projectId: args.projectId });
                    throw new TaskValidationError('Invalid project ID format', {
                        field: 'projectId',
                        value: args.projectId
                    });
                }
                
                // Build criteria object
                const criteria = {};
                if (args.ids && args.ids.length > 0) {
                    criteria.ids = args.ids;
                } else if (args.status) {
                    criteria.status = args.status;
                } else if (args.duplicates) {
                    criteria.duplicates = true;
                } else if (args.unqualified) {
                    criteria.unqualified = true;
                } else {
                    throw new TaskValidationError('No deletion criteria provided', {
                        field: 'criteria',
                        value: 'missing'
                    });
                }
                
                const deletedTasks = await taskManager.deleteTasks(criteria, args.projectId);
                
                if (deletedTasks.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `No tasks matching the criteria were found in project ${args.projectId}`
                        }]
                    };
                }
                
                // Build response message
                let responseText = `Deleted ${deletedTasks.length} tasks from project ${args.projectId}:\n\n`;
                deletedTasks.forEach(task => {
                    responseText += `- #${task.id}: "${task.title}"\n`;
                });
                
                // Add information about task ID reorganization
                responseText += '\nTask IDs have been reorganized to maintain sequential ordering.';
                
                return {
                    content: [{
                        type: 'text',
                        text: responseText
                    }]
                };
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}
