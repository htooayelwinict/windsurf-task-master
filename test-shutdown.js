/**
 * Test script to verify MCP server shutdown behavior
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the MCP server entry point
const serverPath = join(__dirname, 'mcp-server', 'src', 'server.js');

console.log('Starting test of MCP server shutdown behavior...');

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

// Wait for server to initialize, then simulate disconnect
setTimeout(() => {
  console.log('\n--- SIMULATING DISCONNECT ---');
  console.log('Closing stdin to simulate Windsurf disconnect...');
  mcp.stdin.end();
  
  console.log('Waiting for process to exit...');
}, 1000);

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

// Start CPU monitoring after a short delay
const cpuMonitor = setTimeout(() => {
  monitorCPU();
}, 1500);

// Handle process exit
mcp.on('exit', (code, signal) => {
  clearTimeout(cpuMonitor);
  
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
  console.log(`Process Status: ${code === 0 ? '✅ Properly Terminated' : '❌ Failed to terminate properly'}`);
  console.log('Test completed.');
});

// Set a timeout to kill the process if it doesn't exit on its own
setTimeout(() => {
  if (!mcp.killed) {
    console.log('\n❌ TIMEOUT: MCP server did not exit within 5 seconds');
    mcp.kill();
  }
}, 5000);
