import { z } from 'zod';

/**
 * Update task progress from Windsurf
 */
export function registerUpdateWindsurfProgressTool(server, taskManager) {
    server.addTool({
        name: 'update_windsurf_progress',
        description: 'Update progress on a task assigned to Windsurf',
        parameters: z.object({
            id: z.number().describe('The ID of the task to update'),
            progress: z.number().min(0).max(100).describe('Progress percentage (0-100)'),
            projectId: z.string().describe('Project ID to update a task from')
        }),
        execute: async (args) => {
            try {
                if (!args.projectId) {
                    throw new Error('Project ID is required to update task progress');
                }
                
                const { id, progress, projectId } = args;
                const task = await taskManager.updateWindsurfTaskProgress(id, progress, projectId);
                
                const responseText = `Updated progress for task #${task.id} to ${progress}% in project ${projectId}`;
                
                // Note: The updateWindsurfTaskProgress method now handles completion automatically if progress is 100%
                
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
                        text: `Error updating task progress: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
