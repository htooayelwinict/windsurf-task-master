import { TaskNotFoundError, TaskStateError } from '../../mcp-server/src/utils/errors.js';

describe('Error Classes', () => {
    describe('TaskNotFoundError', () => {
        test('should create error with correct message and properties', () => {
            const taskId = 123;
            const projectId = 'test-project';
            const error = new TaskNotFoundError(taskId, projectId);

            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain(taskId.toString());
            expect(error.message).toContain(projectId);
            expect(error.taskId).toBe(taskId);
            expect(error.projectId).toBe(projectId);
        });
    });

    describe('TaskStateError', () => {
        test('should create error with correct message and properties', () => {
            const taskId = 123;
            const currentState = 'pending';
            const action = 'complete';
            const error = new TaskStateError(
                'Cannot complete task',
                taskId,
                currentState,
                action
            );

            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Cannot complete task');
            expect(error.taskId).toBe(taskId);
            expect(error.currentState).toBe(currentState);
            expect(error.action).toBe(action);
        });
    });
});
