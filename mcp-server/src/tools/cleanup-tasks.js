import { z } from 'zod';
import { createErrorHandler } from '../utils/errors.js';
import { isValidProjectId } from '../utils/security.js';
import { logger } from '../utils/logger.js';
import { getProjectConfig } from '../config/task-cleanup-config.js';

/**
 * Register a tool to clean up tasks in a project
 */
export function registerCleanupTasksTool(server, taskManager) {
    // Get the TaskCleanupService instance from the taskManager
    const taskCleanupService = taskManager.taskCleanupService;
    
    if (!taskCleanupService) {
        logger.error('TaskCleanupService not found in TaskManager');
        return;
    }
    
    server.addTool({
        name: 'cleanup_tasks',
        description: 'Clean up tasks in a project by detecting duplicates, fixing metadata consistency, and reorganizing task IDs',
        parameters: z.object({
            projectId: z.string()
                .min(1, 'Project ID is required')
                .max(50, 'Project ID is too long')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID to clean up tasks for'),
            operations: z.object({
                detectDuplicates: z.boolean().default(true).describe('Detect and merge duplicate tasks'),
                fixMetadata: z.boolean().default(true).describe('Fix metadata consistency issues'),
                reorganizeIds: z.boolean().default(true).describe('Reorganize task IDs'),
                cleanOrphans: z.boolean().default(true).describe('Clean up orphaned subtasks'),
                enforceQuality: z.boolean().default(true).describe('Enforce task quality standards')
            }).optional().describe('Specific operations to perform')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('cleanup_tasks');
            try {
                // Validate project ID format to prevent path traversal attacks
                if (!isValidProjectId(args.projectId)) {
                    logger.warn('Invalid project ID format detected', { projectId: args.projectId });
                    throw new Error('Invalid project ID format');
                }
                
                // Get the project configuration
                const config = getProjectConfig(args.projectId);
                
                // Override config with user-specified operations if provided
                if (args.operations) {
                    config.operations.detectDuplicates.enabled = args.operations.detectDuplicates;
                    config.operations.metadataConsistency.enabled = args.operations.fixMetadata;
                    config.operations.reorganizeTaskIds.enabled = args.operations.reorganizeIds;
                    config.operations.orphanedSubtasks.enabled = args.operations.cleanOrphans;
                    config.operations.qualityEnforcement.enabled = args.operations.enforceQuality;
                }
                
                // Apply the config to the TaskCleanupService
                // Note: The TaskCleanupService will get its own config internally,
                // we just need to override the operations based on user input
                taskCleanupService._config = config;
                
                // Perform the cleanup
                const results = await taskCleanupService.performCleanup(args.projectId);
                
                // Format the results for display
                const formattedResults = formatCleanupResults(results);
                
                // Return a properly formatted MCP response
                return {
                    content: formattedResults ? [
                        {
                            type: 'text',
                            text: `Task cleanup completed for project ${args.projectId}:\n${formattedResults}`
                        }
                    ] : [
                        {
                            type: 'text',
                            text: `No cleanup actions were needed for project ${args.projectId}`
                        }
                    ]
                };
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}

/**
 * Format cleanup results for display
 * @param {Array} results - Array of cleanup action results
 * @returns {string} Formatted results
 */
function formatCleanupResults(results) {
    if (!results || results.length === 0) {
        return 'No cleanup actions were performed.';
    }
    
    const sections = {};
    
    // Group results by type
    results.forEach(result => {
        const type = result.type || 'other';
        if (!sections[type]) {
            sections[type] = [];
        }
        sections[type].push(result.description);
    });
    
    // Format each section
    let output = '';
    for (const [type, items] of Object.entries(sections)) {
        const formattedType = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        output += `${formattedType}:\n`;
        items.forEach(item => {
            output += `- ${item}\n`;
        });
        output += '\n';
    }
    
    return output.trim();
}