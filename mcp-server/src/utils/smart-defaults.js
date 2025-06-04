/**
 * Smart Defaults utility for intelligent task creation
 * Provides automatic suggestions and improvements without breaking existing functionality
 */

import { logger } from './logger.js';

/**
 * Smart defaults for task creation
 */
export class SmartDefaults {
    /**
     * Automatically infer task priority based on title and description content
     * @param {string} title - Task title
     * @param {string} description - Task description
     * @returns {string} Suggested priority ('low', 'medium', 'high')
     */
    static inferPriority(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        
        // High priority keywords
        const highPriorityPatterns = [
            /critical|urgent|security|vulnerability|exploit/,
            /bug|error|crash|fail|broken/,
            /production|deploy|release|hotfix/,
            /deadline|asap|immediately/
        ];
        
        // Low priority keywords  
        const lowPriorityPatterns = [
            /cleanup|refactor|optimize|improve/,
            /documentation|comment|readme/,
            /style|format|lint|prettify/,
            /nice.to.have|optional|future/
        ];
        
        // Check for high priority indicators
        if (highPriorityPatterns.some(pattern => pattern.test(text))) {
            return 'high';
        }
        
        // Check for low priority indicators
        if (lowPriorityPatterns.some(pattern => pattern.test(text))) {
            return 'low';
        }
        
        // Default to medium priority
        return 'medium';
    }
    
    /**
     * Enhance task description with acceptance criteria if it seems incomplete
     * @param {string} title - Task title
     * @param {string} description - Original description
     * @returns {string} Enhanced description
     */
    static enhanceDescription(title, description) {
        // Don't modify if description is already comprehensive (>100 chars with criteria)
        if (description.length > 100 && description.toLowerCase().includes('criteria')) {
            return description;
        }
        
        let enhanced = description;
        const titleLower = title.toLowerCase();
        
        // Add acceptance criteria for common task types
        const criteria = [];
        
        if (titleLower.includes('api') || titleLower.includes('endpoint')) {
            criteria.push('API endpoint responds with correct status codes');
            criteria.push('Request/response validation works properly');
            criteria.push('Error handling covers edge cases');
        } else if (titleLower.includes('ui') || titleLower.includes('component') || titleLower.includes('frontend')) {
            criteria.push('Component renders correctly');
            criteria.push('User interactions work as expected');
            criteria.push('Responsive design is maintained');
        } else if (titleLower.includes('test') || titleLower.includes('testing')) {
            criteria.push('Test coverage meets requirements');
            criteria.push('All test cases pass consistently');
            criteria.push('Edge cases are covered');
        } else if (titleLower.includes('database') || titleLower.includes('schema')) {
            criteria.push('Database schema is properly designed');
            criteria.push('Data migrations work correctly');
            criteria.push('Performance is acceptable');
        } else if (titleLower.includes('deploy') || titleLower.includes('setup')) {
            criteria.push('Deployment completes without errors');
            criteria.push('Configuration is properly set');
            criteria.push('Health checks pass');
        }
        
        // Only add criteria if we found relevant ones and description is short
        if (criteria.length > 0 && description.length < 100) {
            enhanced += enhanced.endsWith('.') ? '\n\n' : '.\n\n';
            enhanced += 'Acceptance Criteria:\n';
            enhanced += criteria.map(c => `- ${c}`).join('\n');
        }
        
        return enhanced;
    }
    
    /**
     * Check if a task might be too large and suggest breakdown
     * @param {string} title - Task title
     * @param {string} description - Task description
     * @returns {Object} Analysis result with suggestions
     */
    static analyzeTaskSize(title, description) {
        const text = `${title} ${description}`.toLowerCase();
        const largeTaskIndicators = [
            /implement.*system|build.*application|create.*platform/,
            /complete.*integration|full.*setup|entire.*workflow/,
            /multiple|several|various|all.*features/
        ];
        
        const shouldBreakdown = largeTaskIndicators.some(pattern => pattern.test(text));
        
        if (shouldBreakdown) {
            return {
                shouldBreakdown: true,
                suggestion: 'This task appears complex. Consider breaking it into smaller subtasks for better tracking and progress visibility.',
                estimatedComplexity: 'high'
            };
        }
        
        return {
            shouldBreakdown: false,
            estimatedComplexity: 'normal'
        };
    }
    
    /**
     * Apply smart defaults to task data
     * @param {Object} taskData - Original task data
     * @returns {Object} Enhanced task data with smart defaults applied
     */
    static apply(taskData) {
        const enhanced = { ...taskData };
        let suggestions = [];
        
        try {
            // Apply smart priority if not explicitly set or if set to default 'medium'
            if (!taskData.priority || taskData.priority === 'medium') {
                const inferredPriority = this.inferPriority(taskData.title, taskData.description);
                if (inferredPriority !== 'medium') {
                    enhanced.priority = inferredPriority;
                    suggestions.push(`Priority auto-set to '${inferredPriority}' based on task content`);
                }
            }
            
            // Enhance description if it seems incomplete
            const enhancedDescription = this.enhanceDescription(taskData.title, taskData.description);
            if (enhancedDescription !== taskData.description) {
                enhanced.description = enhancedDescription;
                suggestions.push('Added acceptance criteria to help clarify requirements');
            }
            
            // Analyze task size
            const sizeAnalysis = this.analyzeTaskSize(taskData.title, taskData.description);
            if (sizeAnalysis.shouldBreakdown) {
                suggestions.push(sizeAnalysis.suggestion);
            }
            
            return {
                enhanced,
                suggestions,
                analysis: {
                    priorityInferred: enhanced.priority !== taskData.priority,
                    descriptionEnhanced: enhanced.description !== taskData.description,
                    complexity: sizeAnalysis.estimatedComplexity
                }
            };
            
        } catch (error) {
            logger.error('Error applying smart defaults:', error);
            // Return original data if smart defaults fail
            return {
                enhanced: taskData,
                suggestions: [],
                analysis: {}
            };
        }
    }
}

export default SmartDefaults;
