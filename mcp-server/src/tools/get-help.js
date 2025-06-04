import { z } from 'zod';
import { createErrorHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Contextual help system that provides situation-specific guidance
 */
export function registerGetHelpTool(server, taskManager) {
    server.addTool({
        name: 'get_help',
        description: 'Get contextual help and workflow guidance for efficient task management',
        parameters: z.object({
            situation: z.enum([
                'starting-new-project',
                'task-too-big', 
                'stuck-on-task',
                'project-status',
                'best-practices'
            ]).describe('What situation you need help with'),
            projectId: z.string().optional().describe('Project ID for context-specific help')
        }),
        execute: async (args) => {
            const errorHandler = createErrorHandler('get_help');
            try {
                let helpContent = getHelpContent(args.situation);
                
                // Add project-specific context if projectId is provided
                if (args.projectId) {
                    const projectContext = await getProjectContext(taskManager, args.projectId);
                    helpContent += projectContext;
                }
                
                return {
                    content: [{
                        type: 'text',
                        text: helpContent
                    }]
                };
            } catch (error) {
                return errorHandler(error, args);
            }
        }
    });
}

/**
 * Get help content based on situation
 * @param {string} situation - The situation the user needs help with
 * @returns {string} Formatted help content
 */
function getHelpContent(situation) {
    const helpTexts = {
        'starting-new-project': `
🚀 **Starting a New Project - Quick Guide:**

**Step 1: Create Foundation Tasks**
• Project setup and configuration
• Environment setup (dependencies, tools)
• Basic structure/scaffolding

**Step 2: Plan Your Workflow**
• Break features into 2-4 hour tasks
• Use dependencies to enforce order
• Set priorities: high (urgent), medium (normal), low (cleanup/docs)

**Step 3: Start Implementation**
• Assign first task: \`mcp1_assign_to_windsurf({id: 1, projectId: "your-project"})\`
• Track progress with updates

**Pro Tip:** The system now auto-suggests priorities and acceptance criteria!`,

        'task-too-big': `
📏 **Task Too Large? Break It Down:**

**The 4-Hour Rule:** If a task takes >4 hours, split it up

**Common Breakdown Patterns:**
• **Setup → Implementation → Testing → Documentation**
• **Frontend → Backend → Integration**  
• **Design → Code → Review → Deploy**

**Use Subtasks:**
\`\`\`
mcp1_add_subtask({
  parentTaskId: 1,
  title: "Specific smaller task",
  description: "Clear, focused objective",
  projectId: "your-project"
})
\`\`\`

**Benefits:** Better progress tracking, clearer milestones, easier debugging`,

        'stuck-on-task': `
🔧 **Stuck on a Task? Try These:**

**1. Check Dependencies**
• Are prerequisite tasks actually complete?
• Do you have all required information?

**2. Update Task with Blockers**
\`\`\`
mcp1_update_task({
  id: taskId,
  description: "Original description + BLOCKER: specific issue",
  projectId: "your-project"
})
\`\`\`

**3. Break It Smaller**
• What's the smallest next step you can take?
• Create a subtask for just that step

**4. Change Approach**
• Is there a different way to solve this?
• Can you implement a simpler version first?`,

        'project-status': `
📊 **Check Your Project Status:**

**Quick Status Check:**
\`mcp1_display_task_status({projectId: "your-project"})\`

**See Your Assigned Tasks:**
\`mcp1_get_windsurf_tasks({projectId: "your-project"})\`

**Review All Tasks:**
\`mcp1_list_tasks({projectId: "your-project", status: "all"})\`

**Clean Up Project:**
\`mcp1_cleanup_tasks({projectId: "your-project"})\`

**Progress Tracking:**
• Update progress: 25% → 50% → 75% → 100%
• Mark complete when fully done
• The system auto-cleans up at 100%`,

        'best-practices': `
💡 **Task Management Best Practices:**

**Task Creation:**
• Use specific, actionable titles
• Include clear acceptance criteria  
• Set realistic priorities
• Link dependencies properly

**Project Organization:**
• Use lowercase, hyphenated project IDs ("user-auth-system")
• Group related tasks in same project
• Keep projects focused on single objectives

**Progress Tracking:**
• Update at meaningful milestones (25%, 50%, 75%, 100%)
• Only mark 100% when completely done
• Document blockers and solutions

**Workflow Optimization:**
• Work on high-priority tasks first
• Complete dependencies before dependent tasks
• Use subtasks for complex features
• Let the system auto-cleanup and organize`
    };

    return helpTexts[situation] || 'Help topic not found. Available topics: starting-new-project, task-too-big, stuck-on-task, project-status, best-practices';
}

/**
 * Get project-specific context information
 * @param {Object} taskManager - Task manager instance
 * @param {string} projectId - Project ID
 * @returns {string} Project context information
 */
async function getProjectContext(taskManager, projectId) {
    try {
        // Validate if projectId exists and if getTasks method exists
        if (!projectId) {
            logger.warn('No project ID provided for context');
            return '\n\n📁 **Project Context:** No project ID provided.';
        }
        
        // Check if the listTasks method exists on taskManager
        if (typeof taskManager.listTasks !== 'function') {
            logger.error('taskManager.listTasks is not a function');
            return `\n\n📁 **Project "${projectId}":** Unable to retrieve tasks. Internal error.`;
        }
        
        // Check if project exists by trying to get its tasks
        const tasks = await taskManager.listTasks(projectId);
        
        if (!tasks || tasks.length === 0) {
            return `\n\n📁 **Project "${projectId}":** No tasks found. This might be a new project!`;
        }

        const completed = tasks.filter(t => t.status === 'completed').length;
        const inProgress = tasks.filter(t => t.status === 'in-progress').length;
        const pending = tasks.filter(t => t.status === 'pending').length;
        const total = tasks.length;
        const completionRate = Math.round((completed / total) * 100);

        const windsurfTasks = tasks.filter(t => t.assignedTo === 'windsurf');

        let context = `\n\n📁 **Your Project "${projectId}" Status:**`;
        context += `\n• Progress: ${completed}/${total} tasks completed (${completionRate}%)`;
        context += `\n• Active: ${inProgress} in-progress, ${pending} pending`;

        if (windsurfTasks.length > 0) {
            context += `\n• Windsurf assigned: ${windsurfTasks.length} tasks`;
            const activeWindsurf = windsurfTasks.filter(t => t.status === 'in-progress');
            if (activeWindsurf.length > 0) {
                context += `\n• Currently working on: "${activeWindsurf[0].title}"`;
            }
        }

        // Suggestions based on project state
        if (completionRate === 0) {
            context += `\n\n💡 **Suggestion:** Start by assigning a task to Windsurf!`;
        } else if (completionRate > 80) {
            context += `\n\n🎉 **Great progress!** Consider cleaning up with: \`mcp1_cleanup_tasks({projectId: "${projectId}"})\``;
        } else if (inProgress === 0 && pending > 0) {
            context += `\n\n⏳ **Ready to work:** Assign a pending task to continue progress.`;
        }

        return context;

    } catch (error) {
        logger.error('Error getting project context:', error);
        return `\n\n📁 **Project "${projectId}":** Unable to load project context.`;
    }
}