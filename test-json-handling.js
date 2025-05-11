/**
 * Test script to verify JSON handling and logging behavior
 * This simulates MCP message handling and disconnection
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the MCP server entry point
const serverPath = join(__dirname, 'mcp-server', 'src', 'index.js');

console.log('Starting test of MCP server JSON handling...');

// Spawn the MCP server process
const mcp = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Track output for analysis
let stdoutData = '';
let stderrData = '';

// Collect stdout data
mcp.stdout.on('data', (data) => {
  const chunk = data.toString();
  stdoutData += chunk;
  console.log('[MCP stdout]', chunk.trim());
});

// Collect stderr data
mcp.stderr.on('data', (data) => {
  const chunk = data.toString();
  stderrData += chunk;
  console.log('[MCP stderr]', chunk.trim());
});

// Test sequence
const runTest = async () => {
  // Wait for server to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 1: Send a valid JSON-RPC message
  console.log('\nSending test message 1/4:');
  const validMessage = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    id: 1
  });
  mcp.stdin.write(validMessage + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 2: Send another valid JSON-RPC message
  console.log('\nSending test message 2/4:');
  const validMessage2 = JSON.stringify({
    jsonrpc: '2.0',
    method: 'resources/list',
    params: {},
    id: 2
  });
  mcp.stdin.write(validMessage2 + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 3: Send an invalid JSON message (missing quotes)
  console.log('\nSending test message 3/4:');
  const invalidMessage = '{"jsonrpc": "2.0", method: "prompts/list", "params": {}, "id": 4}';
  mcp.stdin.write(invalidMessage + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 4: Send a notification
  console.log('\nSending test message 4/4:');
  const notification = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  });
  mcp.stdin.write(notification + '\n');
  
  // Wait before simulating disconnect
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\nWaiting before simulating disconnect...\n');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate Windsurf disconnect by closing stdin
  console.log('--- SIMULATING DISCONNECT ---');
  console.log('Closing stdin to simulate Windsurf disconnect...');
  mcp.stdin.end();
  
  console.log('Waiting for process to handle disconnect...');
  
  // Wait for process to exit or force kill after timeout
  const exitPromise = new Promise(resolve => {
    mcp.on('exit', (code, signal) => {
      console.log(`MCP server process exited with code ${code} and signal ${signal}`);
      resolve({ code, signal });
    });
  });
  
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => {
      console.log('Timeout reached, killing process...');
      mcp.kill();
      resolve({ code: -1, signal: 'TIMEOUT' });
    }, 3000);
  });
  
  const result = await Promise.race([exitPromise, timeoutPromise]);
  
  console.log('\n--- TEST RESULTS ---');
  console.log(`Process Status: ${result.code === 0 ? '✅ Properly Terminated' : '❌ Failed to terminate properly'}`);
  console.log('Test completed.');
};

// Handle process exit
mcp.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`MCP server process exited with code ${code}`);
  }
});

// Run the test
runTest().catch(error => {
  console.error('Test error:', error);
  mcp.kill();
});
