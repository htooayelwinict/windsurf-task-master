#!/bin/bash

# Apply the JSON parsing fix for the MCP server

echo "Applying JSON parsing fix for Windsurf Task Master MCP Server..."

# Navigate to the MCP server directory
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server

# Backup the current index.js file
echo "Creating backup of current index.js..."
cp src/index.js src/index.js.backup

# Apply the fix by copying the fixed version
echo "Applying the fix..."
cp src/index-fixed.js src/index.js

# Create the debug logs directory if it doesn't exist
echo "Setting up debug logs directory..."
mkdir -p ../debug_logs

# Make the test script executable
echo "Making test script executable..."
chmod +x test-fix.js

echo ""
echo "Fix applied successfully!"
echo ""
echo "Next steps:"
echo "1. Run the test script: cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server && node test-fix.js"
echo "2. Check debug logs: cat ../debug_logs/stdout_debug.log"
echo "3. Restart Claude Desktop and test the connection"
echo ""
echo "If you need to rollback, run: cp src/index.js.backup src/index.js"
echo ""
echo "For detailed instructions, see: DEBUG_GUIDE.md and WINDSURF_PROMPT.md"
