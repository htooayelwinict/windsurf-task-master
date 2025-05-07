/**
 * Configuration for the Task Cleanup Service
 * This file contains settings that control how the automatic task cleanup works
 */

export const taskCleanupConfig = {
  // General settings
  enabled: true,
  
  // When to trigger cleanup
  triggers: {
    onTaskCompletion: true,         // Trigger when a task is marked as completed
    onTaskCompletionThreshold: 100, // Only trigger when progress reaches 100%
    onTaskCreation: false,          // Trigger when a new task is created
    onSubtaskCreation: false,       // Trigger when a new subtask is created
    scheduledCleanup: false,        // Run scheduled cleanups
    scheduledInterval: 3600000      // Scheduled cleanup interval in ms (1 hour)
  },
  
  // Cleanup operations to perform
  operations: {
    // Duplicate detection
    detectDuplicates: {
      enabled: true,
      useLLM: true,                 // Use Windsurf LLM for similarity detection
      similarityThreshold: 0.85,    // Threshold for considering tasks similar (0-1)
      considerTitle: true,          // Consider title in similarity calculation
      considerDescription: true,    // Consider description in similarity calculation
      ignoreCase: true,             // Ignore case when comparing text
      ignoreWhitespace: true,       // Ignore whitespace differences
      maxTasksToCompare: 50         // Maximum number of tasks to compare at once
    },
    
    // Metadata consistency
    metadataConsistency: {
      enabled: true,
      ensureCompletedTimestamp: true,   // Ensure completed tasks have completedAt timestamp
      validateStatusProgress: true,      // Ensure progress matches status (e.g., completed = 100%)
      validateAssignedFields: true,      // Ensure assigned tasks have assignedAt timestamp
      validateTimestamps: true           // Ensure timestamps are valid and in correct order
    },
    
    // Task ID reorganization
    reorganizeTaskIds: {
      enabled: true,
      onlyAfterDeletion: true,      // Only reorganize after tasks are deleted
      preserveReferences: true       // Preserve references to tasks in dependencies
    },
    
    // Orphaned subtask handling
    orphanedSubtasks: {
      enabled: true,
      action: 'reassign',           // What to do with orphaned subtasks: 'reassign', 'delete', or 'convert'
      reassignToTaskId: null,       // Specific task ID to reassign to (null = auto-select)
      convertToRegularTask: true    // If action is 'convert', convert to regular task
    },
    
    // Task quality enforcement
    qualityEnforcement: {
      enabled: true,
      minTitleLength: 5,            // Minimum title length
      minDescriptionLength: 10,     // Minimum description length
      requirePriority: true,        // Require priority to be set
      action: 'flag'                // What to do with low-quality tasks: 'flag', 'fix', or 'delete'
    }
  },
  
  // Logging and notifications
  logging: {
    logCleanupActions: true,        // Log all cleanup actions
    notifyOnCleanup: false,         // Send notifications when cleanup occurs
    detailedLogs: true              // Include detailed information in logs
  }
};

// Specific project configurations (overrides global settings)
export const projectSpecificConfigs = {
  // Example: Different config for a specific project
  'documentation-update': {
    operations: {
      detectDuplicates: {
        similarityThreshold: 0.75   // Lower threshold for documentation projects
      }
    }
  }
};

/**
 * Get configuration for a specific project
 * @param {string} projectId - Project identifier
 * @returns {Object} - Configuration for the project
 */
export function getProjectConfig(projectId) {
  // Start with the default config
  const config = { ...taskCleanupConfig };
  
  // Apply project-specific overrides if they exist
  if (projectId && projectSpecificConfigs[projectId]) {
    return mergeConfigs(config, projectSpecificConfigs[projectId]);
  }
  
  return config;
}

/**
 * Deep merge two configuration objects
 * @param {Object} target - Target configuration
 * @param {Object} source - Source configuration to merge in
 * @returns {Object} - Merged configuration
 */
function mergeConfigs(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      result[key] = mergeConfigs(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}
