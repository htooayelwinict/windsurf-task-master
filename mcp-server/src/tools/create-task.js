import { z } from 'zod';

/**
 * Create a new task
 */
export function registerCreateTaskTool(server, taskManager) {
    server.addTool({
        name: 'create_task',
        description: 'Create a new task',
        parameters: z.object({
            title: z.string().describe('Task title'),
            description: z.string().describe('Task description'),
            priority: z.enum(['low', 'medium', 'high']).default('medium').describe('Task priority'),
            dependencies: z.array(z.number()).optional().describe('List of task IDs that this task depends on'),
            projectId: z.string().describe('Project ID to create a task for')
        }),
        execute: async (args) => {
            try {
                if (!args.projectId) {
                    throw new Error('Project ID is required to create a task');
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
                console.error('Error creating task:', error);
                return {
                    content: [{
                        type: 'text',
                        text: `Error creating task: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
