/**
 * Register all task management tools for the MCP server
 */

import { registerCreateTaskTool } from './create-task.js';
import { registerListTasksTool } from './list-tasks.js';
import { registerUpdateTaskTool } from './update-task.js';
import { registerCompleteTaskTool } from './complete-task.js';
import { registerDeleteTaskTool } from './delete-task.js';
import { registerDeleteTasksTool } from './delete-tasks.js';

// Subtask management tools
import { registerAddSubtaskTool } from './add-subtask.js';
import { registerGetSubtasksTool } from './get-subtasks.js';

// Windsurf integration tools
import { registerAssignToWindsurfTool } from './assign-to-windsurf.js';
import { registerUpdateWindsurfProgressTool } from './update-windsurf-progress.js';
import { registerGetWindsurfTasksTool } from './get-windsurf-tasks.js';
import { registerDisplayTaskStatusTool } from './display-task-status.js';

// Task maintenance tools
import { registerCleanupTasksTool } from './cleanup-tasks.js';
import { registerGetProjectsTool } from './get-projects.js';

// Context awareness tools
import { registerGetHelpTool } from './get-help.js';

/**
 * Register all task management tools with the MCP server
 * @param {Object} server - FastMCP server instance
 * @param {Object} taskManager - Task manager instance
 */
export function registerTaskTools(server, taskManager) {
    try {
        // Register each tool with access to the task manager
        registerCreateTaskTool(server, taskManager);
        registerListTasksTool(server, taskManager);
        registerUpdateTaskTool(server, taskManager);
        registerCompleteTaskTool(server, taskManager);
        registerDeleteTaskTool(server, taskManager);
        registerDeleteTasksTool(server, taskManager);
        
        // Register subtask management tools
        registerAddSubtaskTool(server, taskManager);
        registerGetSubtasksTool(server, taskManager);
        
        // Register Windsurf integration tools
        registerAssignToWindsurfTool(server, taskManager);
        registerUpdateWindsurfProgressTool(server, taskManager);
        registerGetWindsurfTasksTool(server, taskManager);
        registerDisplayTaskStatusTool(server, taskManager);
        
        // Register task maintenance tools
        registerCleanupTasksTool(server, taskManager);
        
        // Add explicit logging for get_projects tool registration
        console.error('About to register get_projects tool');
        try {
            registerGetProjectsTool(server, taskManager);
            console.error('Successfully registered get_projects tool');
        } catch (error) {
            console.error(`Error registering get_projects tool: ${error.message}`);
        }
        
        // Add explicit logging for get_help tool registration
        console.error('About to register get_help tool');
        try {
            registerGetHelpTool(server, taskManager);
            console.error('Successfully registered get_help tool');
        } catch (error) {
            console.error(`Error registering get_help tool: ${error.message}`);
        }

        console.error('All task management tools registered successfully (including context awareness)');
    } catch (error) {
        console.error(`Error registering task tools: ${error.message}`);
        throw error;
    }
}

export default {
    registerTaskTools,
    registerGetProjectsTool,
    registerGetHelpTool
};
