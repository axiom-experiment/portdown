/**
 * Tests for killer.js — uses dependency injection to avoid real OS calls
 */

import { strict as assert } from 'node:assert';
import { killPort, killPorts } from '../src/killer.js';
import { IS_WINDOWS } from '../src/platform.js';

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Build a mock execFn that simulates a running process on port 3000 (PID 4821, name 'node')
function buildMockExec(opts = {}) {
  const { port = 3000, pid = '4821', name = 'node', killFails = false } = opts;
  let callN = 0;

  return (cmd) => {
    callN++;
    // First call: find PID
    if (IS_WINDOWS) {
      if (cmd.includes('netstat')) {
        if (cmd.includes('netstat')) {
          return `  TCP    0.0.0.0:${port}           0.0.0.0:0              LISTENING       ${pid}\n`;
        }
      }
      if (cmd.includes('tasklist')) return `"${name}.exe","${pid}","Console","1","65,280 K"\n`;
      if (cmd.includes('wmic')) return `CommandLine=${name} server.js\r\n`;
      if (cmd.includes('taskkill')) {
        if (killFails) throw new Error('Access denied');
        return `SUCCESS: The process with PID ${pid} has been terminated.\n`;
      }
    } else {
      if (cmd.includes('lsof -ti')) return `${pid}\n`;
      if (cmd.includes('ps') && cmd.includes('-o comm=')) return `${name}\n`;
      if (cmd.includes('ps') && cmd.includes('-o args=')) return `${name} server.js\n`;
      if (cmd.startsWith('kill')) {
        if (killFails) throw new Error('Operation not permitted');
        return '';
      }
    }
    return '';
  };
}

// Mock exec that returns nothing for any PID lookup (port is free)
function buildFreeMockExec() {
  return (cmd) => {
    if (IS_WINDOWS) {
      if (cmd.includes('netstat')) return '  TCP    0.0.0.0:8080    0.0.0.0:0    LISTENING    9999\n';
    }
    return '';
  };
}

// ─── killPort ────────────────────────────────────────────────────────────────

console.log('\nkillPort');

test('returns success:true when process is killed', () => {
  const mockExec = buildMockExec({ port: 3000 });
  const result = killPort(3000, { execFn: mockExec });
  assert.equal(result.success, true, `expected success but got: ${JSON.stringify(result)}`);
  assert.equal(result.alreadyFree, false);
  assert.equal(result.pid, '4821');
  assert.equal(result.port, 3000);
});

test('returns alreadyFree:true when port is not in use', () => {
  const mockExec = buildFreeMockExec();
  const result = killPort(9999, { execFn: mockExec });
  assert.equal(result.alreadyFree, true);
  assert.equal(result.success, false);
  assert.equal(result.pid, null);
  assert.equal(result.port, 9999);
});

test('returns process name in result', () => {
  const mockExec = buildMockExec({ port: 3000, name: 'python' });
  const result = killPort(3000, { execFn: mockExec });
  assert.equal(result.name, 'python');
});

test('returns success:false when kill command fails', () => {
  const mockExec = buildMockExec({ port: 3000, killFails: true });
  const result = killPort(3000, { execFn: mockExec });
  assert.equal(result.success, false);
  assert.equal(result.alreadyFree, false);
});

test('passes force option to kill command', () => {
  let killedWithForce = false;
  const mockExec = (cmd) => {
    if (IS_WINDOWS) {
      if (cmd.includes('netstat')) return `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821\n`;
      if (cmd.includes('tasklist')) return '"node.exe","4821","Console","1","65,280 K"\n';
      if (cmd.includes('wmic')) return 'CommandLine=node server.js\r\n';
      if (cmd.includes('taskkill')) {
        killedWithForce = cmd.includes('/F');
        return 'SUCCESS\n';
      }
    } else {
      if (cmd.includes('lsof -ti')) return '4821\n';
      if (cmd.includes('-o comm=')) return 'node\n';
      if (cmd.includes('-o args=')) return 'node server.js\n';
      if (cmd.startsWith('kill')) {
        killedWithForce = cmd.includes('-9');
        return '';
      }
    }
    return '';
  };
  killPort(3000, { force: true, execFn: mockExec });
  assert.equal(killedWithForce, true, 'should use force kill signal');
});

test('uses SIGTERM (not SIGKILL) by default', () => {
  let usedSigterm = false;
  const mockExec = (cmd) => {
    if (IS_WINDOWS) {
      if (cmd.includes('netstat')) return `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821\n`;
      if (cmd.includes('tasklist')) return '"node.exe","4821","Console","1","65,280 K"\n';
      if (cmd.includes('wmic')) return 'CommandLine=node server.js\r\n';
      if (cmd.includes('taskkill')) {
        usedSigterm = !cmd.includes('/F');
        return 'SUCCESS\n';
      }
    } else {
      if (cmd.includes('lsof -ti')) return '4821\n';
      if (cmd.includes('-o comm=')) return 'node\n';
      if (cmd.includes('-o args=')) return 'node server.js\n';
      if (cmd.startsWith('kill')) {
        usedSigterm = cmd.includes('-15');
        return '';
      }
    }
    return '';
  };
  killPort(3000, { execFn: mockExec });
  assert.equal(usedSigterm, true, 'should use SIGTERM by default');
});

// ─── killPorts ───────────────────────────────────────────────────────────────

console.log('\nkillPorts');

test('returns array of results for multiple ports', () => {
  // Port 3000 in use, port 9999 free
  const mockExec = (cmd) => {
    if (IS_WINDOWS) {
      if (cmd.includes('netstat')) return `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821\n`;
      if (cmd.includes('tasklist')) return '"node.exe","4821","Console","1","65,280 K"\n';
      if (cmd.includes('wmic')) return 'CommandLine=node server.js\r\n';
      if (cmd.includes('taskkill')) return 'SUCCESS\n';
    } else {
      if (cmd.includes('lsof -ti TCP:3000')) return '4821\n';
      if (cmd.includes('lsof -ti TCP:9999')) return '';
      if (cmd.includes('-o comm=')) return 'node\n';
      if (cmd.includes('-o args=')) return 'node server.js\n';
      if (cmd.startsWith('kill')) return '';
    }
    return '';
  };
  const results = killPorts([3000, 9999], { execFn: mockExec });
  assert.equal(results.length, 2);
  const r3000 = results.find(r => r.port === 3000);
  const r9999 = results.find(r => r.port === 9999);
  assert.ok(r3000, 'should have result for port 3000');
  assert.ok(r9999, 'should have result for port 9999');
  assert.equal(r9999.alreadyFree, true);
});

test('returns empty array for empty ports list', () => {
  const results = killPorts([]);
  assert.deepEqual(results, []);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nkiller.test.js: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
