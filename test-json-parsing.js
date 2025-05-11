/**
 * Test script to verify JSON parsing and CPU usage
 * This simulates sending JSON-RPC messages to the MCP server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting JSON parsing test...');

// Spawn the MCP server process
const mcp = spawn('node', ['mcp-server/server.js'], {
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

// Monitor CPU usage
let cpuReadings = [];
const monitorCPU = () => {
  const startTime = process.hrtime();
  const startUsage = process.cpuUsage();
  
  return setInterval(() => {
    const elapTime = process.hrtime(startTime);
    const elapUsage = process.cpuUsage(startUsage);
    
    const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
    const elapUserMS = elapUsage.user / 1000;
    const elapSystMS = elapUsage.system / 1000;
    
    const cpuPercent = Math.round(100 * (elapUserMS + elapSystMS) / elapTimeMS) / 10;
    cpuReadings.push(cpuPercent);
    
    console.log(`[${Math.round(elapTimeMS)}ms] CPU Usage: ${cpuPercent}%`);
  }, 500);
};

// Test sequence
const runTest = async () => {
  // Wait for server to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Start CPU monitoring
  const cpuMonitor = monitorCPU();
  
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
  
  // Continue monitoring CPU for a bit after disconnect
  await new Promise(resolve => setTimeout(resolve, 2000));
  clearInterval(cpuMonitor);
  
  // Calculate CPU usage statistics
  const avgCPU = cpuReadings.length > 0 
    ? cpuReadings.reduce((sum, val) => sum + val, 0) / cpuReadings.length 
    : 0;
  const maxCPU = cpuReadings.length > 0 
    ? Math.max(...cpuReadings) 
    : 0;
  
  console.log('\n--- TEST RESULTS ---');
  console.log(`Average CPU Usage: ${avgCPU.toFixed(1)}%`);
  console.log(`Maximum CPU Usage: ${maxCPU.toFixed(1)}%`);
  console.log(`${avgCPU < 5 ? '✅ LOW CPU USAGE DETECTED. The fix appears to be working correctly.' : '❌ HIGH CPU USAGE DETECTED. The fix is not working.'}`);
  
  // Kill the process if it's still running
  if (!mcp.killed) {
    mcp.kill();
  }
  
  console.log('Test completed.');
  process.exit(0);
};

// Handle process exit
mcp.on('exit', (code) => {
  console.log(`Process Status: ${code === 0 ? '✅ Properly Terminated' : '❌ Failed to terminate properly'}`);
});

// Run the test
runTest().catch(error => {
  console.error('Test error:', error);
  if (!mcp.killed) {
    mcp.kill();
  }
  process.exit(1);
});
