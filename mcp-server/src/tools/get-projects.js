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
        execute: async (params) => {
            try {
                console.error('Executing get_projects tool');
                logger.info('Retrieving projects list');
                
                // Get projects from task manager
                const projects = await taskManager.getProjects();
                
                // Filter by projectId if provided
                let filteredProjects = projects;
                if (params && params.projectId) {
                    filteredProjects = projects.filter(id => id === params.projectId);
                    logger.info(`Filtered projects by ID: ${params.projectId}`);
                }
                
                console.error(`Found ${filteredProjects.length} projects: ${filteredProjects.join(', ')}`);
                logger.info(`Found ${filteredProjects.length} projects`);
                
                // Create a clean response object with proper structure
                const response = {
                    content: [{
                        type: 'text',
                        text: filteredProjects.length > 0
                            ? `Available projects:\n${filteredProjects.join('\n')}`
                            : 'No projects found'
                    }]
                };
                
                // Return the response directly without any additional processing
                return response;
            } catch (error) {
                console.error(`Error in get_projects: ${error.message}`);
                logger.error('Error in get_projects:', error);
                
                // Create a clean error response
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
