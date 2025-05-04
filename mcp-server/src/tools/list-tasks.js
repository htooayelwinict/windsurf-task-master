import { z } from 'zod';

/**
 * List all tasks or filter by status
 */
export function registerListTasksTool(server, taskManager) {
    server.addTool({
        name: 'list_tasks',
        description: 'List all tasks or filter by status',
        parameters: z.object({
            status: z.enum(['pending', 'in-progress', 'completed', 'all']).optional().describe('Filter tasks by status (default: all)'),
            projectId: z.string().describe('Project ID to list tasks for')
        }),
        execute: async (args) => {
            try {
                if (!args.projectId) {
                    throw new Error('Project ID is required to list tasks');
                }
                
                let tasks;
                const { status, projectId } = args;
                
                if (status && status !== 'all') {
                    tasks = await taskManager.getTasksByStatus(status, projectId);
                } else {
                    tasks = await taskManager.listTasks(projectId);
                }

                if (tasks.length === 0) {
                    let message = 'No tasks found';
                    if (status && status !== 'all') {
                        message += ` with status: ${status}`;
                    }
                    if (projectId) {
                        message += ` for project: ${projectId}`;
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

                let title = 'Tasks';
                if (status && status !== 'all') {
                    title += ` with status: ${status}`;
                }
                if (projectId) {
                    title += ` for project: ${projectId}`;
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
                        text: `Error listing tasks: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
