# Windsurf Post-Fix Debugging Prompt

## Context

I've applied a comprehensive fix for the JSON parsing error in my MCP server. The main issue was log messages being written to stdout instead of stderr, violating the MCP protocol. The fix:

1. Redirected all logging to stderr
2. Fixed the error recovery mechanism to prevent runaway error counts
3. Added strict stdout/stderr separation with validation
4. Created a safe JSON-RPC writer

## Next Steps: Debugging and Verification

Please help me debug and verify that the fix is working correctly:

### 1. Verify Fix Application

First, check that the fix was properly applied:

```bash
# Check that the files were updated correctly
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server
ls -la src/index.js src/utils/error-recovery.js
head -20 src/index.js | grep enforceStderrLogging
```

### 2. Start MCP Server with Monitoring

Start the MCP server with proper logging:

```bash
# Create a new log file for this session
cd /Users/lewisae/Documents/VSCode/windsurf-task-master
mkdir -p debug_logs
echo "=== MCP Server Debug Session $(date) ===" > debug_logs/mcp_server_debug.log

# Start the server with both stdout and stderr captured
cd mcp-server
node server.js 2>> ../debug_logs/mcp_server_debug.log | tee ../debug_logs/mcp_server_stdout.log
```

### 3. Monitor Output Streams

In separate terminals, monitor the output:

```bash
# Monitor stderr (should contain all logs)
tail -f /Users/lewisae/Documents/VSCode/windsurf-task-master/debug_logs/mcp_server_debug.log

# Monitor stdout (should ONLY contain JSON-RPC messages)
tail -f /Users/lewisae/Documents/VSCode/windsurf-task-master/debug_logs/mcp_server_stdout.log
```

### 4. Test with Claude Desktop

1. Start Claude Desktop
2. Check for the "Unexpected non-whitespace character" error
3. Try executing some MCP commands
4. Monitor the logs for any issues

### 5. Validate Proper Output Separation

Check the output files:

```bash
# Stdout should only contain valid JSON
cd /Users/lewisae/Documents/VSCode/windsurf-task-master
echo "=== Checking stdout for non-JSON content ==="
grep -v '^{' debug_logs/mcp_server_stdout.log || echo "✓ stdout is clean (only JSON)"

# Stderr should contain all logs
echo "=== Sample of stderr logs ==="
head -10 debug_logs/mcp_server_debug.log
```

### 6. Test Error Recovery

Intentionally cause an error to test recovery:

```bash
# Send invalid JSON to test error handling
echo "invalid json" | node server.js
```

Monitor for:
- No runaway error counts
- Proper error messages in stderr
- Clean JSON error response in stdout

### 7. Performance Check

Verify the fix doesn't impact performance:

```bash
# Monitor server resources
top -l 5 | grep -E "PID|node"

# Check for memory leaks
ps aux | grep node | grep -v grep
```

### 8. Test All MCP Commands

Test each MCP command to ensure they work properly:

```
# Example commands to test:
- tools/list
- tools/call with create_task
- tools/call with list_tasks
- tools/call with update_task
- etc.
```

### 9. If Issues Persist

If you still see issues:

1. Check the exact error message
2. Look at the hex dump in debug logs
3. Verify the JSON structure of responses
4. Check for any remaining stdout pollution

### 10. Rollback Plan

If the fix caused new issues:

```bash
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server
cp src/index.js.backup src/index.js
cp src/utils/error-recovery.js.backup src/utils/error-recovery.js
```

## What to Look For

✅ **Success Indicators:**
- No "Unexpected non-whitespace character" errors
- All logs appear in stderr
- Stdout only contains valid JSON-RPC messages
- Error recovery works without runaway counts

❌ **Warning Signs:**
- Non-JSON text in stdout
- Parsing errors in Claude Desktop
- High error counts
- Performance degradation

## Questions for Windsurf

1. Can you help analyze the debug logs to confirm the fix is working?
2. Are there any remaining issues with the MCP communication?
3. Should we add additional monitoring or logging?
4. Are there any edge cases we should test?
5. Can you help optimize the error recovery mechanism further?

Please review the output from these debugging steps and help identify any remaining issues or improvements needed.
