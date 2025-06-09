#!/usr/bin/env node

/**
 * Windsurf Task Master™ - Copyright Header Script
 * Copyright (c) 2025 Windsurf
 * 
 * This file is part of Windsurf Task Master™, a trademark of Windsurf.
 * 
 * Licensed under the MIT License with trademark provisions.
 * See LICENSE file in the project root for full license information.
 * 
 * Windsurf Task Master™ and the Windsurf Task Master logo are trademarks 
 * of Windsurf. All rights reserved.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const srcDir = path.join(__dirname, 'mcp-server', 'src');
const headerTemplate = (componentName) => `/**
 * Windsurf Task Master™ - ${componentName}
 * Copyright (c) 2025 Windsurf
 * 
 * This file is part of Windsurf Task Master™, a trademark of Windsurf.
 * 
 * Licensed under the MIT License with trademark provisions.
 * See LICENSE file in the project root for full license information.
 * 
 * Windsurf Task Master™ and the Windsurf Task Master logo are trademarks 
 * of Windsurf. All rights reserved.
 */\n\n`;

// Function to format component name from filename
function formatComponentName(filePath) {
  const fileName = path.basename(filePath, '.js');
  const dirName = path.basename(path.dirname(filePath));
  
  // Special case for index.js files
  if (fileName === 'index') {
    if (dirName === 'src') {
      return 'Main Entry Point';
    } else {
      return `${dirName.charAt(0).toUpperCase() + dirName.slice(1)} Module`;
    }
  }
  
  // Convert kebab-case to Title Case with spaces
  return fileName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Function to process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if file already has copyright header
    if (content.includes('Windsurf Task Master™')) {
      console.log(`Skipping ${filePath} - already has copyright header`);
      return;
    }
    
    const componentName = formatComponentName(filePath);
    const header = headerTemplate(componentName);
    const newContent = header + content;
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Added header to ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

// Function to recursively process all JS files in a directory
function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

// Main execution
console.log('Adding copyright headers to all JavaScript files...');
processDirectory(srcDir);
console.log('Also adding header to server.js...');
processFile(path.join(__dirname, 'mcp-server', 'server.js'));
console.log('Done!');