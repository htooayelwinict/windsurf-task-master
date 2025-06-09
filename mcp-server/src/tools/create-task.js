import { z } from 'zod';
import { TaskValidationError, createErrorHandler } from '../utils/errors.js';
import { isValidProjectId } from '../utils/security.js';
import { logger } from '../utils/logger.js';
import SmartDefaults from '../utils/smart-defaults.js';
import { BRANDING, formatBrandedMessage } from '../constants/branding.js';

/**
 * Create a new task
 */
export function registerCreateTaskTool(server, taskManager) {
    server.addTool({
        name: 'create_task',
        description: `Create a new task with ${BRANDING.PRODUCT_NAME}`,
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
                
                // Get existing tasks to help with hierarchy analysis
                let existingTasks = [];
                try {
                    existingTasks = await taskManager.listTasks(args.projectId);
                } catch (error) {
                    // Project might not exist yet - that's fine for new projects
                    logger.debug(`Could not load existing tasks for project ${args.projectId}`);
                }
                
                // Apply smart defaults to enhance task creation
                const smartResult = SmartDefaults.apply({
                    title: args.title,
                    description: args.description,
                    priority: args.priority,
                    dependencies: args.dependencies || []
                }, existingTasks);
                
                // Create task with enhanced data
                const task = await taskManager.createTask(smartResult.enhanced, args.projectId);
                
                // Prepare response with smart suggestions
                let responseText = `✅ Task created successfully with ${BRANDING.PRODUCT_NAME_SHORT}\n\nTask ID: ${task.id} for project: ${args.projectId}`;
                
                // Add smart suggestions if any were generated
                if (smartResult.suggestions && smartResult.suggestions.length > 0) {
                    responseText += '\n\n💡 Smart suggestions applied:';
                    smartResult.suggestions.forEach(suggestion => {
                        responseText += `\n- ${suggestion}`;
                    });
                }
                
                // Add trademark notice
                responseText += `\n\n---\n${BRANDING.TRADEMARK_NOTICE}`;
                
                return {
                    content: [{
                        type: 'text',
                        text: responseText
                    }]
                };
            } catch (error) {
                const errorResponse = errorHandler(error, args);
                
                // Add branding to error message
                if (errorResponse && errorResponse.content && errorResponse.content.length > 0) {
                    errorResponse.content[0].text = `❌ Error in ${BRANDING.PRODUCT_NAME_SHORT}: ${errorResponse.content[0].text}\n\nNeed help? Visit: ${BRANDING.URLS.SUPPORT}`;
                }
                
                return errorResponse;
            }
        }
    });
}
