/**
 * Tests for platform.js parsers
 * All tests use pure data — no OS commands are executed.
 */

import { strict as assert } from 'node:assert';
import {
  parseWindowsNetstat,
  parseWindowsTasklist,
  parseWindowsListening,
  parseUnixLsofListen,
} from '../src/platform.js';

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

// ─── parseWindowsNetstat ──────────────────────────────────────────────────────

console.log('\nparseWindowsNetstat');

test('finds PID for TCP LISTENING port', () => {
  const output = `
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:55234          0.0.0.0:0              TIME_WAIT       999
  `;
  assert.equal(parseWindowsNetstat(output, 3000), '4821');
  assert.equal(parseWindowsNetstat(output, 8080), '1234');
});

test('returns null for non-listening port', () => {
  const output = `
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821
  `;
  assert.equal(parseWindowsNetstat(output, 9999), null);
});

test('returns null for TIME_WAIT port', () => {
  const output = `
  TCP    0.0.0.0:55234          0.0.0.0:0              TIME_WAIT       999
  `;
  assert.equal(parseWindowsNetstat(output, 55234), null);
});

test('handles IPv6 addresses', () => {
  const output = `  TCP    [::]:3000              [::]:0                 LISTENING       5555\n`;
  assert.equal(parseWindowsNetstat(output, 3000), '5555');
});

test('returns null for null input', () => {
  assert.equal(parseWindowsNetstat(null, 3000), null);
});

test('returns null for empty output', () => {
  assert.equal(parseWindowsNetstat('', 3000), null);
});

test('handles port 80', () => {
  const output = `  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       4\n`;
  assert.equal(parseWindowsNetstat(output, 80), '4');
});

test('does not match partial port numbers (3000 vs 30001)', () => {
  const output = `  TCP    0.0.0.0:30001          0.0.0.0:0              LISTENING       9999\n`;
  // 3000 should NOT match port 30001
  assert.equal(parseWindowsNetstat(output, 3000), null);
});

// ─── parseWindowsTasklist ─────────────────────────────────────────────────────

console.log('\nparseWindowsTasklist');

test('extracts process name from tasklist CSV', () => {
  const output = `"node.exe","4821","Console","1","65,280 K"\n`;
  assert.equal(parseWindowsTasklist(output), 'node');
});

test('strips .exe extension', () => {
  const output = `"python.exe","1234","Console","1","32,000 K"\n`;
  assert.equal(parseWindowsTasklist(output), 'python');
});

test('handles names without .exe', () => {
  const output = `"myprocess","5678","Console","1","10,000 K"\n`;
  assert.equal(parseWindowsTasklist(output), 'myprocess');
});

test('returns null for empty output', () => {
  assert.equal(parseWindowsTasklist(''), null);
});

test('returns null for null', () => {
  assert.equal(parseWindowsTasklist(null), null);
});

// ─── parseWindowsListening ───────────────────────────────────────────────────

console.log('\nparseWindowsListening');

test('parses multiple LISTENING entries', () => {
  const output = `
  Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       4
  TCP    0.0.0.0:443            0.0.0.0:0              LISTENING       4
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821
  TCP    127.0.0.1:5000         0.0.0.0:0              LISTENING       1234
  TCP    0.0.0.0:55234          0.0.0.0:0              TIME_WAIT       999
  UDP    0.0.0.0:68             *:*                                    123
  `;
  const result = parseWindowsListening(output);
  assert.equal(result.length, 4, `expected 4 entries, got ${result.length}`);
  assert.equal(result[0].port, 80);
  assert.equal(result[1].port, 443);
  assert.equal(result[2].port, 3000);
  assert.equal(result[2].pid, '4821');
  assert.equal(result[3].port, 5000);
});

test('skips UDP entries', () => {
  const output = `  UDP    0.0.0.0:68             *:*                                    123\n`;
  const result = parseWindowsListening(output);
  assert.equal(result.length, 0);
});

test('deduplicates entries', () => {
  const output = `
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821
  TCP    [::]:3000              [::]:0                 LISTENING       4821
  `;
  const result = parseWindowsListening(output);
  // Both are port 3000, same PID — should be deduped
  assert.equal(result.length, 1, 'should deduplicate same port+PID');
});

test('returns empty array for empty input', () => {
  assert.deepEqual(parseWindowsListening(''), []);
  assert.deepEqual(parseWindowsListening(null), []);
});

test('sorts by port number', () => {
  const output = `
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       100
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       200
  TCP    0.0.0.0:443            0.0.0.0:0              LISTENING       4
  `;
  const result = parseWindowsListening(output);
  const ports = result.map(r => r.port);
  assert.deepEqual(ports, [443, 3000, 8080]);
});

// ─── parseUnixLsofListen ─────────────────────────────────────────────────────

console.log('\nparseUnixLsofListen');

const LSOF_OUTPUT = `COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node     4821   user   23u  IPv4 0x1234      0t0  TCP *:3000 (LISTEN)
nginx    1234   root   6u   IPv4 0x5678      0t0  TCP *:80 (LISTEN)
nginx    1234   root   7u   IPv6 0x9abc      0t0  TCP *:80 (LISTEN)
python   5000   user   3u   IPv4 0xdef0      0t0  TCP 127.0.0.1:5000 (LISTEN)`;

test('parses basic lsof output', () => {
  const result = parseUnixLsofListen(LSOF_OUTPUT);
  // nginx IPv4+IPv6 should deduplicate to one port:80 entry
  assert.ok(result.length >= 3, `expected >= 3 entries, got ${result.length}`);
  const port3000 = result.find(r => r.port === 3000);
  assert.ok(port3000, 'should have port 3000');
  assert.equal(port3000.pid, '4821');
  assert.equal(port3000.name, 'node');
});

test('parses specific address correctly', () => {
  const result = parseUnixLsofListen(LSOF_OUTPUT);
  const port5000 = result.find(r => r.port === 5000);
  assert.ok(port5000, 'should have port 5000');
  assert.equal(port5000.address, '127.0.0.1');
  assert.equal(port5000.name, 'python');
});

test('deduplicates same port+PID', () => {
  const result = parseUnixLsofListen(LSOF_OUTPUT);
  const port80entries = result.filter(r => r.port === 80);
  // nginx listens on port 80 for both IPv4 and IPv6 — same PID, should be 1
  assert.equal(port80entries.length, 1, 'should deduplicate nginx port 80');
});

test('sorts by port number', () => {
  const result = parseUnixLsofListen(LSOF_OUTPUT);
  const ports = result.map(r => r.port);
  const sorted = [...ports].sort((a, b) => a - b);
  assert.deepEqual(ports, sorted, 'results should be sorted by port');
});

test('returns empty array for null input', () => {
  assert.deepEqual(parseUnixLsofListen(null), []);
});

test('returns empty array for empty string', () => {
  assert.deepEqual(parseUnixLsofListen(''), []);
});

test('handles header-only output', () => {
  const output = 'COMMAND   PID   USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\n';
  assert.deepEqual(parseUnixLsofListen(output), []);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nplatform.test.js: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
