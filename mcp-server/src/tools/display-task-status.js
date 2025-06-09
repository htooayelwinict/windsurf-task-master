import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { BRANDING, formatBrandedMessage } from '../constants/branding.js';
import { createBrandedSuccessResponse, createBrandedErrorResponse } from '../utils/branding-helper.js';

/**
 * Display task status for Windsurf
 */
export function registerDisplayTaskStatusTool(server, taskManager) {
    server.addTool({
        name: 'display_task_status',
        description: `Display detailed status of tasks for ${BRANDING.PRODUCT_NAME} with completion percentages`,
        parameters: z.object({
            projectId: z.string().optional().describe('Optional project ID to display tasks for a specific project')
        }),
        execute: async (args) => {
            try {
                let allProjects = [];
                let allProjectsData = {};
                
                // If projectId is provided, only show that project
                if (args.projectId) {
                    allProjects = [args.projectId];
                } else {
                    // Otherwise, get all project directories
                    const baseTasksDir = path.join(process.cwd(), 'tasks');
                    try {
                        const entries = await fs.readdir(baseTasksDir, { withFileTypes: true });
                        allProjects = entries
                            .filter(entry => entry.isDirectory())
                            .map(entry => entry.name);
                    } catch (error) {
                        if (error.code !== 'ENOENT') {
                            console.error(formatBrandedMessage(`Error reading projects directory: ${error.message}`, 'error'));
                        }
                        allProjects = [];
                    }
                }
                
                // Process each project
                for (const project of allProjects) {
                    try {
                        // Initialize the task manager for this project
                        await taskManager.init(project);
                        
                        // Get all tasks for the project
                        const tasks = await taskManager.listTasks(project);
                        
                        // Count tasks by status
                        const statusCounts = {
                            pending: 0,
                            'in-progress': 0,
                            completed: 0
                        };
                        
                        tasks.forEach(task => {
                            if (statusCounts[task.status] !== undefined) {
                                statusCounts[task.status]++;
                            }
                        });
                        
                        // Calculate completion percentage
                        const totalTasks = tasks.length;
                        const completedTasks = statusCounts.completed;
                        const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                        
                        // Get Windsurf assigned tasks with progress
                        const windsurfTasks = tasks.filter(task => task.assignedTo === 'windsurf');
                        const windsurfProgress = windsurfTasks.length > 0 ?
                            Math.round(windsurfTasks.reduce((sum, task) => sum + (task.progress || 0), 0) / windsurfTasks.length) : 0;
                        
                        // Store project data
                        allProjectsData[project] = {
                            totalTasks,
                            statusCounts,
                            completionPercentage,
                            windsurfTasks: windsurfTasks.length,
                            windsurfProgress,
                            tasks: tasks.map(task => ({
                                id: task.id,
                                title: task.title,
                                status: task.status,
                                assignedTo: task.assignedTo,
                                progress: task.progress || 0
                            }))
                        };
                    } catch (error) {
                        console.error(`Error processing project ${project}:`, error);
                        allProjectsData[project] = { error: error.message };
                    }
                }
                
                // Calculate overall statistics
                const overallStats = {
                    totalProjects: allProjects.length,
                    totalTasks: 0,
                    completedTasks: 0,
                    inProgressTasks: 0,
                    pendingTasks: 0,
                    overallCompletionPercentage: 0
                };
                
                // Aggregate statistics
                Object.values(allProjectsData).forEach(project => {
                    if (project.totalTasks) {
                        overallStats.totalTasks += project.totalTasks;
                        overallStats.completedTasks += project.statusCounts.completed;
                        overallStats.inProgressTasks += project.statusCounts['in-progress'];
                        overallStats.pendingTasks += project.statusCounts.pending;
                    }
                });
                
                // Calculate overall completion percentage
                overallStats.overallCompletionPercentage = overallStats.totalTasks > 0 ?
                    Math.round((overallStats.completedTasks / overallStats.totalTasks) * 100) : 0;
                
                // Build the status report
                let statusReport = args.projectId 
                    ? `${BRANDING.PRODUCT_NAME_SHORT} Task Status for Project: ${args.projectId}\n` 
                    : `${BRANDING.PRODUCT_NAME_SHORT} Task Status Summary\n`;
                
                statusReport += '===================\n\n';
                statusReport += `Total Projects: ${overallStats.totalProjects}\n`;
                statusReport += `Total Tasks: ${overallStats.totalTasks}\n`;
                statusReport += `Pending: ${overallStats.pendingTasks}\n`;
                statusReport += `In Progress: ${overallStats.inProgressTasks}\n`;
                statusReport += `Completed: ${overallStats.completedTasks}\n`;
                statusReport += `Overall Completion: ${overallStats.overallCompletionPercentage}%\n\n`;
                
                // Add per-project details
                statusReport += 'Project Details:\n';
                statusReport += '----------------\n\n';
                
                for (const [projectId, projectData] of Object.entries(allProjectsData)) {
                    if (projectData.error) {
                        statusReport += `Project ${projectId}: Error - ${projectData.error}\n\n`;
                        continue;
                    }
                    
                    statusReport += `Project: ${projectId}\n`;
                    statusReport += `  Total Tasks: ${projectData.totalTasks}\n`;
                    statusReport += `  Completion: ${projectData.completionPercentage}%\n`;
                    
                    if (projectData.windsurfTasks > 0) {
                        statusReport += `  Windsurf Tasks: ${projectData.windsurfTasks}\n`;
                        statusReport += `  Windsurf Progress: ${projectData.windsurfProgress}%\n`;
                    }
                    
                    // List tasks in progress with progress percentage
                    const inProgressTasks = projectData.tasks.filter(task => task.status === 'in-progress');
                    if (inProgressTasks.length > 0) {
                        statusReport += '\n  In Progress Tasks:\n';
                        inProgressTasks.forEach(task => {
                            const progressInfo = task.progress !== undefined ? ` - Progress: ${task.progress}%` : '';
                            statusReport += `    #${task.id} ${task.title}${progressInfo}\n`;
                        });
                    }
                    
                    statusReport += '\n';
                }
                
                // Add trademark notice
                statusReport += `\n---\n${BRANDING.TRADEMARK_NOTICE}`;
                
                return {
                    content: [{
                        type: 'text',
                        text: statusReport
                    }]
                };
            } catch (error) {
                console.error(formatBrandedMessage(`Error displaying task status: ${error.message}`, 'error'));
                return createBrandedErrorResponse(`Error displaying task status: ${error.message}`);
            }
        }
    });
}
