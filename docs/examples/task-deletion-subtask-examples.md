# Task Deletion and Subtask Management Examples

This document provides practical examples of using the task deletion and subtask management features in the Windsurf Task Master.

## Table of Contents

1. [Task Deletion Examples](#task-deletion-examples)
   - [Deleting a Single Task](#deleting-a-single-task)
   - [Deleting Multiple Tasks](#deleting-multiple-tasks)
   - [Reorganizing Task IDs](#reorganizing-task-ids)
2. [Subtask Management Examples](#subtask-management-examples)
   - [Creating Subtasks](#creating-subtasks)
   - [Retrieving Subtasks](#retrieving-subtasks)
   - [Working with Subtask Hierarchies](#working-with-subtask-hierarchies)
3. [Advanced Usage](#advanced-usage)
   - [Combining Task Deletion and Subtasks](#combining-task-deletion-and-subtasks)
   - [Batch Operations](#batch-operations)

## Task Deletion Examples

### Deleting a Single Task

The `delete_task` tool allows you to delete a specific task by its ID:

```javascript
// Delete a task with ID 3 from the project "my-project"
mcp5_delete_task({
  id: 3,
  projectId: "my-project",
  reorganizeIds: true  // Optional, defaults to true
})
```

When a task is deleted:
- The task is removed from the project's task list
- Any subtasks of the deleted task are also deleted
- If `reorganizeIds` is true, task IDs are renumbered to maintain sequential ordering

### Deleting Multiple Tasks

The `delete_tasks` tool provides powerful batch deletion capabilities:

```javascript
// Delete tasks by ID
mcp5_delete_tasks({
  projectId: "my-project",
  ids: [1, 3, 5]
})

// Delete tasks by status
mcp5_delete_tasks({
  projectId: "my-project",
  status: "completed"
})

// Delete duplicate tasks (same title and description)
mcp5_delete_tasks({
  projectId: "my-project",
  duplicates: true
})

// Delete unqualified tasks (missing required fields)
mcp5_delete_tasks({
  projectId: "my-project",
  unqualified: true
})

// Combine multiple criteria
mcp5_delete_tasks({
  projectId: "my-project",
  status: "completed",
  duplicates: true
})
```

### Reorganizing Task IDs

When tasks are deleted, you can choose to reorganize the remaining task IDs to maintain sequential ordering:

```javascript
// Delete a task and reorganize IDs
mcp5_delete_task({
  id: 2,
  projectId: "my-project",
  reorganizeIds: true
})
```

Before deletion:
```
Task #1: "Setup project"
Task #2: "Create database schema"  <- To be deleted
Task #3: "Implement API endpoints"
Task #4: "Write tests"
```

After deletion with `reorganizeIds: true`:
```
Task #1: "Setup project"
Task #2: "Implement API endpoints"  <- ID changed from 3 to 2
Task #3: "Write tests"              <- ID changed from 4 to 3
```

## Subtask Management Examples

### Creating Subtasks

Subtasks allow you to break down complex tasks into smaller, manageable pieces:

```javascript
// Create a parent task
const parentTask = await mcp5_create_task({
  title: "Implement authentication system",
  description: "Create a complete JWT-based authentication system",
  priority: "high",
  projectId: "my-project"
})

// Add subtasks to the parent task
mcp5_add_subtask({
  parentTaskId: parentTask.id,
  title: "Create user model",
  description: "Define user schema with username, password, and roles",
  priority: "high",  // Optional, inherits from parent if not specified
  projectId: "my-project"
})

mcp5_add_subtask({
  parentTaskId: parentTask.id,
  title: "Implement JWT token generation",
  description: "Create utility for generating secure JWT tokens",
  projectId: "my-project"
})

mcp5_add_subtask({
  parentTaskId: parentTask.id,
  title: "Add authentication middleware",
  description: "Create middleware to validate JWT tokens on protected routes",
  projectId: "my-project"
})
```

### Retrieving Subtasks

You can retrieve all subtasks for a parent task:

```javascript
// Get all subtasks for a parent task
const subtasks = await mcp5_get_subtasks({
  parentTaskId: 1,
  projectId: "my-project"
})

console.log(`Found ${subtasks.length} subtasks for task #1`)
subtasks.forEach(subtask => {
  console.log(`Subtask #${subtask.id}: ${subtask.title} - ${subtask.status}`)
})
```

### Working with Subtask Hierarchies

Subtasks can help organize complex projects with hierarchical relationships:

```javascript
// Create a project structure with tasks and subtasks
const projectSetup = await mcp5_create_task({
  title: "Project Setup",
  description: "Initial project configuration",
  projectId: "new-app"
})

// Add subtasks for project setup
await mcp5_add_subtask({
  parentTaskId: projectSetup.id,
  title: "Initialize repository",
  projectId: "new-app"
})

await mcp5_add_subtask({
  parentTaskId: projectSetup.id,
  title: "Configure build system",
  projectId: "new-app"
})

// Create another main task
const featureDevelopment = await mcp5_create_task({
  title: "Feature Development",
  description: "Implement core features",
  projectId: "new-app"
})

// Add subtasks for feature development
const authFeature = await mcp5_add_subtask({
  parentTaskId: featureDevelopment.id,
  title: "Authentication System",
  projectId: "new-app"
})

// Create nested subtasks (subtasks of subtasks)
// Note: This requires custom implementation as the current API doesn't directly support nested subtasks
// You would need to track the parent-child relationships manually
```

## Advanced Usage

### Combining Task Deletion and Subtasks

When you delete a parent task, all its subtasks are automatically deleted:

```javascript
// Create a parent task with subtasks
const parentTask = await mcp5_create_task({
  title: "Feature X",
  projectId: "my-project"
})

await mcp5_add_subtask({
  parentTaskId: parentTask.id,
  title: "Subtask 1",
  projectId: "my-project"
})

await mcp5_add_subtask({
  parentTaskId: parentTask.id,
  title: "Subtask 2",
  projectId: "my-project"
})

// Delete the parent task (and all its subtasks)
await mcp5_delete_task({
  id: parentTask.id,
  projectId: "my-project"
})

// All subtasks are now deleted as well
```

### Batch Operations

For efficient task management, you can combine multiple operations:

```javascript
// Example workflow: Create a task with subtasks, complete some, then clean up

// 1. Create a parent task
const parentTask = await mcp5_create_task({
  title: "Implement feature Y",
  projectId: "my-project"
})

// 2. Add multiple subtasks
for (let i = 1; i <= 5; i++) {
  await mcp5_add_subtask({
    parentTaskId: parentTask.id,
    title: `Subtask ${i} for feature Y`,
    projectId: "my-project"
  })
}

// 3. Get all subtasks
const subtasks = await mcp5_get_subtasks({
  parentTaskId: parentTask.id,
  projectId: "my-project"
})

// 4. Complete some subtasks
for (const subtask of subtasks.slice(0, 3)) {
  await mcp5_complete_task({
    id: subtask.id,
    projectId: "my-project"
  })
}

// 5. Delete completed subtasks
await mcp5_delete_tasks({
  projectId: "my-project",
  status: "completed"
})

// 6. Check remaining subtasks
const remainingSubtasks = await mcp5_get_subtasks({
  parentTaskId: parentTask.id,
  projectId: "my-project"
})
console.log(`Remaining subtasks: ${remainingSubtasks.length}`)
```

This example demonstrates a complete workflow of creating, managing, and cleaning up tasks and subtasks.
