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
                'best-practices',
                'task-hierarchy'
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
        'task-hierarchy': `
🏗️ **Task Hierarchy - Avoiding the Turtleneck Pattern:**

**What is the turtleneck pattern?**
• One giant parent task with many subtasks
• Creates bottlenecks in workflow
• Poor visibility of progress across domains
• Difficult to parallelize work

**Benefits of balanced task hierarchy:**
• Multiple parent tasks organized by domain (backend, frontend, etc.)
• Better progress visibility across project areas
• Easier to work on multiple areas simultaneously
• Clearer dependencies between functional domains
• Matches real development workflows

**How to create balanced task structure:**
1. Use the suggest_project_structure tool to analyze your project
2. Review the suggested structure
3. Create the structure automatically or manually
4. Assign tasks to appropriate team members

**Commands:**
• Analyze only: \`mcp1_suggest_project_structure({description: "...", projectId: "...", structureOnly: true})\`
• Create structure: \`mcp1_suggest_project_structure({description: "...", projectId: "...", autoCreate: true})\`
`,
        'starting-new-project': `
🚀 **Starting a New Project - Quick Guide:**

**Step 1: Create Foundation Tasks**
• Project setup and configuration
• Environment setup (dependencies, tools)
• Basic structure/scaffolding

**Step 2: Plan Task Structure**
• Break down by functional areas
• Set clear dependencies
• Prioritize critical path items

**Step 3: Assign Initial Tasks**
• Start with setup/configuration
• Use Windsurf for automation tasks
• Track progress with status updates

**Commands:**
\`\`\`
// Create project with balanced structure
mcp1_suggest_project_structure({
  description: "Detailed project description",
  projectId: "your-project-id",
  autoCreate: true
})

// Assign first task to Windsurf
mcp1_assign_to_windsurf({
  id: 1, 
  projectId: "your-project-id"
})

// Check progress
mcp1_display_task_status({
  projectId: "your-project-id"
})
\`\`\`

**Pro Tip:** The system now auto-suggests priorities and acceptance criteria!`,

        'task-too-big': `
📏 **Task Too Large? Break It Down:**

**Signs a task is too big:**
• Implementation would take more than a few hours
• Requires work across multiple domains (frontend, backend, etc.)
• Has many distinct acceptance criteria
• Feels overwhelming or unclear where to start
• Shows a "turtleneck pattern" with too many subtasks

**How to break it down:**
1. Use the suggest_project_structure tool to analyze and create a balanced hierarchy
2. Create multiple parent tasks organized by domain (backend, frontend, etc.)
3. Make each subtask focused on a single goal
4. Add clear acceptance criteria to each subtask
5. Prioritize subtasks and set dependencies

**Commands:**
• Analyze project: \`mcp1_suggest_project_structure({description: "...", projectId: "..."})\`
• Create balanced structure: \`mcp1_suggest_project_structure({description: "...", projectId: "...", autoCreate: true})\`
• Add subtask manually: \`mcp1_add_subtask({title: "...", description: "...", parentTaskId: 1, projectId: "..."})\`
• Update task: \`mcp1_update_task({id: 1, description: "Updated description", projectId: "..."})\`

**See also:** Use \`mcp1_get_help({situation: "task-hierarchy", projectId: "..."})\` for detailed guidance on balanced task structures.
`,

        'stuck-on-task': `
🔧 **Stuck on a Task? Try These:**

**1. Check Dependencies**
• Are prerequisite tasks actually complete?
• Do you have all required information?

**2. Break Down Further**
• Is the task still too large/complex?
• Can you create smaller subtasks?

**3. Reassign or Get Help**
• Is this task better suited for someone else?
• Would pair programming help?

**4. Document Blockers**
• Update task description with blockers
• Add comments about attempted solutions

**Commands:**
\`\`\`
// Add subtask for smaller piece
mcp1_add_subtask({
  parentTaskId: 5,
  title: "Specific part I can complete",
  projectId: "your-project"
})

// Document a blocker
mcp1_update_task({
  id: 5,
  description: "Original description\\n\\nBLOCKER: Specific issue...",
  projectId: "your-project"
})
\`\`\``,

        'project-status': `
📊 **Project Status & Progress:**

**Key Metrics:**
• Completion rate (tasks completed / total)
• Tasks by status (pending, in-progress, completed)
• Tasks by assignee (you, Windsurf, unassigned)
• Blocked tasks and dependencies

**Visualizing Progress:**
• Use display_task_status for overview
• Check subtask completion for complex tasks
• Review task dependencies for bottlenecks

**Commands:**
\`\`\`
// Get full project status
mcp1_display_task_status({
  projectId: "your-project"
})

// List tasks by status
mcp1_list_tasks({
  projectId: "your-project",
  status: "in-progress" // or "pending", "completed", "all"
})

// Check tasks assigned to Windsurf
mcp1_get_windsurf_tasks({
  projectId: "your-project"
})
\`\`\``,

        'best-practices': `
✨ **Task Management Best Practices:**

**Task Creation:**
• Use clear, action-oriented titles
• Include specific acceptance criteria
• Set realistic priorities
• Establish proper dependencies

**Task Workflow:**
• Update progress regularly
• Only mark 100% when completely done
• Document blockers and solutions

**Workflow Optimization:**
• Work on high-priority tasks first
• Complete dependencies before dependent tasks
• Use subtasks for complex features
• Let the system auto-cleanup and organize

**Balanced Task Structure:**
• Create multiple parent tasks by domain
• Avoid the "turtleneck pattern" (one parent with many subtasks)
• Use suggest_project_structure for optimal organization
• See \`mcp1_get_help({situation: "task-hierarchy"})\` for more details
`
    };

    return helpTexts[situation] || 'Help topic not found. Available topics: starting-new-project, task-too-big, stuck-on-task, project-status, best-practices, task-hierarchy';
}

/**
 * Get project-specific context for help content
 * @param {Object} taskManager - Task manager instance
 * @param {string} projectId - Project ID
 * @returns {string} Project-specific context
 */
async function getProjectContext(taskManager, projectId) {
    try {
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

        // Check for turtleneck pattern
        const parentTasks = tasks.filter(t => !t.isSubtask);
        if (parentTasks.length === 1 && tasks.length > 4) {
            context += `\n\n⚠️ **Turtleneck Pattern Detected:** This project has a single parent task with multiple subtasks.`;
            context += `\n💡 **Suggestion:** Consider using \`mcp1_suggest_project_structure({description: "...", projectId: "${projectId}", autoCreate: true})\` to create a more balanced task hierarchy.`;
        }

        return context;

    } catch (error) {
        logger.error('Error getting project context:', error);
        return `\n\n📁 **Project "${projectId}":** Unable to load project context.`;
    }
}