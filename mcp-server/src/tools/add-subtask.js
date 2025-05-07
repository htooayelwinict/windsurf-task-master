import { z } from 'zod';
import { TaskValidationError, createErrorHandler } from '../utils/errors.js';
import { isValidProjectId, isValidTaskId } from '../utils/security.js';
import { logger } from '../utils/logger.js';

/**
 * Add a subtask to a parent task
 */
export function registerAddSubtaskTool(server, taskManager) {
    server.addTool({
        name: 'add_subtask',
        description: 'Add a subtask to a parent task',
        parameters: z.object({
            parentTaskId: z.number().positive('Parent task ID must be positive').describe('The ID of the parent task'),
            title: z.string().min(1, 'Title is required').max(100, 'Title is too long').describe('Subtask title'),
            description: z.string().max(1000, 'Description is too long').describe('Subtask description'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Subtask priority (inherits from parent if not specified)'),
            dependencies: z.array(z.number().positive('Task IDs must be positive')).optional().describe('List of task IDs that this subtask depends on'),
            projectId: z.string()
                .min(1, 'Project ID is required')
                .max(50, 'Project ID is too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID the parent task belongs to')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('add_subtask');
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
                
                const subtaskData = {
                    title: args.title,
                    description: args.description,
                    priority: args.priority,
                    dependencies: args.dependencies || []
                };
                
                const subtask = await taskManager.addSubtask(subtaskData, args.parentTaskId, args.projectId);
                
                return {
                    content: [{
                        type: 'text',
                        text: `Subtask #${subtask.id}: "${subtask.title}" has been added to parent task #${args.parentTaskId} in project ${args.projectId}`
                    }]
                };
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}
