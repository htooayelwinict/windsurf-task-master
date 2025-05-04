# Windsurf Task Master

A powerful MCP server for project-specific task management between Claude Desktop and Windsurf, enabling seamless task creation, progress tracking, and automatic completion without using external APIs.

> **Credits**: This project is based on [claude-task-master](https://github.com/eyaltoledano/claude-task-master) by Eyal Toledano and AI Jason. The original concept has been extended with project-specific task isolation and enhanced progress tracking.

## Features

- **Project Isolation**: Tasks are organized by project, preventing task mixing across different projects
- **Progress Tracking**: Monitor task completion percentages and detailed progress for each project
- **Claude Desktop Integration**: Create and manage tasks directly through Claude Desktop
- **Windsurf Sync**: Automatically sync task updates between Claude Desktop and Windsurf
- **No API Required**: Works entirely through file-based storage and MCP integration
- **Real-time Updates**: File watcher detects changes made by Windsurf and displays completion statistics
- **Comprehensive Task Management**: Create, update, list, complete, and track progress of tasks

## System Architecture

```mermaid
flowchart LR
    Claude[Claude Desktop] <-->|MCP Tools| Server[Task Master Server]
    Server <-->|File System| TaskFiles[(Project Task Files)]
    Windsurf[Windsurf] <-->|File System| TaskFiles
    Server <-->|Status Updates| Windsurf
    
    subgraph "Core Components"
        TaskManager[Task Manager]
        FileWatcher[File Watcher]
        Tools[MCP Tools]
    end
    
    Server --> TaskManager
    Server --> FileWatcher
    Server --> Tools
    TaskManager <--> TaskFiles
    FileWatcher --> TaskFiles
```

## Data Flow

```mermaid
sequenceDiagram
    participant Claude as Claude Desktop
    participant Server as Task Master Server
    participant Files as Project Task Files
    participant Windsurf as Windsurf
    
    Claude->>Server: create_task(projectId, title, description)
    Server->>Files: Write task to project-specific file
    Note over Files: tasks/{projectId}/tasks.json
    
    Claude->>Server: assign_to_windsurf(taskId, projectId)
    Server->>Files: Update task status to 'in-progress'
    
    Windsurf->>Files: Monitor task file changes
    Windsurf->>Files: Update task progress (25%, 50%, 75%)
    
    Files->>Server: File change detected
    Server->>Claude: Display updated task status
    
    Windsurf->>Files: Set progress to 100%
    Files->>Server: File change detected
    Server->>Files: Mark task as completed
    Server->>Claude: Display completion status
```

## Data Structure

### Project Organization

```
tasks/
├── project1/
│   └── tasks.json
├── project2/
│   └── tasks.json
└── project3/
    └── tasks.json
```

### Task Schema

```mermaid
classDiagram
    class Task {
        +number id
        +string title
        +string description
        +string status
        +string priority
        +number[] dependencies
        +string assignedTo
        +string assignedAt
        +number progress
        +string createdAt
        +string updatedAt
        +string projectId
    }
    
    class Project {
        +string id
        +Task[] tasks
    }
    
    Project "1" --> "*" Task: contains
```

### Task JSON Example

```json
{
  "id": 1,
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication system",
  "status": "in-progress",
  "priority": "high",
  "dependencies": [2, 3],
  "assignedTo": "windsurf",
  "assignedAt": "2025-05-04T10:00:00Z",
  "progress": 75,
  "createdAt": "2025-05-04T09:00:00Z",
  "updatedAt": "2025-05-04T15:30:00Z"
}
```

## Core Components

### TaskManager

Manages task operations for project-specific task files:

- **init(projectId)**: Initialize task manager for a specific project
- **createTask(taskData, projectId)**: Create a new task for a project
- **listTasks(projectId)**: List all tasks for a project
- **updateTask(id, updates, projectId)**: Update a task in a project
- **completeTask(id, projectId)**: Mark a task as completed in a project
- **assignToWindsurf(id, projectId)**: Assign a task to Windsurf
- **updateWindsurfTaskProgress(id, progress, projectId)**: Update task progress

### FileWatcher

Monitors project-specific task files for changes:

- **start()**: Begin watching for file changes in project directories
- **watchTasksFile(projectId, tasksPath)**: Watch a specific project's task file
- **stop()**: Stop watching all files

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/windsurf-task-master
   cd windsurf-task-master
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Claude Desktop to use this MCP server:
   ```json
   {
     "mcpServers": {
       "windsurf-task-master": {
         "command": "node",
         "args": ["/path/to/windsurf-task-master/mcp-server/server.js"],
         "env": {}
       }
     }
   }
   ```

4. Start the server:
   ```bash
   npm start
   ```

## MCP Tools

The following tools are available through the MCP server:

### 1. create_task

Create a new task for a specific project.

```javascript
mcp1_create_task({
  title: "Implement feature X",
  description: "Detailed description of the task",
  priority: "medium", // low, medium, high
  dependencies: [1, 2], // optional
  projectId: "project-name"
})
```

### 2. list_tasks

List all tasks or filter by status for a specific project.

```javascript
mcp1_list_tasks({
  status: "in-progress", // pending, in-progress, completed, all
  projectId: "project-name"
})
```

### 3. update_task

Update an existing task in a specific project.

```javascript
mcp1_update_task({
  id: 1,
  title: "Updated title", // optional
  description: "Updated description", // optional
  status: "in-progress", // optional
  priority: "high", // optional
  dependencies: [3, 4], // optional
  projectId: "project-name"
})
```

### 4. complete_task

Mark a task as completed in a specific project.

```javascript
mcp1_complete_task({
  id: 1,
  projectId: "project-name"
})
```

### 5. assign_to_windsurf

Assign a task to Windsurf for processing.

```javascript
mcp1_assign_to_windsurf({
  id: 1,
  projectId: "project-name"
})
```

### 6. update_windsurf_progress

Update progress on a task assigned to Windsurf.

```javascript
mcp1_update_windsurf_progress({
  id: 1,
  progress: 50, // 0-100
  projectId: "project-name"
})
```

### 7. get_windsurf_tasks

Get all tasks assigned to Windsurf across all projects or from a specific project.

```javascript
mcp1_get_windsurf_tasks({
  projectId: "project-name" // optional
})
```

### 8. display_task_status

Display detailed status of tasks with completion percentages.

```javascript
mcp1_display_task_status({
  projectId: "project-name" // optional
})
```

## Windsurf Task Management Rules

For efficient task tracking with Windsurf, follow these rules:

### Task Initialization Rules
- Always create tasks with a specific projectId (use lowercase, no spaces)
- Use descriptive titles that clearly indicate the task's purpose
- Break down complex user requests into multiple smaller tasks
- Set initial progress to 0% when assigning to Windsurf
- Create a new project ID for each distinct user objective

### Progress Tracking Rules
- Update task progress at meaningful milestones (25%, 50%, 75%, 100%)
- Update progress when switching between subtasks of a larger task
- Include specific progress indicators in status updates
- Never leave a task at partial progress when it's actually complete

### Task Completion Rules
- Mark a task as complete only when all requirements are fully satisfied
- Always set progress to 100% when completing a task
- Provide a summary of what was accomplished when completing a task
- Check for and resolve any dependencies before marking a task complete

## Contributing

Feel free to submit issues and pull requests to improve the functionality.

## License

MIT

## Credits

This project is based on [claude-task-master](https://github.com/eyaltoledano/claude-task-master) by Eyal Toledano and AI Jason. The original concept has been extended with project-specific task isolation and enhanced progress tracking.
