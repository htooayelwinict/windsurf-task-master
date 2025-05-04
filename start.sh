#!/bin/bash

# Start the Windsurf Task Master MCP Server

echo "Starting Windsurf Task Master MCP Server..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the server
node mcp-server/server.js
