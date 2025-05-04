import { jest } from '@jest/globals';
import { TaskManager } from '../../mcp-server/src/core/task-manager.js';
import { TaskNotFoundError, TaskStateError } from '../../mcp-server/src/utils/errors.js';

describe('TaskManager', () => {
    let taskManager;
    const testProjectId = 'test-project';

    beforeEach(() => {
        jest.clearAllMocks();
        taskManager = new TaskManager();
        // Clear any existing tasks
        taskManager.projectTasks = new Map();
    });

    describe('init', () => {
        test('should initialize task manager with project ID', async () => {
            await expect(taskManager.init(testProjectId)).resolves.not.toThrow();
        });

        test('should throw error when project ID is missing', async () => {
            await expect(taskManager.init()).rejects.toThrow('Project ID is required');
        });
    });

    describe('createTask', () => {
        test('should create a new task', async () => {
            const taskData = {
                title: 'Test Task',
                description: 'Test Description',
                priority: 'medium'
            };

            const task = await taskManager.createTask(taskData, testProjectId);
            expect(task).toMatchObject({
                ...taskData,
                id: expect.any(Number),
                status: 'pending',
                progress: 0,
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            });
        });
    });

    describe('getTasksByStatus', () => {
        test('should return tasks filtered by status', async () => {
            // Directly set up the test data
            const tasks = [
                { id: 1, title: 'Task 1', status: 'pending' },
                { id: 2, title: 'Task 2', status: 'completed' }
            ];
            
            // Manually set the tasks for this test
            taskManager.projectTasks.set(testProjectId, tasks);
            
            // Mock the init method to avoid file system operations
            taskManager.init = jest.fn().mockResolvedValue(undefined);
            
            const pendingTasks = await taskManager.getTasksByStatus('pending', testProjectId);
            expect(pendingTasks).toHaveLength(1);
            expect(pendingTasks[0].title).toBe('Task 1');
        });
    });

    describe('updateWindsurfTaskProgress', () => {
        test('should update task progress', async () => {
            // Set up test data
            const task = { id: 1, title: 'Windsurf Task', assignedTo: 'windsurf', status: 'in-progress' };
            const tasks = [task];
            
            // Set up the task manager
            taskManager.projectTasks.set(testProjectId, tasks);
            taskManager.init = jest.fn().mockResolvedValue(undefined);
            taskManager.saveTasks = jest.fn().mockResolvedValue(undefined);
            
            const updatedTask = await taskManager.updateWindsurfTaskProgress(
                1,
                50,
                testProjectId
            );
            
            expect(updatedTask.progress).toBe(50);
        });
        
        test('should complete task when progress is 100%', async () => {
            // Set up test data
            const task = { id: 1, title: 'Windsurf Task', assignedTo: 'windsurf', status: 'in-progress' };
            const tasks = [task];
            
            // Set up the task manager
            taskManager.projectTasks.set(testProjectId, tasks);
            taskManager.init = jest.fn().mockResolvedValue(undefined);
            taskManager.saveTasks = jest.fn().mockResolvedValue(undefined);
            
            const completedTask = await taskManager.updateWindsurfTaskProgress(
                1,
                100,
                testProjectId
            );
            
            expect(completedTask.status).toBe('completed');
            expect(completedTask.progress).toBe(100);
        });
        
        test('should throw error for non-windsurf task', async () => {
            // Set up test data
            const task = { id: 1, title: 'Regular Task' };
            const tasks = [task];
            
            // Set up the task manager
            taskManager.projectTasks.set(testProjectId, tasks);
            taskManager.init = jest.fn().mockResolvedValue(undefined);
            
            await expect(
                taskManager.updateWindsurfTaskProgress(1, 50, testProjectId)
            ).rejects.toThrow(TaskStateError);
        });
    });
});
