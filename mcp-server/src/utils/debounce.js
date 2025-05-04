/**
 * Debounce utility for optimizing frequent operations in the Windsurf Task Master system.
 * 
 * This class provides a mechanism to delay the execution of operations until a specified
 * time has passed since the last call. This is particularly useful for optimizing file
 * system operations by grouping multiple write requests into a single operation.
 * 
 * @class
 * @example
 * const debouncer = new Debouncer();
 * 
 * // Debounce a file write operation
 * await debouncer.debounce(
 *   'save-data',
 *   async () => await fs.writeFile('data.json', JSON.stringify(data)),
 *   1000 // 1 second delay
 * );
 */
export class Debouncer {
    constructor() {
        this.timers = new Map();
        this.queues = new Map();
    }

    /**
     * Debounce an asynchronous operation.
     * 
     * This method delays the execution of the operation until the specified delay has
     * passed since the last call with the same key. If multiple calls are made within
     * the delay period, only the last one will be executed, and all promises will
     * resolve with the same result.
     * 
     * @param {string} key - Unique identifier for the operation
     * @param {Function} operation - Asynchronous function to execute
     * @param {number} delay - Delay in milliseconds before executing the operation
     * @param {any} context - Optional context (this) for the operation function
     * @returns {Promise<any>} Promise that resolves with the operation result
     * 
     * @example
     * // Debounce file writes
     * await debouncer.debounce(
     *   `save_${projectId}`,
     *   async () => await fs.writeFile(path, data),
     *   1000
     * );
     */
    async debounce(key, operation, delay, context = null) {
        // Clear existing timer
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Create or get the operation queue
        if (!this.queues.has(key)) {
            this.queues.set(key, []);
        }
        const queue = this.queues.get(key);

        // Create a new promise for this operation
        const promise = new Promise((resolve, reject) => {
            queue.push({ resolve, reject });
        });

        // Set new timer
        this.timers.set(key, setTimeout(async () => {
            try {
                // Execute operation
                const result = await operation.call(context);

                // Resolve all queued promises
                queue.forEach(({ resolve }) => resolve(result));
            } catch (error) {
                // Reject all queued promises
                queue.forEach(({ reject }) => reject(error));
            } finally {
                // Clear queue and timer
                this.queues.delete(key);
                this.timers.delete(key);
            }
        }, delay));

        return promise;
    }

    /**
     * Cancel a pending debounced operation.
     * 
     * This method cancels a pending operation and rejects all associated promises.
     * It's useful for cleaning up when an operation is no longer needed or when
     * shutting down the application.
     * 
     * @param {string} key - Unique identifier for the operation to cancel
     * @returns {void}
     * 
     * @example
     * // Cancel a specific debounced operation
     * debouncer.cancel('save_project123');
     */
    cancel(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        if (this.queues.has(key)) {
            const queue = this.queues.get(key);
            queue.forEach(({ reject }) => 
                reject(new Error('Operation cancelled'))
            );
            this.queues.delete(key);
        }
    }

    /**
     * Cancel all pending debounced operations.
     * 
     * This method cancels all pending operations and rejects their associated promises.
     * It's useful for cleaning up when shutting down the application or when a major
     * state change requires cancelling all pending operations.
     * 
     * @returns {void}
     * 
     * @example
     * // Cancel all pending operations
     * debouncer.cancelAll();
     */
    cancelAll() {
        for (const key of this.timers.keys()) {
            this.cancel(key);
        }
    }
}

// Create a singleton debouncer instance
export const debouncer = new Debouncer();
