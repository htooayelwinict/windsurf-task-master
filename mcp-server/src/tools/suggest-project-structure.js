import { z } from 'zod';
import { createErrorHandler } from '../utils/errors.js';
import { isValidProjectId } from '../utils/security.js';
import { logger } from '../utils/logger.js';
import TaskHierarchyAnalyzer from '../utils/task-hierarchy.js';

/**
 * Suggest balanced project structure to avoid "turtleneck" task hierarchy
 */
export function registerSuggestProjectStructureTool(server, taskManager) {
    server.addTool({
        name: 'suggest_project_structure',
        description: 'Analyze project requirements and suggest balanced task structure (fixes turtleneck pattern)',
        parameters: z.object({
            description: z.string().min(10, 'Description must be at least 10 characters').describe('Project or feature description'),
            projectId: z.string()
                .min(1, 'Project ID is required')
                .regex(/^[a-zA-Z0-9-_]+$/, 'Project ID can only contain letters, numbers, hyphens, and underscores')
                .describe('Project ID to analyze/create structure for'),
            autoCreate: z.boolean().default(false).describe('Automatically create suggested tasks'),
            structureOnly: z.boolean().default(false).describe('Only show structure analysis without creating tasks')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('suggest_project_structure');
            try {
                // Validate project ID
                if (!isValidProjectId(args.projectId)) {
                    throw new Error('Invalid project ID format');
                }
                
                // Get existing tasks to understand current project state
                let existingTasks = [];
                try {
                    existingTasks = await taskManager.listTasks(args.projectId);
                } catch (error) {
                    // Project might not exist yet - that's fine
                    logger.debug(`Project ${args.projectId} not found, treating as new project`);
                }
                
                // Analyze the project description
                const analysis = TaskHierarchyAnalyzer.analyzeProject(args.description, existingTasks);
                
                let response = `🔍 **Project Structure Analysis for "${args.projectId}"**\n\n`;
                response += `📝 **Description:** ${args.description}\n\n`;
                
                if (!analysis.shouldUseBalancedStructure) {
                    response += `✅ **Analysis Result:** ${analysis.suggestedStructure.reasoning}\n\n`;
                    response += `💡 **Recommendation:** Current approach is fine. Create tasks normally with \`create_task\`.`;
                    
                    return {
                        content: [{ type: 'text', text: response }]
                    };
                }
                
                // Show balanced structure suggestion
                response += `⚠️  **Detected Turtleneck Risk:** ${analysis.suggestedStructure.reasoning}\n\n`;
                response += `🏗️  **Suggested Balanced Structure:**\n\n`;
                
                const structure = analysis.suggestedStructure.parentTasks;
                let createdTasks = [];
                
                // Display suggested structure
                for (const parentTask of structure) {
                    response += `• **${parentTask.title}** (${parentTask.priority}): ${parentTask.description}\n`;
                    
                    // Show suggested subtasks
                    const subtasks = TaskHierarchyAnalyzer.getSubtaskTemplates(parentTask.domain);
                    for (const subtask of subtasks) {
                        response += `  - ${subtask.title}: ${subtask.description}\n`;
                    }
                    response += `\n`;
                }
                
                // Create tasks if requested
                if (args.autoCreate && !args.structureOnly) {
                    // Create parent tasks first
                    for (const parentTask of structure) {
                        try {
                            // Create parent task
                            const createdParent = await taskManager.createTask({
                                title: parentTask.title,
                                description: parentTask.description,
                                priority: parentTask.priority
                            }, args.projectId);
                            
                            createdTasks.push(createdParent);
                            
                            // Always create subtasks for each parent task
                            const subtasks = TaskHierarchyAnalyzer.getSubtaskTemplates(parentTask.domain);
                            for (const subtask of subtasks) {
                                const createdSubtask = await taskManager.addSubtask({
                                    title: subtask.title,
                                    description: subtask.description,
                                    priority: parentTask.priority // Inherit parent priority
                                }, createdParent.id, args.projectId);
                                
                                createdTasks.push(createdSubtask);
                            }
                        } catch (error) {
                            logger.error(`Error creating tasks for domain ${parentTask.domain}:`, error);
                        }
                    }
                }
                
                // Add action recommendations
                if (args.structureOnly) {
                    response += `📋 **Next Steps:**\n`;
                    response += `• Review the suggested structure above\n`;
                    response += `• Use \`suggest_project_structure\` with \`autoCreate: true\` to create these tasks\n`;
                    response += `• Or manually create tasks following this balanced structure\n`;
                } else if (args.autoCreate) {
                    response += `✅ **Tasks Created:** ${createdTasks.length} tasks created with balanced structure!\n\n`;
                    response += `🎯 **Next Steps:**\n`;
                    response += `• Review created tasks: \`mcp5_list_tasks({projectId: "${args.projectId}"})\`\n`;
                    response += `• Assign first task: \`mcp5_assign_to_windsurf({id: ${createdTasks[0]?.id || 1}, projectId: "${args.projectId}"})\`\n`;
                    response += `• Track progress: \`mcp5_display_task_status({projectId: "${args.projectId}"})\`\n`;
                } else {
                    response += `📋 **To Create This Structure:**\n`;
                    response += `• Run again with \`autoCreate: true\` to automatically create all tasks\n`;
                    response += `• Or use the structure above as a guide for manual task creation\n`;
                }
                
                return {
                    content: [{ type: 'text', text: response }]
                };
                
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}