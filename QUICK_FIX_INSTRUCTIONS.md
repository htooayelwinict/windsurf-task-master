# Quick Fix Instructions for JSON Parsing Error

## Files Created

I've recreated all the necessary files to fix your JSON parsing error:

1. **debug-stdout-patch.js** - Logs all stdout traffic for debugging
2. **index-fixed.js** - Fixed version of your main server file
3. **test-fix.js** - Test script to verify the fix
4. **DEBUG_GUIDE.md** - Detailed debugging guide
5. **WINDSURF_PROMPT.md** - AI prompt for Windsurf
6. **apply-fix.sh** - Script to apply the fix automatically

## Quick Fix Steps

### Option 1: Run the Auto-Fix Script

```bash
cd /Users/lewisae/Documents/VSCode/windsurf-task-master
chmod +x apply-fix.sh
./apply-fix.sh
```

### Option 2: Manual Steps

```bash
# Navigate to your project
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server

# Test the fix first
node test-fix.js

# If the test passes, apply the fix
cp src/index-fixed.js src/index.js

# Restart your MCP server (however you normally start it)
# Then restart Claude Desktop
```

## What's Been Fixed

The fix addresses the issue where JSON primitive values (like `null`, `true`, `false`, numbers) were being improperly handled, causing extra characters to be appended to the JSON output.

The key change is in the `stdout.write` interceptor, which now:
1. Correctly detects ALL valid JSON types (not just objects)
2. Ensures proper formatting with exactly one newline
3. Adds comprehensive logging for debugging

## Testing the Fix

After applying the fix:

1. Check the debug logs:
   ```bash
   cat /Users/lewisae/Documents/VSCode/windsurf-task-master/debug_logs/stdout_debug.log
   ```

2. Look for any entries where JSON primitives are being sent
3. Verify there are no extra characters after the JSON

## Using with Windsurf

If you want to use Windsurf AI to apply this fix:

1. Copy the content from `WINDSURF_PROMPT.md`
2. Paste it into Windsurf
3. Ask Windsurf to implement the changes

## Rollback if Needed

If there are any issues, you can rollback:

```bash
cd /Users/lewisae/Documents/VSCode/windsurf-task-master/mcp-server
cp src/index.js.backup src/index.js
```

## Next Steps

1. Apply the fix
2. Test with Claude Desktop
3. Monitor the debug logs for any remaining issues
4. The error "Unexpected non-whitespace character after JSON at position 4" should be resolved
