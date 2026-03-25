/**
 * Tests for finder.js — uses dependency injection (execFn) to avoid real OS calls
 */

import { strict as assert } from 'node:assert';
import { findPid, findProcessName, findCommandLine, findPortInfo, isPortInUse } from '../src/finder.js';
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

// We inject fake execFn to simulate OS responses
// The execFn receives a command string and returns the mock output

// ─── findPid ────────────────────────────────────────────────────────────────

console.log('\nfindPid');

if (IS_WINDOWS) {
  test('returns PID when port is in use (Windows)', () => {
    const mockExec = () => `
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821
    `;
    const pid = findPid(3000, mockExec);
    assert.equal(pid, '4821');
  });

  test('returns null when port is not in use (Windows)', () => {
    const mockExec = () => `  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234\n`;
    const pid = findPid(9999, mockExec);
    assert.equal(pid, null);
  });

  test('returns null when exec fails/returns null (Windows)', () => {
    const mockExec = () => { throw new Error('command failed'); };
    const pid = findPid(3000, mockExec);
    assert.equal(pid, null);
  });
} else {
  test('returns PID when port is in use (Unix)', () => {
    const mockExec = () => '4821\n';
    const pid = findPid(3000, mockExec);
    assert.equal(pid, '4821');
  });

  test('returns null when port is not in use (Unix)', () => {
    const mockExec = () => '';
    const pid = findPid(9999, mockExec);
    assert.equal(pid, null);
  });

  test('returns first PID when multiple PIDs returned (Unix)', () => {
    // lsof may return multiple PIDs in rare cases
    const mockExec = () => '4821\n5000\n';
    const pid = findPid(3000, mockExec);
    assert.equal(pid, '4821', 'should return first PID only');
  });

  test('returns null when exec throws (Unix)', () => {
    const mockExec = () => { throw new Error('lsof not found'); };
    const pid = findPid(3000, mockExec);
    assert.equal(pid, null);
  });
}

// ─── findProcessName ─────────────────────────────────────────────────────────

console.log('\nfindProcessName');

if (IS_WINDOWS) {
  test('extracts process name from tasklist CSV (Windows)', () => {
    const mockExec = () => '"node.exe","4821","Console","1","65,280 K"\n';
    const name = findProcessName('4821', mockExec);
    assert.equal(name, 'node');
  });

  test('returns null when tasklist is empty (Windows)', () => {
    const mockExec = () => '';
    const name = findProcessName('9999', mockExec);
    assert.equal(name, null);
  });
} else {
  test('returns process name from ps (Unix)', () => {
    const mockExec = () => 'node\n';
    const name = findProcessName('4821', mockExec);
    assert.equal(name, 'node');
  });

  test('returns null when ps returns empty (Unix)', () => {
    const mockExec = () => '';
    const name = findProcessName('9999', mockExec);
    assert.equal(name, null);
  });

  test('trims whitespace from ps output (Unix)', () => {
    const mockExec = () => '  python3  \n';
    const name = findProcessName('1234', mockExec);
    assert.equal(name, 'python3');
  });
}

// ─── findCommandLine ─────────────────────────────────────────────────────────

console.log('\nfindCommandLine');

if (IS_WINDOWS) {
  test('extracts command line from wmic output (Windows)', () => {
    const mockExec = () => 'CommandLine=node server.js --port 3000\r\n\r\n';
    const cmd = findCommandLine('4821', mockExec);
    assert.equal(cmd, 'node server.js --port 3000');
  });

  test('returns null when wmic output is empty (Windows)', () => {
    const mockExec = () => '';
    const cmd = findCommandLine('9999', mockExec);
    assert.equal(cmd, null);
  });
} else {
  test('returns full command from ps (Unix)', () => {
    const mockExec = () => 'node /app/server.js --port 3000\n';
    const cmd = findCommandLine('4821', mockExec);
    assert.equal(cmd, 'node /app/server.js --port 3000');
  });

  test('returns null for empty ps output (Unix)', () => {
    const mockExec = () => '';
    const cmd = findCommandLine('9999', mockExec);
    assert.equal(cmd, null);
  });
}

// ─── findPortInfo ─────────────────────────────────────────────────────────────

console.log('\nfindPortInfo');

test('returns null when port is free', () => {
  // Simulate: findPid returns null → no process
  const callCount = { n: 0 };
  const mockExec = () => {
    callCount.n++;
    if (IS_WINDOWS) {
      return '  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234\n';
    }
    return ''; // lsof returns nothing
  };
  const info = findPortInfo(9999, mockExec);
  assert.equal(info, null);
});

test('returns info object when port is in use', () => {
  // This test simulates on Unix: first call returns PID, second returns name, third returns cmdline
  if (IS_WINDOWS) {
    let callN = 0;
    const mockExec = () => {
      callN++;
      if (callN === 1) return '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821\n'; // netstat
      if (callN === 2) return '"node.exe","4821","Console","1","65,280 K"\n'; // tasklist
      return 'CommandLine=node server.js\r\n'; // wmic
    };
    const info = findPortInfo(3000, mockExec);
    assert.ok(info, 'should return info object');
    assert.equal(info.port, 3000);
    assert.equal(info.pid, '4821');
    assert.equal(info.name, 'node');
  } else {
    let callN = 0;
    const mockExec = () => {
      callN++;
      if (callN === 1) return '4821\n'; // lsof -ti
      if (callN === 2) return 'node\n'; // ps comm
      return 'node /app/server.js\n'; // ps args
    };
    const info = findPortInfo(3000, mockExec);
    assert.ok(info, 'should return info object');
    assert.equal(info.port, 3000);
    assert.equal(info.pid, '4821');
    assert.equal(info.name, 'node');
    assert.equal(info.cmd, 'node /app/server.js');
  }
});

// ─── isPortInUse ──────────────────────────────────────────────────────────────

console.log('\nisPortInUse');

test('returns true when port is in use', () => {
  const mockExec = IS_WINDOWS
    ? () => '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821\n'
    : () => '4821\n';
  assert.equal(isPortInUse(3000, mockExec), true);
});

test('returns false when port is free', () => {
  const mockExec = IS_WINDOWS
    ? () => '  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234\n'
    : () => '';
  assert.equal(isPortInUse(9999, mockExec), false);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nfinder.test.js: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
