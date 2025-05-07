/**
 * Tests for the Task Cleanup Service
 */

import { jest } from '@jest/globals';
import TaskCleanupService from '../../mcp-server/src/core/task-cleanup-service.js';
import { TaskManager } from '../../mcp-server/src/core/task-manager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the logger
jest.mock('../../mcp-server/src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock axios for LLM API calls
jest.mock('axios');

describe('TaskCleanupService', () => {
  let taskManager;
  let cleanupService;
  let testProjectId = 'test-cleanup-project';
  let tasksDir;
  
  beforeEach(async () => {
    // Setup test directory
    tasksDir = path.join(__dirname, '../../tasks', testProjectId);
    
    try {
      await fs.mkdir(tasksDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    // Create a fresh TaskManager for each test
    taskManager = new TaskManager();
    await taskManager.init(testProjectId);
    
    // Create the cleanup service
    cleanupService = new TaskCleanupService(taskManager);
    
    // Register hooks
    cleanupService.registerHooks();
  });
  
  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(tasksDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error cleaning up: ${error.message}`);
    }
  });
  
  test('should register hooks with TaskManager', () => {
    // Verify the hooks are registered by checking if the original methods are wrapped
    expect(taskManager.completeTask.toString()).not.toBe(TaskManager.prototype.completeTask.toString());
    expect(taskManager.updateWindsurfTaskProgress.toString()).not.toBe(TaskManager.prototype.updateWindsurfTaskProgress.toString());
  });
  
  test('should fix metadata consistency issues', async () => {
    // Create a task with inconsistent metadata
    const task = await taskManager.createTask({
      title: 'Test Task',
      description: 'This is a test task',
      status: 'completed',
      progress: 75 // Inconsistent with completed status
    }, testProjectId);
    
    // Run cleanup
    await cleanupService.performCleanup(testProjectId);
    
    // Verify the task was fixed
    const updatedTask = await taskManager.listTasks(testProjectId);
    expect(updatedTask[0].progress).toBe(100);
  });
  
  test('should handle orphaned subtasks', async () => {
    // Create a parent task
    const parentTask = await taskManager.createTask({
      title: 'Parent Task',
      description: 'This is a parent task'
    }, testProjectId);
    
    // Create a subtask
    const subtask = await taskManager.addSubtask({
      title: 'Subtask',
      description: 'This is a subtask'
    }, parentTask.id, testProjectId);
    
    // Manually break the parent-child relationship to create an orphaned subtask
    await taskManager.updateTask(parentTask.id, { subtasks: [] }, testProjectId);
    
    // Run cleanup
    await cleanupService.performCleanup(testProjectId);
    
    // Verify the orphaned subtask was handled
    const tasks = await taskManager.listTasks(testProjectId);
    const updatedParent = tasks.find(t => t.id === parentTask.id);
    
    // The subtask should be reassigned to the parent
    expect(updatedParent.subtasks).toContain(subtask.id);
  });
  
  test('should enforce task quality standards', async () => {
    // Create a low-quality task
    const task = await taskManager.createTask({
      title: 'Low', // Too short
      description: 'Short' // Too short
    }, testProjectId);
    
    // Configure the cleanup service to fix quality issues
    const originalConfig = cleanupService.getProjectConfig;
    cleanupService.getProjectConfig = jest.fn().mockReturnValue({
      enabled: true,
      triggers: { onTaskCompletion: true, onTaskCompletionThreshold: 100 },
      operations: {
        metadataConsistency: { enabled: false },
        orphanedSubtasks: { enabled: false },
        reorganizeTaskIds: { enabled: false },
        detectDuplicates: { enabled: false },
        qualityEnforcement: {
          enabled: true,
          minTitleLength: 5,
          minDescriptionLength: 10,
          action: 'fix'
        }
      },
      logging: { logCleanupActions: true, detailedLogs: true }
    });
    
    // Run cleanup
    await cleanupService.performCleanup(testProjectId);
    
    // Restore original config function
    cleanupService.getProjectConfig = originalConfig;
    
    // Verify the task quality was fixed
    const tasks = await taskManager.listTasks(testProjectId);
    expect(tasks[0].title.length).toBeGreaterThan(5);
    expect(tasks[0].description.length).toBeGreaterThan(10);
  });
  
  test('should detect and handle duplicate tasks', async () => {
    // Mock the findSimilarTasks method to simulate finding duplicates
    cleanupService.findSimilarTasks = jest.fn().mockResolvedValue([
      [
        { id: 1, title: 'Original Task', createdAt: '2025-01-01T00:00:00Z', subtasks: [] },
        { id: 2, title: 'Duplicate Task', createdAt: '2025-01-02T00:00:00Z', subtasks: [] }
      ]
    ]);
    
    // Create two similar tasks
    await taskManager.createTask({
      title: 'Original Task',
      description: 'This is the original task'
    }, testProjectId);
    
    await taskManager.createTask({
      title: 'Duplicate Task',
      description: 'This is a duplicate task'
    }, testProjectId);
    
    // Configure the cleanup service to handle duplicates
    const originalConfig = cleanupService.getProjectConfig;
    cleanupService.getProjectConfig = jest.fn().mockReturnValue({
      enabled: true,
      triggers: { onTaskCompletion: true, onTaskCompletionThreshold: 100 },
      operations: {
        metadataConsistency: { enabled: false },
        orphanedSubtasks: { enabled: false },
        reorganizeTaskIds: { enabled: false },
        detectDuplicates: {
          enabled: true,
          useLLM: false,
          similarityThreshold: 0.8
        },
        qualityEnforcement: { enabled: false }
      },
      logging: { logCleanupActions: true, detailedLogs: true }
    });
    
    // Run cleanup
    await cleanupService.performCleanup(testProjectId);
    
    // Restore original config function
    cleanupService.getProjectConfig = originalConfig;
    
    // Verify that only one task remains
    const tasks = await taskManager.listTasks(testProjectId);
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe('Original Task');
  });
  
  test('should trigger cleanup when task progress reaches 100%', async () => {
    // Create a task
    const task = await taskManager.createTask({
      title: 'Test Task',
      description: 'This is a test task'
    }, testProjectId);
    
    // Spy on the performCleanup method
    const performCleanupSpy = jest.spyOn(cleanupService, 'performCleanup');
    
    // Update task progress to 100%
    await taskManager.updateWindsurfTaskProgress(task.id, 100, testProjectId);
    
    // Verify that performCleanup was called
    expect(performCleanupSpy).toHaveBeenCalledWith(testProjectId);
  });
});
