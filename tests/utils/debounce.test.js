import { jest } from '@jest/globals';
import { Debouncer } from '../../mcp-server/src/utils/debounce.js';

describe('Debouncer', () => {
    let debouncer;

    beforeEach(() => {
        debouncer = new Debouncer();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should debounce function calls', async () => {
        const mockFn = jest.fn().mockResolvedValue('result');
        const key = 'test-key';
        const delay = 1000;

        // First call
        const promise1 = debouncer.debounce(key, mockFn, delay);
        
        // Function should not be called immediately
        expect(mockFn).not.toHaveBeenCalled();
        
        // Second call within delay period
        const promise2 = debouncer.debounce(key, mockFn, delay);
        
        // Advance timer past delay
        jest.advanceTimersByTime(delay + 100);
        
        // Resolve pending promises
        await Promise.all([promise1, promise2]);
        
        // Function should be called exactly once
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should execute different keys independently', async () => {
        const mockFn1 = jest.fn().mockResolvedValue('result1');
        const mockFn2 = jest.fn().mockResolvedValue('result2');
        const delay = 1000;

        // Call with first key
        const promise1 = debouncer.debounce('key1', mockFn1, delay);
        
        // Call with second key
        const promise2 = debouncer.debounce('key2', mockFn2, delay);
        
        // Advance timer past delay
        jest.advanceTimersByTime(delay + 100);
        
        // Resolve pending promises
        await Promise.all([promise1, promise2]);
        
        // Both functions should be called once
        expect(mockFn1).toHaveBeenCalledTimes(1);
        expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    test('should return the result of the debounced function', async () => {
        const mockFn = jest.fn().mockResolvedValue('expected result');
        const key = 'test-key';
        const delay = 1000;

        const promise = debouncer.debounce(key, mockFn, delay);
        
        // Advance timer past delay
        jest.advanceTimersByTime(delay + 100);
        
        // Result should match the mock function's return value
        const result = await promise;
        expect(result).toBe('expected result');
    });
});
