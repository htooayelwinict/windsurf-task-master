import { z } from 'zod';

/**
 * Assign a task to Windsurf for processing
 */
export function registerAssignToWindsurfTool(server, taskManager) {
    server.addTool({
        name: 'assign_to_windsurf',
        description: 'Assign a task to Windsurf for processing',
        parameters: z.object({
            id: z.number().describe('The ID of the task to assign to Windsurf'),
            projectId: z.string().describe('Project ID to assign a task from')
        }),
        execute: async (args) => {
            try {
                if (!args.projectId) {
                    throw new Error('Project ID is required to assign a task to Windsurf');
                }
                
                const { id, projectId } = args;
                const task = await taskManager.assignToWindsurf(id, projectId);
                
                const responseText = `Successfully assigned task #${task.id} to Windsurf: ${task.title} from project ${projectId}`
                
                return {
                    content: [{
                        type: 'text',
                        text: responseText
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error assigning task to Windsurf: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
