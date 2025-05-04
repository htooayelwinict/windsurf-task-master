import { z } from 'zod';

/**
 * Update an existing task
 */
export function registerUpdateTaskTool(server, taskManager) {
    server.addTool({
        name: 'update_task',
        description: 'Update an existing task',
        parameters: z.object({
            id: z.number().describe('The ID of the task to update'),
            title: z.string().optional().describe('New title for the task'),
            description: z.string().optional().describe('New description for the task'),
            status: z.enum(['pending', 'in-progress', 'completed']).optional().describe('New status for the task'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority for the task'),
            dependencies: z.array(z.number()).optional().describe('New dependencies for the task'),
            projectId: z.string().describe('Project ID the task belongs to')
        }),
        execute: async (args) => {
            try {
                if (!args.projectId) {
                    throw new Error('Project ID is required to update a task');
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
                return {
                    content: [{
                        type: 'text',
                        text: `Error updating task: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
