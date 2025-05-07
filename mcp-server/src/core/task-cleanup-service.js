/**
 * Task Cleanup Service
 * 
 * Automatically cleans up tasks based on configured rules.
 * Runs as a hook after task operations to maintain a clean task structure.
 */

import { getProjectConfig } from '../config/task-cleanup-config.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

class TaskCleanupService {
  /**
   * Initialize the Task Cleanup Service
   * @param {Object} taskManager - Instance of TaskManager
   */
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.hookRegistered = false;
    this.llmApiEndpoint = process.env.WINDSURF_LLM_API_ENDPOINT || 'http://localhost:3001/api/similarity';
    this.llmApiKey = process.env.WINDSURF_LLM_API_KEY;
  }

  /**
   * Register hooks with the TaskManager
   */
  registerHooks() {
    if (this.hookRegistered) return;

    // Hook into task completion
    const originalCompleteTask = this.taskManager.completeTask;
    this.taskManager.completeTask = async (id, projectId) => {
      const result = await originalCompleteTask.call(this.taskManager, id, projectId);
      await this.handleTaskCompletion(id, projectId, result);
      return result;
    };

    // Hook into progress update
    const originalUpdateWindsurfTaskProgress = this.taskManager.updateWindsurfTaskProgress;
    this.taskManager.updateWindsurfTaskProgress = async (id, progress, projectId) => {
      const result = await originalUpdateWindsurfTaskProgress.call(this.taskManager, id, progress, projectId);
      
      // Check if progress is 100% to trigger cleanup
      if (progress === 100) {
        await this.handleTaskCompletion(id, projectId, result);
      }
      
      return result;
    };

    this.hookRegistered = true;
    logger.info('Task Cleanup Service: Hooks registered successfully');
  }

  /**
   * Handle task completion event
   * @param {number} taskId - ID of the completed task
   * @param {string} projectId - Project identifier
   * @param {Object} taskData - Task data
   */
  async handleTaskCompletion(taskId, projectId, taskData) {
    const config = getProjectConfig(projectId);
    
    // Check if cleanup is enabled and should be triggered on completion
    if (!config.enabled || !config.triggers.onTaskCompletion) {
      return;
    }

    // Check if task reached the completion threshold
    if (config.triggers.onTaskCompletionThreshold && taskData.progress < config.triggers.onTaskCompletionThreshold) {
      return;
    }

    logger.info(`Task Cleanup Service: Running cleanup after task #${taskId} completion in project ${projectId}`);
    
    try {
      await this.performCleanup(projectId);
    } catch (error) {
      logger.error(`Task Cleanup Service: Error during cleanup: ${error.message}`, { error });
    }
  }

  /**
   * Perform cleanup operations on a project
   * @param {string} projectId - Project identifier
   */
  async performCleanup(projectId) {
    const config = getProjectConfig(projectId);
    const tasks = await this.taskManager.listTasks(projectId);
    
    if (!tasks || tasks.length === 0) {
      logger.info(`Task Cleanup Service: No tasks found in project ${projectId}`);
      return;
    }

    let cleanupActions = [];
    let tasksModified = false;

    // Perform cleanup operations based on configuration
    if (config.operations.metadataConsistency.enabled) {
      const metadataActions = await this.ensureMetadataConsistency(tasks, projectId, config);
      cleanupActions = [...cleanupActions, ...metadataActions];
      tasksModified = tasksModified || metadataActions.length > 0;
    }

    if (config.operations.orphanedSubtasks.enabled) {
      const orphanActions = await this.handleOrphanedSubtasks(tasks, projectId, config);
      cleanupActions = [...cleanupActions, ...orphanActions];
      tasksModified = tasksModified || orphanActions.length > 0;
    }

    if (config.operations.qualityEnforcement.enabled) {
      const qualityActions = await this.enforceTaskQuality(tasks, projectId, config);
      cleanupActions = [...cleanupActions, ...qualityActions];
      tasksModified = tasksModified || qualityActions.length > 0;
    }

    if (config.operations.detectDuplicates.enabled) {
      const duplicateActions = await this.detectAndHandleDuplicates(tasks, projectId, config);
      cleanupActions = [...cleanupActions, ...duplicateActions];
      tasksModified = tasksModified || duplicateActions.length > 0;
    }

    // Reorganize task IDs if needed and enabled
    if (tasksModified && config.operations.reorganizeTaskIds.enabled) {
      const reorganizeActions = await this.reorganizeTaskIds(projectId, config);
      cleanupActions = [...cleanupActions, ...reorganizeActions];
    }

    // Log cleanup actions
    if (config.logging.logCleanupActions && cleanupActions.length > 0) {
      logger.info(`Task Cleanup Service: Performed ${cleanupActions.length} cleanup actions in project ${projectId}`);
      
      if (config.logging.detailedLogs) {
        cleanupActions.forEach(action => {
          logger.info(`Task Cleanup Action: ${action.type} - ${action.description}`);
        });
      }
    }

    return cleanupActions;
  }

  /**
   * Ensure metadata consistency across tasks
   * @param {Array} tasks - List of tasks
   * @param {string} projectId - Project identifier
   * @param {Object} config - Cleanup configuration
   * @returns {Array} - List of cleanup actions performed
   */
  async ensureMetadataConsistency(tasks, projectId, config) {
    const actions = [];
    const metadataConfig = config.operations.metadataConsistency;

    for (const task of tasks) {
      let taskUpdated = false;
      const updates = {};

      // Ensure completed tasks have completedAt timestamp
      if (metadataConfig.ensureCompletedTimestamp && 
          task.status === 'completed' && 
          !task.completedAt) {
        updates.completedAt = task.updatedAt || new Date().toISOString();
        taskUpdated = true;
        actions.push({
          type: 'metadata_fix',
          description: `Added missing completedAt timestamp to task #${task.id}`
        });
      }

      // Ensure progress matches status
      if (metadataConfig.validateStatusProgress) {
        if (task.status === 'completed' && task.progress !== 100) {
          updates.progress = 100;
          taskUpdated = true;
          actions.push({
            type: 'metadata_fix',
            description: `Updated progress to 100% for completed task #${task.id}`
          });
        } else if (task.status === 'pending' && task.progress > 0) {
          updates.progress = 0;
          taskUpdated = true;
          actions.push({
            type: 'metadata_fix',
            description: `Reset progress to 0% for pending task #${task.id}`
          });
        }
      }

      // Ensure assigned tasks have assignedAt timestamp
      if (metadataConfig.validateAssignedFields && 
          task.assignedTo && 
          !task.assignedAt) {
        updates.assignedAt = task.updatedAt || new Date().toISOString();
        taskUpdated = true;
        actions.push({
          type: 'metadata_fix',
          description: `Added missing assignedAt timestamp to task #${task.id}`
        });
      }

      // Apply updates if needed
      if (taskUpdated) {
        await this.taskManager.updateTask(task.id, updates, projectId);
      }
    }

    return actions;
  }

  /**
   * Handle orphaned subtasks
   * @param {Array} tasks - List of tasks
   * @param {string} projectId - Project identifier
   * @param {Object} config - Cleanup configuration
   * @returns {Array} - List of cleanup actions performed
   */
  async handleOrphanedSubtasks(tasks, projectId, config) {
    const actions = [];
    const orphanConfig = config.operations.orphanedSubtasks;
    
    // Build a map of parent tasks
    const parentTaskMap = new Map();
    tasks.forEach(task => {
      if (!task.isSubtask) {
        parentTaskMap.set(task.id, task);
      }
    });
    
    // Find orphaned subtasks
    const orphanedSubtasks = tasks.filter(task => 
      task.isSubtask && 
      !this.hasValidParent(task, tasks)
    );
    
    if (orphanedSubtasks.length === 0) {
      return actions;
    }
    
    // Handle each orphaned subtask
    for (const subtask of orphanedSubtasks) {
      switch (orphanConfig.action) {
        case 'delete':
          await this.taskManager.deleteTask(subtask.id, projectId, false);
          actions.push({
            type: 'orphan_delete',
            description: `Deleted orphaned subtask #${subtask.id}: "${subtask.title}"`
          });
          break;
          
        case 'convert':
          // Convert to regular task
          await this.taskManager.updateTask(subtask.id, { 
            isSubtask: false 
          }, projectId);
          actions.push({
            type: 'orphan_convert',
            description: `Converted orphaned subtask #${subtask.id} to regular task`
          });
          break;
          
        case 'reassign':
        default:
          // Find a suitable parent task or use the specified one
          let parentId = orphanConfig.reassignToTaskId;
          
          if (!parentId) {
            // Auto-select a parent task (e.g., the first non-subtask)
            const potentialParents = Array.from(parentTaskMap.values())
              .filter(task => task.status !== 'completed');
              
            if (potentialParents.length > 0) {
              parentId = potentialParents[0].id;
            } else if (parentTaskMap.size > 0) {
              // If no active parent tasks, use any parent task
              parentId = Array.from(parentTaskMap.keys())[0];
            }
          }
          
          if (parentId) {
            // Update the parent task's subtasks array
            const parentTask = parentTaskMap.get(parentId);
            const updatedSubtasks = [...(parentTask.subtasks || []), subtask.id];
            
            await this.taskManager.updateTask(parentId, { 
              subtasks: updatedSubtasks 
            }, projectId);
            
            actions.push({
              type: 'orphan_reassign',
              description: `Reassigned orphaned subtask #${subtask.id} to parent task #${parentId}`
            });
          } else {
            // If no parent task available, convert to regular task
            await this.taskManager.updateTask(subtask.id, { 
              isSubtask: false 
            }, projectId);
            
            actions.push({
              type: 'orphan_convert',
              description: `Converted orphaned subtask #${subtask.id} to regular task (no suitable parent found)`
            });
          }
          break;
      }
    }
    
    return actions;
  }

  /**
   * Check if a subtask has a valid parent
   * @param {Object} subtask - Subtask to check
   * @param {Array} allTasks - All tasks in the project
   * @returns {boolean} - Whether the subtask has a valid parent
   */
  hasValidParent(subtask, allTasks) {
    if (!subtask.isSubtask) return true;
    
    // Find a parent task that includes this subtask in its subtasks array
    return allTasks.some(task => 
      !task.isSubtask && 
      task.subtasks && 
      task.subtasks.includes(subtask.id)
    );
  }

  /**
   * Enforce task quality standards
   * @param {Array} tasks - List of tasks
   * @param {string} projectId - Project identifier
   * @param {Object} config - Cleanup configuration
   * @returns {Array} - List of cleanup actions performed
   */
  async enforceTaskQuality(tasks, projectId, config) {
    const actions = [];
    const qualityConfig = config.operations.qualityEnforcement;
    
    for (const task of tasks) {
      const qualityIssues = [];
      
      // Check title length
      if (qualityConfig.minTitleLength > 0 && 
          (!task.title || task.title.length < qualityConfig.minTitleLength)) {
        qualityIssues.push('title too short');
      }
      
      // Check description length
      if (qualityConfig.minDescriptionLength > 0 && 
          (!task.description || task.description.length < qualityConfig.minDescriptionLength)) {
        qualityIssues.push('description too short');
      }
      
      // Check priority
      if (qualityConfig.requirePriority && !task.priority) {
        qualityIssues.push('missing priority');
      }
      
      if (qualityIssues.length === 0) continue;
      
      // Handle quality issues based on configured action
      switch (qualityConfig.action) {
        case 'delete':
          await this.taskManager.deleteTask(task.id, projectId, false);
          actions.push({
            type: 'quality_delete',
            description: `Deleted low-quality task #${task.id} (issues: ${qualityIssues.join(', ')})`
          });
          break;
          
        case 'fix':
          const updates = {};
          
          // Fix title if needed
          if (qualityIssues.includes('title too short')) {
            updates.title = task.title 
              ? `${task.title} (expanded)` 
              : `Task ${task.id}`;
          }
          
          // Fix description if needed
          if (qualityIssues.includes('description too short')) {
            updates.description = task.description 
              ? `${task.description} (This description was automatically expanded to meet quality standards)` 
              : `Task ${task.id} created at ${task.createdAt}`;
          }
          
          // Fix priority if needed
          if (qualityIssues.includes('missing priority')) {
            updates.priority = 'medium';
          }
          
          await this.taskManager.updateTask(task.id, updates, projectId);
          actions.push({
            type: 'quality_fix',
            description: `Fixed low-quality task #${task.id} (issues: ${qualityIssues.join(', ')})`
          });
          break;
          
        case 'flag':
        default:
          // Just log the issue
          actions.push({
            type: 'quality_flag',
            description: `Flagged low-quality task #${task.id} (issues: ${qualityIssues.join(', ')})`
          });
          break;
      }
    }
    
    return actions;
  }

  /**
   * Detect and handle duplicate tasks using LLM for similarity detection
   * @param {Array} tasks - List of tasks
   * @param {string} projectId - Project identifier
   * @param {Object} config - Cleanup configuration
   * @returns {Array} - List of cleanup actions performed
   */
  async detectAndHandleDuplicates(tasks, projectId, config) {
    const actions = [];
    const duplicateConfig = config.operations.detectDuplicates;
    
    // Skip if no tasks or only one task
    if (!tasks || tasks.length <= 1) {
      return actions;
    }
    
    // Limit the number of tasks to compare
    const tasksToCompare = tasks.slice(0, duplicateConfig.maxTasksToCompare);
    
    // Group tasks by similarity
    const similarityGroups = await this.findSimilarTasks(tasksToCompare, duplicateConfig);
    
    // Process each group of similar tasks
    for (const group of similarityGroups) {
      if (group.length <= 1) continue;
      
      // Sort tasks by creation date (oldest first)
      group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Keep the oldest task, delete or merge the others
      const taskToKeep = group[0];
      const tasksToRemove = group.slice(1);
      
      for (const taskToRemove of tasksToRemove) {
        // If the task to remove has subtasks, reassign them to the task to keep
        if (taskToRemove.subtasks && taskToRemove.subtasks.length > 0) {
          const updatedSubtasks = [
            ...(taskToKeep.subtasks || []), 
            ...taskToRemove.subtasks
          ];
          
          await this.taskManager.updateTask(taskToKeep.id, { 
            subtasks: updatedSubtasks 
          }, projectId);
          
          actions.push({
            type: 'duplicate_subtask_transfer',
            description: `Transferred ${taskToRemove.subtasks.length} subtasks from task #${taskToRemove.id} to task #${taskToKeep.id}`
          });
        }
        
        // Delete the duplicate task
        await this.taskManager.deleteTask(taskToRemove.id, projectId, false);
        
        actions.push({
          type: 'duplicate_delete',
          description: `Deleted duplicate task #${taskToRemove.id} (similar to task #${taskToKeep.id})`
        });
      }
    }
    
    return actions;
  }

  /**
   * Find similar tasks using LLM or text similarity
   * @param {Array} tasks - List of tasks to compare
   * @param {Object} config - Duplicate detection configuration
   * @returns {Array} - Groups of similar tasks
   */
  async findSimilarTasks(tasks, config) {
    if (config.useLLM && this.llmApiKey) {
      return this.findSimilarTasksWithLLM(tasks, config);
    } else {
      return this.findSimilarTasksWithTextSimilarity(tasks, config);
    }
  }

  /**
   * Find similar tasks using Windsurf LLM API
   * @param {Array} tasks - List of tasks to compare
   * @param {Object} config - Duplicate detection configuration
   * @returns {Array} - Groups of similar tasks
   */
  async findSimilarTasksWithLLM(tasks, config) {
    try {
      // Prepare task texts for comparison
      const taskTexts = tasks.map(task => {
        let text = '';
        
        if (config.considerTitle && task.title) {
          text += task.title;
        }
        
        if (config.considerDescription && task.description) {
          text += ' ' + task.description;
        }
        
        return text;
      });
      
      // Call Windsurf LLM API for similarity detection
      const response = await axios.post(this.llmApiEndpoint, {
        texts: taskTexts,
        threshold: config.similarityThreshold,
        apiKey: this.llmApiKey
      });
      
      if (!response.data || !response.data.similarityGroups) {
        logger.error('Task Cleanup Service: Invalid response from LLM API');
        return [];
      }
      
      // Convert group indices to actual task objects
      return response.data.similarityGroups.map(group => 
        group.map(index => tasks[index])
      );
    } catch (error) {
      logger.error(`Task Cleanup Service: Error using LLM for similarity detection: ${error.message}`, { error });
      
      // Fall back to text similarity
      return this.findSimilarTasksWithTextSimilarity(tasks, config);
    }
  }

  /**
   * Find similar tasks using basic text similarity
   * @param {Array} tasks - List of tasks to compare
   * @param {Object} config - Duplicate detection configuration
   * @returns {Array} - Groups of similar tasks
   */
  findSimilarTasksWithTextSimilarity(tasks, config) {
    const similarityGroups = [];
    const processedIndices = new Set();
    
    // Helper function to calculate similarity between two strings
    const calculateSimilarity = (str1, str2) => {
      if (!str1 || !str2) return 0;
      
      // Normalize strings if needed
      if (config.ignoreCase) {
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();
      }
      
      if (config.ignoreWhitespace) {
        str1 = str1.replace(/\s+/g, ' ').trim();
        str2 = str2.replace(/\s+/g, ' ').trim();
      }
      
      // Simple Jaccard similarity for words
      const words1 = new Set(str1.split(/\s+/));
      const words2 = new Set(str2.split(/\s+/));
      
      const intersection = new Set([...words1].filter(word => words2.has(word)));
      const union = new Set([...words1, ...words2]);
      
      return intersection.size / union.size;
    };
    
    // Helper function to get task text for comparison
    const getTaskText = (task) => {
      let text = '';
      
      if (config.considerTitle && task.title) {
        text += task.title;
      }
      
      if (config.considerDescription && task.description) {
        text += ' ' + task.description;
      }
      
      return text;
    };
    
    // Compare each task with every other task
    for (let i = 0; i < tasks.length; i++) {
      if (processedIndices.has(i)) continue;
      
      const group = [tasks[i]];
      processedIndices.add(i);
      
      const taskText1 = getTaskText(tasks[i]);
      
      for (let j = i + 1; j < tasks.length; j++) {
        if (processedIndices.has(j)) continue;
        
        const taskText2 = getTaskText(tasks[j]);
        const similarity = calculateSimilarity(taskText1, taskText2);
        
        if (similarity >= config.similarityThreshold) {
          group.push(tasks[j]);
          processedIndices.add(j);
        }
      }
      
      if (group.length > 1) {
        similarityGroups.push(group);
      }
    }
    
    return similarityGroups;
  }

  /**
   * Reorganize task IDs to maintain sequential ordering
   * @param {string} projectId - Project identifier
   * @param {Object} config - Cleanup configuration
   * @returns {Array} - List of cleanup actions performed
   */
  async reorganizeTaskIds(projectId, config) {
    if (!config.operations.reorganizeTaskIds.enabled) {
      return [];
    }
    
    try {
      // Get all tasks for the project
      const tasks = await this.taskManager.listTasks(projectId);
      
      // Call the TaskManager's reorganizeTaskIds method
      await this.taskManager.reorganizeTaskIds(tasks, projectId);
      
      return [{
        type: 'reorganize_ids',
        description: `Reorganized task IDs for project ${projectId}`
      }];
    } catch (error) {
      logger.error(`Task Cleanup Service: Error reorganizing task IDs: ${error.message}`, { error });
      return [];
    }
  }
}

export default TaskCleanupService;
