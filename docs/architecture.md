# Windsurf Task Master Architecture

## Overview

Windsurf Task Master provides a bridge between Claude Desktop and Windsurf for seamless task management without using external APIs.

## System Architecture

```
┌─────────────────┐      MCP Protocol      ┌─────────────────┐
│ Claude Desktop  │ ◄──────────────────► │  Task Master    │
│                 │                        │  MCP Server     │
└─────────────────┘                        └─────┬───────────┘
                                                │
                                                │ File System
                                                │ Read/Write
                                                │
                                          ┌─────▼───────────┐
                                          │ tasks/tasks.json│
                                          └─────┬───────────┘
                                                │ File Watch
                                                │
                                          ┌─────▼───────────┐
                                          │   Windsurf      │
                                          └─────────────────┘
```

## Components

### 1. Claude Desktop
- Uses MCP tools to create and manage tasks
- Can query task status and updates
- No direct API calls required

### 2. Task Master MCP Server
- Implements MCP protocol for Claude Desktop
- Manages task CRUD operations
- Watches for file changes
- Syncs with Windsurf through file system

### 3. Task Storage (tasks.json)
- Central storage for all tasks
- JSON format for easy parsing
- Accessible by both Claude and Windsurf

### 4. Windsurf
- Monitors task file for changes
- Can update task status directly
- Implements tasks automatically
- Provides completion notifications

## Data Flow

1. **Task Creation**:
   ```
   Claude Desktop → MCP Tool → Task Manager → tasks.json
   ```

2. **Task Updates from Windsurf**:
   ```
   Windsurf → tasks.json → File Watcher → Task Manager → Claude Desktop
   ```

3. **Status Queries**:
   ```
   Claude Desktop → MCP Tool → Task Manager → tasks.json → Response
   ```

## Task Lifecycle

1. **Created**: Task added through Claude Desktop
2. **Pending**: Initial state, waiting for Windsurf
3. **In Progress**: Windsurf picks up and starts implementation
4. **Completed**: Windsurf marks task as done
5. **Synced**: Claude Desktop receives update

## File Structure

```
windsurf-task-master/
├── mcp-server/           # MCP server implementation
├── tasks/                # Task storage
│   └── tasks.json       # Main task file
├── .mcp/                # MCP configuration
└── .windsurfconfig      # Windsurf configuration
```

## Security Considerations

- No external API keys required
- Local file system access only
- No sensitive data transmission
- All operations are local to the machine
