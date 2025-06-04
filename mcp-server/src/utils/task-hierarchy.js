/**
 * Task Hierarchy Analyzer - Fixes the "turtleneck" problem
 * Creates balanced task structures with multiple parent tasks instead of one giant parent
 */

import { logger } from './logger.js';

/**
 * Analyzes project requirements and suggests balanced task hierarchy
 */
export class TaskHierarchyAnalyzer {
    /**
     * Project domains that should typically be separate parent tasks
     */
    static projectDomains = {
        setup: {
            keywords: ['setup', 'config', 'initialize', 'install', 'environment', 'scaffold', 'structure', 'dependencies'],
            title: 'Project Setup & Configuration',
            priority: 'high'
        },
        backend: {
            keywords: ['api', 'server', 'database', 'backend', 'endpoint', 'service', 'auth', 'mechanics', 'logic', 'algorithm', 'core'],
            title: 'Backend Development', 
            priority: 'high'
        },
        frontend: {
            keywords: ['ui', 'frontend', 'component', 'interface', 'client', 'react', 'vue', 'design', 'styling', 'css', 'tailwind', 'responsive'],
            title: 'Frontend Development',
            priority: 'medium'
        },
        testing: {
            keywords: ['test', 'testing', 'qa', 'quality', 'validation', 'coverage'],
            title: 'Testing & Quality Assurance',
            priority: 'medium'
        },
        deployment: {
            keywords: ['deploy', 'deployment', 'ci/cd', 'pipeline', 'production', 'hosting'],
            title: 'Deployment & Operations',
            priority: 'low'
        },
        documentation: {
            keywords: ['docs', 'documentation', 'readme', 'guide', 'manual'],
            title: 'Documentation',
            priority: 'low'
        },
        gamedev: {
            keywords: ['game', 'gaming', 'gameplay', 'mechanics', 'level', 'player', 'character', 'animation', 'collision', 'physics', 'score'],
            title: 'Game Development',
            priority: 'high'
        },
        features: {
            keywords: ['feature', 'polish', 'enhancement', 'sound', 'effects', 'visual', 'aesthetic', 'indie'],
            title: 'Features & Polish',
            priority: 'medium'
        }
    };

    /**
     * Analyze a project description and suggest balanced task structure
     * @param {string} description - Project or feature description
     * @param {Array} existingTasks - Existing tasks in the project (optional)
     * @returns {Object} Suggested task structure
     */
    static analyzeProject(description, existingTasks = []) {
        try {
            const text = description.toLowerCase();
            const detectedDomains = [];
            
            // Detect which domains are mentioned in the description
            for (const [domainKey, domain] of Object.entries(this.projectDomains)) {
                if (domain.keywords.some(keyword => text.includes(keyword))) {
                    detectedDomains.push(domainKey);
                }
            }
            
            // If we detect multiple domains, suggest a balanced structure
            if (detectedDomains.length > 1) {
                return {
                    shouldUseBalancedStructure: true,
                    suggestedStructure: {
                        reasoning: `Detected ${detectedDomains.length} distinct project domains: ${detectedDomains.map(d => this.projectDomains[d].title).join(', ')}. Suggesting balanced structure with separate parent tasks for each domain.`,
                        parentTasks: detectedDomains.map(domainKey => ({
                            title: this.projectDomains[domainKey].title,
                            description: `${this.projectDomains[domainKey].title} tasks for ${description}`,
                            priority: this.projectDomains[domainKey].priority,
                            domain: domainKey,
                            suggestedSubtasks: this.generateDomainSubtasks(domainKey, description)
                        }))
                    }
                };
            } else {
                // Single domain or no domains detected
                return {
                    shouldUseBalancedStructure: false,
                    suggestedStructure: {
                        reasoning: 'Project appears focused on a single domain or is simple enough for a single parent task.',
                        parentTasks: [{
                            title: 'Project Implementation',
                            description: `Implementation tasks for ${description}`,
                            priority: 'medium',
                            domain: 'general',
                            suggestedSubtasks: []
                        }]
                    }
                };
            }
        } catch (error) {
            logger.error('Error analyzing project hierarchy:', error);
            return {
                shouldUseBalancedStructure: false,
                reasoning: 'Analysis failed, using default structure.'
            };
        }
    }
    
    /**
     * Generate balanced task structure for detected domains
     * @param {Array} domains - Detected project domains
     * @param {string} originalDescription - Original project description
     * @returns {Array} Suggested parent tasks with subtasks
     */
    static generateBalancedStructure(domains, originalDescription) {
        const structure = [];
        
        for (const domainKey of domains) {
            const domain = this.projectDomains[domainKey];
            const parentTask = {
                title: domain.title,
                description: this.generateDomainDescription(domainKey, originalDescription),
                priority: domain.priority,
                isParent: true,
                domain: domainKey,
                suggestedSubtasks: this.generateDomainSubtasks(domainKey, originalDescription)
            };
            
            structure.push(parentTask);
        }
        
        return structure;
    }
    
    /**
     * Generate domain-specific description
     * @param {string} domainKey - Domain identifier
     * @param {string} originalDescription - Original project description
     * @returns {string} Domain-specific description
     */
    static generateDomainDescription(domainKey, originalDescription) {
        const templates = {
            setup: `Initialize project structure and development environment for: ${originalDescription}`,
            backend: `Implement server-side functionality and data management for: ${originalDescription}`,
            frontend: `Create user interface and client-side functionality for: ${originalDescription}`,
            testing: `Ensure quality and reliability through comprehensive testing for: ${originalDescription}`,
            deployment: `Configure deployment pipeline and production environment for: ${originalDescription}`,
            documentation: `Create comprehensive documentation for: ${originalDescription}`
        };
        
        return templates[domainKey] || `Handle ${domainKey} requirements for: ${originalDescription}`;
    }
    
    /**
     * Generate suggested subtasks for a domain
     * @param {string} domainKey - Domain identifier
     * @param {string} originalDescription - Original project description
     * @returns {Array} Suggested subtasks
     */
    static generateDomainSubtasks(domainKey, originalDescription) {
        const subtaskTemplates = {
            setup: [
                { title: 'Initialize project structure', description: 'Create folder structure and basic configuration files' },
                { title: 'Setup development environment', description: 'Install dependencies and configure development tools' },
                { title: 'Configure build tools', description: 'Setup bundling, transpilation, and development server' }
            ],
            backend: [
                { title: 'Design data architecture', description: 'Plan database schema and data relationships' },
                { title: 'Implement core API endpoints', description: 'Create main server functionality and routing' },
                { title: 'Add authentication & security', description: 'Implement user authentication and security measures' }
            ],
            frontend: [
                { title: 'Create component architecture', description: 'Design and implement base components and layouts' },
                { title: 'Implement user interface', description: 'Build interactive user interface elements' },
                { title: 'Integrate with backend services', description: 'Connect frontend with API and handle data flow' }
            ],
            testing: [
                { title: 'Setup testing framework', description: 'Configure testing tools and environment' },
                { title: 'Write unit tests', description: 'Create tests for individual components and functions' },
                { title: 'Implement integration tests', description: 'Test complete workflows and system interactions' }
            ],
            deployment: [
                { title: 'Configure deployment environment', description: 'Setup production hosting and infrastructure' },
                { title: 'Create CI/CD pipeline', description: 'Automate testing, building, and deployment process' },
                { title: 'Monitor and optimize performance', description: 'Setup monitoring and performance optimization' }
            ],
            documentation: [
                { title: 'Write user documentation', description: 'Create guides and documentation for end users' },
                { title: 'Document technical architecture', description: 'Document code structure and technical decisions' },
                { title: 'Create deployment guide', description: 'Document setup and deployment procedures' }
            ],
            gamedev: [
                { title: 'Implement core game mechanics', description: 'Create the fundamental gameplay mechanics and logic' },
                { title: 'Add player controls', description: 'Implement user input handling and character movement' },
                { title: 'Create game state management', description: 'Develop game loop, scoring, and state transitions' }
            ],
            features: [
                { title: 'Add visual effects', description: 'Implement animations, transitions, and visual polish' },
                { title: 'Integrate sound effects', description: 'Add audio feedback and background music' },
                { title: 'Implement game features', description: 'Add additional gameplay features and enhancements' }
            ]
        };
        
        return subtaskTemplates[domainKey] || [];
    }
    
    /**
     * Check if a task should be a subtask or independent parent task
     * @param {string} taskTitle - Title of the task to analyze
     * @param {string} taskDescription - Description of the task
     * @param {Array} existingTasks - Existing tasks in project
     * @returns {Object} Analysis result
     */
    static analyzeTaskPlacement(taskTitle, taskDescription, existingTasks = []) {
        const text = `${taskTitle} ${taskDescription}`.toLowerCase();
        
        // Check if this task clearly belongs to a specific domain
        for (const [domainKey, domain] of Object.entries(this.projectDomains)) {
            if (domain.keywords.some(keyword => text.includes(keyword))) {
                // Look for existing parent task in this domain
                const existingParent = existingTasks.find(task =>
                    !task.isSubtask &&
                    domain.keywords.some(keyword => task.title.toLowerCase().includes(keyword))
                );
                
                if (existingParent) {
                    return {
                        shouldBeSubtask: true,
                        suggestedParent: existingParent.id,
                        domain: domainKey,
                        reasoning: `Task relates to ${domain.title.toLowerCase()} - should be subtask of existing parent task`
                    };
                }
                
                return {
                    shouldBeSubtask: false,
                    suggestedDomain: domainKey,
                    reasoning: `Task relates to ${domain.title.toLowerCase()} but no parent exists - should be independent task`
                };
            }
        }
        
        // Default: independent task
        return {
            shouldBeSubtask: false,
            reasoning: 'Task doesn\'t clearly belong to existing domain - should be independent'
        };
    }
    
    static getSubtaskTemplates(domainKey) {
        return this.generateDomainSubtasks(domainKey, '');
    }
}

export default TaskHierarchyAnalyzer;