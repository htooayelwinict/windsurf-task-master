/**
 * Cache utility for optimizing data access in the Windsurf Task Master system.
 * 
 * This class provides an in-memory caching mechanism with TTL (time-to-live) expiration,
 * automatic eviction of least recently used items when the cache reaches its size limit,
 * and statistics tracking for monitoring cache performance.
 * 
 * @class
 * @example
 * const cache = new Cache({ ttl: 5000, maxSize: 100 });
 * cache.set('user-123', userData);
 * const user = cache.get('user-123');
 */
export class Cache {
    constructor(options = {}) {
        this.data = new Map();
        this.ttl = options.ttl || 5000; // Default TTL: 5 seconds
        this.maxSize = options.maxSize || 1000; // Default max size: 1000 items
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    /**
     * Get a value from cache if it exists and hasn't expired.
     * This method increments the hits/misses statistics based on the result.
     * 
     * @param {string} key - Cache key to retrieve
     * @returns {any} The cached value if found and not expired, or undefined otherwise
     */
    get(key) {
        const item = this.data.get(key);
        if (!item) {
            this.stats.misses++;
            return undefined;
        }

        if (Date.now() > item.expiry) {
            this.delete(key);
            this.stats.misses++;
            return undefined;
        }

        this.stats.hits++;
        return item.value;
    }

    /**
     * Set a value in cache with an optional custom TTL.
     * If the cache is full (reached maxSize), this method will evict the oldest item
     * before adding the new one to prevent excessive memory usage.
     * 
     * @param {string} key - Cache key to set
     * @param {any} value - Value to store in the cache
     * @param {number} ttl - Optional time-to-live in milliseconds (defaults to this.ttl)
     * @returns {void}
     */
    set(key, value, ttl = this.ttl) {
        // Evict oldest items if cache is full
        if (this.data.size >= this.maxSize) {
            const oldestKey = this.data.keys().next().value;
            this.delete(oldestKey);
            this.stats.evictions++;
        }

        this.data.set(key, {
            value,
            expiry: Date.now() + ttl
        });
    }

    /**
     * Delete a specific value from the cache.
     * This method removes the item immediately regardless of its TTL.
     * 
     * @param {string} key - Cache key to delete
     * @returns {void}
     */
    delete(key) {
        this.data.delete(key);
    }

    /**
     * Clear all cached data and reset statistics.
     * This method completely empties the cache and resets all tracking statistics.
     * 
     * @returns {void}
     */
    clear() {
        this.data.clear();
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
    }

    /**
     * Get cache performance statistics.
     * Returns information about cache hits, misses, evictions, size, and hit rate percentage.
     * 
     * @returns {Object} Cache statistics object with the following properties:
     *   - hits: Number of successful cache retrievals
     *   - misses: Number of cache misses
     *   - evictions: Number of items evicted due to size constraints
     *   - size: Current number of items in the cache
     *   - hitRate: Percentage of successful retrievals (hits / (hits + misses))
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

        return {
            ...this.stats,
            size: this.data.size,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }
}

// Create a singleton cache instance
export const taskCache = new Cache({
    ttl: 10000, // 10 seconds TTL for task data
    maxSize: 100 // Maximum 100 task sets in cache
});
