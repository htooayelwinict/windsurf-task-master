import { z } from 'zod';

/**
 * Mark a task as completed
 */
export function registerCompleteTaskTool(server, taskManager) {
    server.addTool({
        name: 'complete_task',
        description: 'Mark a task as completed',
        parameters: z.object({
            id: z.number().describe('The ID of the task to complete'),
            projectId: z.string().describe('Project ID the task belongs to')
        }),
        execute: async (args) => {
            try {
                if (!args.projectId) {
                    throw new Error('Project ID is required to complete a task');
                }
                
                const completedTask = await taskManager.completeTask(args.id, args.projectId);
                
                return {
                    content: [{
                        type: 'text',
                        text: `Successfully completed task #${completedTask.id}: ${completedTask.title} in project ${args.projectId}`
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error completing task: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
