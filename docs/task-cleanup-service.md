# Task Cleanup Service Documentation

The Task Cleanup Service is an intelligent component of the Windsurf Task Master that automatically maintains task quality and organization. This document provides comprehensive information about the service, including its architecture, configuration options, and integration with the task management system.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Cleanup Operations](#cleanup-operations)
4. [Configuration](#configuration)
5. [LLM Integration](#llm-integration)
6. [Usage Examples](#usage-examples)
7. [API Reference](#api-reference)

## Overview

The Task Cleanup Service addresses common issues in task management systems:

- Duplicate or similar tasks that cause confusion
- Inconsistent metadata across tasks
- Orphaned subtasks when parent tasks are deleted
- Low-quality task descriptions that lack sufficient detail
- Non-sequential task IDs after deletions

By automatically handling these issues, the service ensures that the task management system remains clean, organized, and efficient over time.

## Architecture

The Task Cleanup Service uses a hook-based architecture to integrate with the TaskManager and trigger cleanup operations at appropriate times.

```mermaid
flowchart TB
    subgraph "Windsurf Task Master"
        TM[TaskManager]
        FW[FileWatcher]
        TCS[TaskCleanupService]
        Config[Cleanup Configuration]
    end
    
    User[User/Windsurf] -->|Create/Update Tasks| TM
    TM <-->|Monitor Changes| FW
    TM -->|Hook: Task Completion| TCS
    TM -->|Hook: Progress Update| TCS
    TCS <-->|Read Config| Config
    TCS -->|Perform Cleanup| TM
    
    subgraph "External Services"
        LLM[Windsurf LLM API]
    end
    
    TCS <-->|Similarity Detection| LLM
```

### Initialization and Hook Registration

The service registers hooks with the TaskManager during initialization:

```mermaid
sequenceDiagram
    participant Server as MCP Server
    participant TM as TaskManager
    participant TCS as TaskCleanupService
    
    Server->>TCS: Create TaskCleanupService
    TCS->>TM: Register hooks
    Note over TM,TCS: Wrap completeTask method
    Note over TM,TCS: Wrap updateWindsurfTaskProgress method
    TCS-->>Server: Hooks registered
```

### Cleanup Trigger Flow

The service is triggered when a task reaches 100% completion:

```mermaid
sequenceDiagram
    participant User as User/Windsurf
    participant TM as TaskManager
    participant TCS as TaskCleanupService
    participant Config as Cleanup Config
    
    User->>TM: Update task progress to 100%
    TM->>TM: Original updateWindsurfTaskProgress
    TM->>TCS: handleTaskCompletion(taskId, projectId, task)
    TCS->>Config: getProjectConfig(projectId)
    
    alt Cleanup enabled and trigger conditions met
        TCS->>TCS: performCleanup(projectId)
        Note over TCS: Run cleanup operations
    else Cleanup disabled or conditions not met
        TCS-->>TM: Return without cleanup
    end
```

## Cleanup Operations

The Task Cleanup Service performs several types of cleanup operations:

### Metadata Consistency

Ensures that task metadata is consistent and accurate:

```mermaid
flowchart TD
    Start[Start Metadata Cleanup] --> A{Task Completed?}
    A -->|Yes| B{Has completedAt?}
    B -->|No| C[Add completedAt timestamp]
    B -->|Yes| D{Progress = 100%?}
    A -->|No| D
    D -->|No| E[Update progress to match status]
    D -->|Yes| F{Task Assigned?}
    E --> F
    C --> F
    F -->|Yes| G{Has assignedAt?}
    G -->|No| H[Add assignedAt timestamp]
    G -->|Yes| End[End Metadata Cleanup]
    H --> End
    F -->|No| End
```

### Duplicate Detection

Identifies and handles similar tasks using LLM or text-based similarity:

```mermaid
flowchart TD
    Start[Start Duplicate Detection] --> A{LLM Available?}
    A -->|Yes| B[Use LLM for similarity detection]
    A -->|No| C[Use text-based similarity]
    B --> D[Group similar tasks]
    C --> D
    D --> E{Any similar groups?}
    E -->|No| End[End Duplicate Detection]
    E -->|Yes| F[For each group]
    F --> G[Keep oldest task]
    G --> H[Transfer subtasks from duplicates]
    H --> I[Delete duplicate tasks]
    I --> End
```

### Orphaned Subtask Handling

Manages subtasks that have lost their parent tasks:

```mermaid
flowchart TD
    Start[Start Orphan Handling] --> A[Find orphaned subtasks]
    A --> B{Any orphans found?}
    B -->|No| End[End Orphan Handling]
    B -->|Yes| C{Action type?}
    C -->|Delete| D[Delete orphaned subtasks]
    C -->|Convert| E[Convert to regular tasks]
    C -->|Reassign| F{Parent specified?}
    F -->|Yes| G[Reassign to specified parent]
    F -->|No| H{Active parents available?}
    H -->|Yes| I[Reassign to active parent]
    H -->|No| J{Any parents available?}
    J -->|Yes| K[Reassign to any parent]
    J -->|No| L[Convert to regular task]
    D --> End
    E --> End
    G --> End
    I --> End
    K --> End
    L --> End
```

### Task Quality Enforcement

Ensures tasks meet minimum quality standards:

```mermaid
flowchart TD
    Start[Start Quality Enforcement] --> A[For each task]
    A --> B{Title too short?}
    B -->|Yes| C[Add to quality issues]
    B -->|No| D{Description too short?}
    C --> D
    D -->|Yes| E[Add to quality issues]
    D -->|No| F{Missing priority?}
    E --> F
    F -->|Yes| G[Add to quality issues]
    F -->|No| H{Any quality issues?}
    G --> H
    H -->|No| I[Next task]
    H -->|Yes| J{Action type?}
    J -->|Delete| K[Delete low-quality task]
    J -->|Fix| L[Auto-fix quality issues]
    J -->|Flag| M[Log quality issues]
    K --> I
    L --> I
    M --> I
    I --> N{More tasks?}
    N -->|Yes| A
    N -->|No| End[End Quality Enforcement]
```

### Task ID Reorganization

Maintains sequential task IDs after deletions:

```mermaid
flowchart TD
    Start[Start ID Reorganization] --> A{Reorganization enabled?}
    A -->|No| End[End ID Reorganization]
    A -->|Yes| B[Get all tasks for project]
    B --> C[Sort tasks by ID]
    C --> D[Assign sequential IDs]
    D --> E[Update task references]
    E --> F[Save updated tasks]
    F --> End
```

## Configuration

The Task Cleanup Service is highly configurable through the `task-cleanup-config.js` file. The configuration is structured as follows:

```mermaid
classDiagram
    class TaskCleanupConfig {
        +boolean enabled
        +Triggers triggers
        +Operations operations
        +Logging logging
    }
    
    class Triggers {
        +boolean onTaskCompletion
        +number onTaskCompletionThreshold
        +boolean onTaskCreation
        +boolean onSubtaskCreation
        +boolean scheduledCleanup
        +number scheduledInterval
    }
    
    class Operations {
        +DuplicateDetection detectDuplicates
        +MetadataConsistency metadataConsistency
        +ReorganizeTaskIds reorganizeTaskIds
        +OrphanedSubtasks orphanedSubtasks
        +QualityEnforcement qualityEnforcement
    }
    
    class DuplicateDetection {
        +boolean enabled
        +boolean useLLM
        +number similarityThreshold
        +boolean considerTitle
        +boolean considerDescription
        +boolean ignoreCase
        +boolean ignoreWhitespace
        +number maxTasksToCompare
    }
    
    class MetadataConsistency {
        +boolean enabled
        +boolean ensureCompletedTimestamp
        +boolean validateStatusProgress
        +boolean validateAssignedFields
        +boolean validateTimestamps
    }
    
    class ReorganizeTaskIds {
        +boolean enabled
        +boolean onlyAfterDeletion
        +boolean preserveReferences
    }
    
    class OrphanedSubtasks {
        +boolean enabled
        +string action
        +number reassignToTaskId
        +boolean convertToRegularTask
    }
    
    class QualityEnforcement {
        +boolean enabled
        +number minTitleLength
        +number minDescriptionLength
        +boolean requirePriority
        +string action
    }
    
    class Logging {
        +boolean logCleanupActions
        +boolean notifyOnCleanup
        +boolean detailedLogs
    }
    
    TaskCleanupConfig --> Triggers
    TaskCleanupConfig --> Operations
    TaskCleanupConfig --> Logging
    Operations --> DuplicateDetection
    Operations --> MetadataConsistency
    Operations --> ReorganizeTaskIds
    Operations --> OrphanedSubtasks
    Operations --> QualityEnforcement
```

### Project-Specific Configuration

The service supports project-specific configurations that override the global settings:

```javascript
// Example of project-specific configuration
export const projectSpecificConfigs = {
  'documentation-update': {
    operations: {
      detectDuplicates: {
        similarityThreshold: 0.75   // Lower threshold for documentation projects
      }
    }
  }
};
```

## LLM Integration

The Task Cleanup Service integrates with the Windsurf LLM API for intelligent similarity detection:

```mermaid
sequenceDiagram
    participant TCS as TaskCleanupService
    participant LLM as Windsurf LLM API
    
    TCS->>TCS: Prepare task texts for comparison
    TCS->>LLM: POST /api/similarity
    Note right of TCS: Send texts, threshold, API key
    LLM->>LLM: Calculate semantic similarity
    LLM-->>TCS: Return similarity groups
    
    alt API Call Successful
        TCS->>TCS: Process similarity groups
    else API Call Failed
        TCS->>TCS: Fall back to text-based similarity
    end
```

### Fallback Mechanism

If the LLM API is unavailable, the service falls back to text-based similarity using a Jaccard similarity algorithm:

```mermaid
flowchart TD
    Start[Start Text Similarity] --> A[Normalize text]
    A --> B[Split into words]
    B --> C[Calculate Jaccard similarity]
    C --> D{Similarity >= threshold?}
    D -->|Yes| E[Mark as similar]
    D -->|No| F[Mark as different]
    E --> End[End Text Similarity]
    F --> End
```

## Usage Examples

### Basic Usage

The Task Cleanup Service is automatically initialized and registered when the MCP server starts:

```javascript
// In mcp-server/src/index.js
import TaskCleanupService from './core/task-cleanup-service.js';

// Initialize the service
this.taskCleanupService = new TaskCleanupService(this.taskManager);

// Register hooks
this.taskCleanupService.registerHooks();
```

### Customizing Cleanup Behavior

To customize the cleanup behavior, modify the configuration in `task-cleanup-config.js`:

```javascript
// Example: Disable duplicate detection but enable metadata consistency
export const taskCleanupConfig = {
  enabled: true,
  operations: {
    detectDuplicates: {
      enabled: false
    },
    metadataConsistency: {
      enabled: true,
      ensureCompletedTimestamp: true,
      validateStatusProgress: true
    }
  }
};
```

### Manual Cleanup Trigger

You can manually trigger cleanup for a specific project:

```javascript
// Get the TaskCleanupService instance
const cleanupService = server.taskCleanupService;

// Manually trigger cleanup for a project
await cleanupService.performCleanup('my-project');
```

## API Reference

### TaskCleanupService Class

The main class that implements the cleanup functionality:

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `constructor(taskManager)` | Initialize the Task Cleanup Service | `taskManager` (TaskManager): Instance of TaskManager | TaskCleanupService |
| `registerHooks()` | Register hooks with the TaskManager | None | void |
| `handleTaskCompletion(taskId, projectId, taskData)` | Handle task completion event | `taskId` (number): Task ID, `projectId` (string): Project ID, `taskData` (object): Task data | Promise<void> |
| `performCleanup(projectId)` | Perform cleanup operations on a project | `projectId` (string): Project ID | Promise<Array> |
| `ensureMetadataConsistency(tasks, projectId, config)` | Ensure metadata consistency across tasks | `tasks` (Array): List of tasks, `projectId` (string): Project ID, `config` (object): Cleanup configuration | Promise<Array> |
| `handleOrphanedSubtasks(tasks, projectId, config)` | Handle orphaned subtasks | `tasks` (Array): List of tasks, `projectId` (string): Project ID, `config` (object): Cleanup configuration | Promise<Array> |
| `enforceTaskQuality(tasks, projectId, config)` | Enforce task quality standards | `tasks` (Array): List of tasks, `projectId` (string): Project ID, `config` (object): Cleanup configuration | Promise<Array> |
| `detectAndHandleDuplicates(tasks, projectId, config)` | Detect and handle duplicate tasks | `tasks` (Array): List of tasks, `projectId` (string): Project ID, `config` (object): Cleanup configuration | Promise<Array> |
| `reorganizeTaskIds(projectId, config)` | Reorganize task IDs to maintain sequential ordering | `projectId` (string): Project ID, `config` (object): Cleanup configuration | Promise<Array> |

### Configuration API

Functions for working with the cleanup configuration:

| Function | Description | Parameters | Returns |
|----------|-------------|------------|---------|
| `getProjectConfig(projectId)` | Get configuration for a specific project | `projectId` (string): Project ID | Object |
| `mergeConfigs(target, source)` | Deep merge two configuration objects | `target` (object): Target configuration, `source` (object): Source configuration | Object |
