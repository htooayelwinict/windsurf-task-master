# Debugging JSON Parse Error in Windsurf Task Master MCP Server

## The Problem

You're getting an error: `Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)`

This means something is appending unexpected characters to JSON responses, most likely affecting simple primitive values like `null`, `true`, `false`, or numbers.

## Files Created to Help Debug

1. `debug-stdout-patch.js` - Logs all stdout traffic to help identify what's being sent
2. `index-fixed.js` - Fixed version of the main server with better JSON handling
3. `test-fix.js` - Test script to verify the fix
4. `debug_logs/stdout_debug.log` - Log file capturing all stdout traffic

## Steps to Debug and Fix

### Step 1: Run the Test Script

```bash
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server
chmod +x test-fix.js
node test-fix.js
```

This will:
- Test various JSON primitives that might be causing issues
- Log all stdout traffic to a debug file
- Show exactly what's being sent over the wire

### Step 2: Check Debug Logs

After running the test, check:
```
cat ../debug_logs/stdout_debug.log
```

Look for any entries where the JSON has extra characters after the valid content.

### Step 3: Update Your Main Server File

If the test shows the fix works, replace your current `src/index.js` with the fixed version:

```bash
cp src/index-fixed.js src/index.js
```

### Step 4: Restart Claude Desktop

Make sure to restart Claude Desktop completely:
1. Quit Claude Desktop entirely
2. Start it again
3. Test the MCP server connection

## Key Changes Made

1. **Better JSON Primitive Handling**: The patched stdout handler now properly detects and handles all JSON types, not just objects and arrays.

2. **Consistent Newline Handling**: Ensures every message ends with exactly one newline character.

3. **Enhanced Debugging**: All stdout traffic is logged with hex values to help identify exactly what's being sent.

4. **Safe JSON Processing**: Uses the existing `safeStringifyJson` function consistently.

## Common Causes and Solutions

### Cause 1: Console.log Mixing with JSON Output
- **Problem**: Debug logs going to stdout instead of stderr
- **Solution**: Use `console.error()` for debug logs

### Cause 2: Semicolons Added to Simple Values
- **Problem**: Code like `process.stdout.write(JSON.stringify(null) + ';')`
- **Solution**: The fixed version ensures clean JSON output

### Cause 3: Unescaped Characters in JSON Strings
- **Problem**: Special characters not properly escaped
- **Solution**: The fixed version uses safe JSON stringification

## Testing the Fix

Once you've applied the fix, test with claude-desktop by:

1. Making sure the server is started with the fixed code
2. Trying various MCP commands that might return simple values
3. Checking the debug logs for any problematic output

## If You Still Have Issues

1. Check the debug logs in `debug_logs/stdout_debug.log`
2. Look for entries where the hex values show extra characters
3. The position mentioned in the error (position 4) corresponds to the 5th byte in the hex dump

## Quick Fix Commands

```bash
# Navigate to your project
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server

# Test the fix
node test-fix.js

# If it works, apply the fix
cp src/index-fixed.js src/index.js

# Restart the server (however you normally start it)
# For example:
npm start
# or
node server.js
```

## Monitoring for Future Issues

The debug logging can be left enabled to help catch similar issues in the future. You can disable it by removing the `patchStdoutForDebugging()` call from the constructor in `index.js`.
