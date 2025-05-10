import { z } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Register a tool to get all projects from the task manager
 * @param {object} server - The MCP server instance
 * @param {object} taskManager - The task manager instance
 */
export function registerGetProjectsTool(server, taskManager) {
    if (!server || !taskManager) {
        throw new Error('Server and task manager instances are required');
    }

    // Log that we're registering the tool
    console.error('Registering get_projects tool');
    
    server.addTool({
        name: 'get_projects',
        description: 'Get all available projects in the task manager',
        parameters: z.object({
            projectId: z.string().optional().describe('Optional project ID to filter by')
        }),
        execute: async () => {
            try {
                console.error('Executing get_projects tool');
                logger.info('Retrieving projects list');
                
                // Get projects from task manager
                const projects = await taskManager.getProjects();
                
                console.error(`Found ${projects.length} projects: ${projects.join(', ')}`);
                logger.info(`Found ${projects.length} projects`);
                
                return {
                    content: [{
                        type: 'text',
                        text: projects.length > 0
                            ? `Available projects:\n${projects.join('\n')}`
                            : 'No projects found'
                    }]
                };
            } catch (error) {
                console.error(`Error in get_projects: ${error.message}`);
                logger.error('Error in get_projects:', error);
                return {
                    content: [{
                        type: 'text',
                        text: `Error getting projects: ${error.message}`
                    }],
                    isError: true
                };
            }
        }
    });
}
