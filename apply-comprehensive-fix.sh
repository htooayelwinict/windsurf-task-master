#!/bin/bash

# Apply the comprehensive fix for the MCP server stdout/stderr issue

echo "=== Applying Comprehensive Fix for MCP Server ==="
echo ""

# Navigate to the MCP server directory
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server

# Create backups
echo "Creating backups..."
cp src/index.js src/index.js.backup
cp src/utils/error-recovery.js src/utils/error-recovery.js.backup

# Copy the new error recovery file
echo "Updating error recovery module..."
cp src/utils/error-recovery-fixed.js src/utils/error-recovery.js

# Apply the final fix
echo "Applying the comprehensive fix..."
cp src/index-final-fix.js src/index.js

echo ""
echo "=== Fix Applied Successfully! ==="
echo ""
echo "The following changes have been made:"
echo "1. All logging is now redirected to stderr (no more stdout pollution)"
echo "2. Fixed the error recovery mechanism to prevent runaway error counts"
echo "3. Added strict stdout JSON validation"
echo "4. Created safe JSON-RPC writer that only writes to stdout"
echo ""
echo "Next steps:"
echo "1. Restart your MCP server"
echo "2. Restart Claude Desktop"
echo "3. Test the connection"
echo ""
echo "If you still have issues, check the logs with:"
echo "tail -f ../debug_logs/stdout_debug.log"
echo ""
echo "To rollback if needed:"
echo "cp src/index.js.backup src/index.js"
echo "cp src/utils/error-recovery.js.backup src/utils/error-recovery.js"
