import { jest } from '@jest/globals';
import { Cache } from '../../mcp-server/src/utils/cache.js';

describe('Cache', () => {
    let cache;

    beforeEach(() => {
        cache = new Cache();
    });

    test('should set and get values correctly', () => {
        cache.set('key1', 'value1');
        expect(cache.get('key1')).toBe('value1');
    });

    test('should return undefined for non-existent keys', () => {
        expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('should clear all values', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.clear();
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBeUndefined();
    });

    test('should delete specific key', () => {
        cache.set('key1', 'value1');
        cache.set('key2', 'value2');
        cache.delete('key1');
        expect(cache.get('key1')).toBeUndefined();
        expect(cache.get('key2')).toBe('value2');
    });

    test('should handle TTL expiration', async () => {
        jest.useFakeTimers();
        cache.set('key1', 'value1', 1000); // 1 second TTL
        expect(cache.get('key1')).toBe('value1');
        
        jest.advanceTimersByTime(1100); // Advance past TTL
        expect(cache.get('key1')).toBeUndefined();
        jest.useRealTimers();
    });
});
