import { z } from 'zod';

/**
 * Get all tasks assigned to Windsurf
 */
export function registerGetWindsurfTasksTool(server, taskManager) {
    server.addTool({
        name: 'get_windsurf_tasks',
        description: 'Get all tasks assigned to Windsurf across all projects or from a specific project',
        parameters: z.object({
            projectId: z.string().optional().describe('Optional project ID to get tasks from a specific project. If not provided, returns tasks from all projects.')
        }),
        execute: async (args) => {
            try {
                const { projectId } = args;
                const tasks = await taskManager.getWindsurfTasks(projectId);
                
                if (tasks.length === 0) {
                    let message = 'No tasks currently assigned to Windsurf';
                    if (projectId) {
                        message += ` in project ${projectId}`;
                    }
                    
                    return {
                        content: [{
                            type: 'text',
                            text: message
                        }]
                    };
                }
                
                const taskList = tasks.map(task => {
                    let taskInfo = `#${task.id} [${task.status.toUpperCase()}] ${task.title} (Priority: ${task.priority})`;
                    
                    // Add progress if available
                    if (task.progress !== undefined) {
                        taskInfo += ` - Progress: ${task.progress}%`;
                    }
                    
                    // Add project ID if available and not filtered by project
                    if (task.projectId && !projectId) {
                        taskInfo += ` [Project: ${task.projectId}]`;
                    }
                    
                    return taskInfo;
                }).join('\n');
                
                let title = 'Tasks assigned to Windsurf';
                if (projectId) {
                    title += ` in project ${projectId}`;
                }
                
                return {
                    content: [{
                        type: 'text',
                        text: `${title}:\n${taskList}`
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error getting Windsurf tasks: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
