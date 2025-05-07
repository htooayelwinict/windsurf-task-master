import { z } from 'zod';
import { TaskValidationError, createErrorHandler } from '../utils/errors.js';
import { isValidProjectId, isValidTaskId } from '../utils/security.js';
import { logger } from '../utils/logger.js';

/**
 * Get all subtasks for a parent task
 */
export function registerGetSubtasksTool(server, taskManager) {
    server.addTool({
        name: 'get_subtasks',
        description: 'Get all subtasks for a parent task',
        parameters: z.object({
            parentTaskId: z.number().positive('Parent task ID must be positive').describe('The ID of the parent task'),
            projectId: z.string()
                .min(1, 'Project ID is required')
                .max(50, 'Project ID is too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID the parent task belongs to')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('get_subtasks');
            try {
                // Validate project ID format to prevent path traversal attacks
                if (!isValidProjectId(args.projectId)) {
                    logger.warn('Invalid project ID format detected', { projectId: args.projectId });
                    throw new TaskValidationError('Invalid project ID format', {
                        field: 'projectId',
                        value: args.projectId
                    });
                }
                
                // Validate parent task ID
                if (!isValidTaskId(args.parentTaskId)) {
                    logger.warn('Invalid parent task ID format detected', { parentTaskId: args.parentTaskId });
                    throw new TaskValidationError('Invalid parent task ID format', {
                        field: 'parentTaskId',
                        value: args.parentTaskId
                    });
                }
                
                const subtasks = await taskManager.getSubtasks(args.parentTaskId, args.projectId);
                
                if (subtasks.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `No subtasks found for parent task #${args.parentTaskId} in project ${args.projectId}`
                        }]
                    };
                }
                
                // Build response message
                let responseText = `Subtasks for parent task #${args.parentTaskId} in project ${args.projectId}:\n\n`;
                subtasks.forEach(subtask => {
                    const progressInfo = subtask.progress !== undefined ? ` - Progress: ${subtask.progress}%` : '';
                    responseText += `- #${subtask.id}: "${subtask.title}" [${subtask.status.toUpperCase()}]${progressInfo}\n`;
                });
                
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
