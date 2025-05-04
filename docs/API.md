# Windsurf Task Master API Documentation

This document provides detailed information about the core components and utilities of the Windsurf Task Master system.

## Table of Contents

1. [Core Components](#core-components)
   - [TaskManager](#taskmanager)
   - [FileWatcher](#filewatcher)
2. [Utilities](#utilities)
   - [Cache](#cache)
   - [Debouncer](#debouncer)
   - [Error Handling](#error-handling)
   - [Logger](#logger)
3. [Performance Optimization](#performance-optimization)
   - [Caching Strategy](#caching-strategy)
   - [Debouncing Strategy](#debouncing-strategy)
   - [Task Indexing](#task-indexing)

## Core Components

### TaskManager

The `TaskManager` class is responsible for managing tasks across different projects. It provides methods for creating, updating, and retrieving tasks.

#### Key Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `init(projectId)` | Initialize the task manager for a specific project | `projectId` (string): Project identifier | Promise<void> |
| `createTask(taskData, projectId)` | Create a new task for a project | `taskData` (object): Task data, `projectId` (string): Project identifier | Promise<Task> |
| `updateTask(id, updates, projectId)` | Update an existing task | `id` (number): Task ID, `updates` (object): Updates to apply, `projectId` (string): Project identifier | Promise<Task> |
| `completeTask(id, projectId)` | Mark a task as completed | `id` (number): Task ID, `projectId` (string): Project identifier | Promise<Task> |
| `listTasks(projectId)` | List all tasks for a project | `projectId` (string): Project identifier | Promise<Task[]> |
| `getTasksByStatus(status, projectId)` | Get tasks filtered by status | `status` (string): Task status, `projectId` (string): Project identifier | Promise<Task[]> |
| `assignToWindsurf(id, projectId)` | Assign a task to Windsurf | `id` (number): Task ID, `projectId` (string): Project identifier | Promise<Task> |
| `getWindsurfTasks(projectId)` | Get tasks assigned to Windsurf | `projectId` (string, optional): Project identifier | Promise<Task[]> |
| `updateWindsurfTaskProgress(id, progress, projectId)` | Update task progress | `id` (number): Task ID, `progress` (number): Progress percentage, `projectId` (string): Project identifier | Promise<Task> |

#### Usage Example

```javascript
import { TaskManager } from '../core/task-manager.js';

// Create a task manager instance
const taskManager = new TaskManager();

// Initialize for a specific project
await taskManager.init('my-project');

// Create a new task
const task = await taskManager.createTask({
  title: 'Implement feature X',
  description: 'Add new functionality',
  priority: 'high'
}, 'my-project');

// Assign to Windsurf
await taskManager.assignToWindsurf(task.id, 'my-project');

// Update progress
await taskManager.updateWindsurfTaskProgress(task.id, 50, 'my-project');

// Complete the task
await taskManager.completeTask(task.id, 'my-project');
```

### FileWatcher

The `FileWatcher` class monitors task files for changes and triggers appropriate actions when changes are detected.

## Utilities

### Cache

The `Cache` utility provides in-memory caching functionality to improve performance by reducing file system operations.

#### Key Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `get(key)` | Get a value from cache | `key` (string): Cache key | Value or undefined |
| `set(key, value, ttl)` | Set a value in cache | `key` (string): Cache key, `value` (any): Value to cache, `ttl` (number, optional): Time-to-live in ms | void |
| `delete(key)` | Delete a value from cache | `key` (string): Cache key | void |
| `clear()` | Clear all cached data | None | void |
| `getStats()` | Get cache statistics | None | Object with stats |

#### Usage Example

```javascript
import { Cache } from '../utils/cache.js';

// Create a cache instance
const cache = new Cache({
  ttl: 5000,      // 5 seconds TTL
  maxSize: 100    // Maximum 100 items
});

// Set a value
cache.set('user-123', { name: 'John', role: 'admin' });

// Get a value
const user = cache.get('user-123');

// Get cache statistics
const stats = cache.getStats();
console.log(`Cache hit rate: ${stats.hitRate}%`);
```

### Debouncer

The `Debouncer` utility optimizes operations by delaying execution until a specified time has passed since the last call.

#### Key Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `debounce(key, operation, delay, context)` | Debounce an async operation | `key` (string): Operation identifier, `operation` (function): Async function, `delay` (number): Delay in ms, `context` (any, optional): Operation context | Promise<any> |
| `cancel(key)` | Cancel a debounced operation | `key` (string): Operation identifier | void |
| `cancelAll()` | Cancel all debounced operations | None | void |

#### Usage Example

```javascript
import { Debouncer } from '../utils/debounce.js';

// Create a debouncer instance
const debouncer = new Debouncer();

// Debounce a file write operation
await debouncer.debounce(
  'save-user-123',
  async () => {
    await fs.writeFile('user-123.json', JSON.stringify(userData));
    return 'File saved';
  },
  1000  // 1 second delay
);

// Cancel a specific debounced operation
debouncer.cancel('save-user-123');
```

### Error Handling

The error handling system provides custom error classes and logging functionality.

#### Custom Error Classes

| Error Class | Description | Properties |
|-------------|-------------|------------|
| `TaskMasterError` | Base error class | `code`, `details` |
| `TaskNotFoundError` | Error for when a task is not found | `taskId`, `projectId` |
| `ProjectNotFoundError` | Error for when a project is not found | `projectId` |
| `FileSystemError` | Error for file system operations | `operation`, `path` |
| `TaskStateError` | Error for invalid task state transitions | `taskId`, `currentState`, `action` |

#### Usage Example

```javascript
import { TaskNotFoundError } from '../utils/errors.js';

// Throw a custom error
throw new TaskNotFoundError(123, 'my-project');

// Catch and handle a custom error
try {
  await taskManager.getTask(123, 'my-project');
} catch (error) {
  if (error instanceof TaskNotFoundError) {
    console.error(`Task not found: ${error.taskId}`);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Logger

The `Logger` utility provides structured logging functionality with different log levels.

#### Key Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `info(message, metadata)` | Log an informational message | `message` (string): Log message, `metadata` (object, optional): Additional data |
| `error(message, metadata)` | Log an error message | `message` (string): Error message, `metadata` (object, optional): Additional data |

#### Usage Example

```javascript
import { logger } from '../utils/logger.js';

// Log an informational message
logger.info('User logged in', { userId: 123, timestamp: new Date() });

// Log an error
logger.error('Failed to process payment', { 
  userId: 123, 
  error: new Error('Payment gateway error') 
});
```

## Performance Optimization

### Caching Strategy

The Windsurf Task Master implements a caching strategy to reduce file system operations:

1. **Task Data Caching**: Task data is cached in memory to avoid repeated file reads
2. **TTL-based Expiration**: Cached data expires after a configurable time-to-live period
3. **Automatic Eviction**: Least recently used items are evicted when the cache reaches its size limit

### Debouncing Strategy

File write operations are debounced to optimize performance:

1. **Grouped Writes**: Multiple write requests within a short time window are grouped into a single operation
2. **Delayed Execution**: Write operations are delayed until a specified time has passed since the last request
3. **Promise Queuing**: All requests within the debounce window receive the same result promise

### Task Indexing

Tasks are indexed for faster lookups:

1. **ID-based Index**: Tasks are indexed by their ID for O(1) lookup
2. **Status Index**: Tasks are indexed by status for efficient filtering
3. **Assignee Index**: Tasks are indexed by assignee for quick retrieval of tasks assigned to specific users
