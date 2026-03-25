/**
 * Tests for lister.js
 */

import { strict as assert } from 'node:assert';
import { listPorts, filterPorts } from '../src/lister.js';
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

// ─── listPorts ───────────────────────────────────────────────────────────────

console.log('\nlistPorts');

test('returns array of listening ports', () => {
  const mockExec = IS_WINDOWS
    ? () => `  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821\n  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234\n`
    : () => `COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnode     4821   user   23u  IPv4 0x1234      0t0  TCP *:3000 (LISTEN)\nnginx    1234   root   6u   IPv4 0x5678      0t0  TCP *:8080 (LISTEN)`;

  const ports = listPorts({ execFn: mockExec });
  assert.ok(Array.isArray(ports), 'should return array');
  assert.ok(ports.length >= 2, `should have at least 2 entries, got ${ports.length}`);
  const port3000 = ports.find(p => p.port === 3000);
  assert.ok(port3000, 'should have port 3000');
  assert.equal(port3000.pid, '4821');
});

test('returns empty array when nothing is listening', () => {
  const mockExec = IS_WINDOWS
    ? () => 'Active Connections\n'
    : () => 'COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\n';

  const ports = listPorts({ execFn: mockExec });
  assert.deepEqual(ports, []);
});

test('returns empty array when exec throws', () => {
  const mockExec = () => { throw new Error('command not found'); };
  const ports = listPorts({ execFn: mockExec });
  assert.deepEqual(ports, []);
});

test('sorts results by port number', () => {
  const mockExec = IS_WINDOWS
    ? () => `
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       100
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       200
  TCP    0.0.0.0:443            0.0.0.0:0              LISTENING       4
    `
    : () => `COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
httpd    100   root   6u   IPv4 0x1234      0t0  TCP *:8080 (LISTEN)
node     200   user   23u  IPv4 0x5678      0t0  TCP *:3000 (LISTEN)
nginx    4     root   6u   IPv4 0x9abc      0t0  TCP *:443 (LISTEN)`;

  const ports = listPorts({ execFn: mockExec });
  const portNums = ports.map(p => p.port);
  assert.deepEqual(portNums, [...portNums].sort((a, b) => a - b), 'should be sorted');
});

// ─── filterPorts ─────────────────────────────────────────────────────────────

console.log('\nfilterPorts');

const SAMPLE_PORTS = [
  { port: 80, pid: '4', name: 'nginx', address: '*' },
  { port: 3000, pid: '4821', name: 'node', address: '*' },
  { port: 5000, pid: '4821', name: 'node', address: '127.0.0.1' },
  { port: 8080, pid: '1234', name: 'python', address: '*' },
  { port: 9200, pid: '5000', name: 'elasticsearch', address: '127.0.0.1' },
];

test('filter by pid', () => {
  const result = filterPorts(SAMPLE_PORTS, { pid: '4821' });
  assert.equal(result.length, 2);
  assert.ok(result.every(p => p.pid === '4821'));
});

test('filter by name (case-insensitive, partial match)', () => {
  const result = filterPorts(SAMPLE_PORTS, { name: 'node' });
  assert.equal(result.length, 2);

  const result2 = filterPorts(SAMPLE_PORTS, { name: 'NODE' });
  assert.equal(result2.length, 2, 'filter should be case-insensitive');

  const result3 = filterPorts(SAMPLE_PORTS, { name: 'ela' });
  assert.equal(result3.length, 1, 'partial match on "ela" should match elasticsearch');
});

test('filter by minPort', () => {
  const result = filterPorts(SAMPLE_PORTS, { minPort: 3000 });
  assert.ok(result.every(p => p.port >= 3000), 'all ports should be >= 3000');
  assert.ok(!result.find(p => p.port === 80), 'port 80 should be excluded');
});

test('filter by maxPort', () => {
  const result = filterPorts(SAMPLE_PORTS, { maxPort: 5000 });
  assert.ok(result.every(p => p.port <= 5000));
  assert.ok(!result.find(p => p.port > 5000));
});

test('filter by minPort and maxPort combined', () => {
  const result = filterPorts(SAMPLE_PORTS, { minPort: 3000, maxPort: 8080 });
  assert.equal(result.length, 3); // 3000, 5000, 8080
});

test('returns all entries when no filter specified', () => {
  const result = filterPorts(SAMPLE_PORTS, {});
  assert.equal(result.length, SAMPLE_PORTS.length);
});

test('returns empty array when no entries match', () => {
  const result = filterPorts(SAMPLE_PORTS, { name: 'nonexistent-process-xyz' });
  assert.equal(result.length, 0);
});

test('handles empty input array', () => {
  const result = filterPorts([], { name: 'node' });
  assert.deepEqual(result, []);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nlister.test.js: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
