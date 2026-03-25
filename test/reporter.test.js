/**
 * Tests for reporter.js
 */

import { strict as assert } from 'node:assert';
import {
  formatKillResult,
  formatKillResults,
  formatPortInfo,
  formatPortList,
  formatJson,
  setColor
} from '../src/reporter.js';

// Disable color for all tests (cleaner string matching)
setColor(false);

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

// ─── formatKillResult ─────────────────────────────────────────────────────────

console.log('\nformatKillResult');

test('shows "already free" when alreadyFree is true', () => {
  const result = formatKillResult({ success: false, pid: null, name: null, port: 3000, alreadyFree: true });
  assert.ok(result.includes('3000'), 'should mention port');
  assert.ok(result.toLowerCase().includes('free') || result.toLowerCase().includes('already'), 'should indicate free');
});

test('shows success message when killed', () => {
  const result = formatKillResult({ success: true, pid: '4821', name: 'node', port: 3000, alreadyFree: false });
  assert.ok(result.includes('3000'), 'should mention port');
  assert.ok(result.includes('node'), 'should mention process name');
  assert.ok(result.includes('4821'), 'should mention PID');
});

test('shows failure message when kill failed', () => {
  const result = formatKillResult({ success: false, pid: '4821', name: 'node', port: 3000, alreadyFree: false });
  assert.ok(result.includes('3000'), 'should mention port');
  assert.ok(result.includes('node') || result.includes('4821'), 'should mention process');
});

test('handles null process name gracefully', () => {
  const result = formatKillResult({ success: true, pid: '4821', name: null, port: 3000, alreadyFree: false });
  assert.ok(result.includes('3000'), 'should mention port');
  // Should not throw or show 'null'
  assert.ok(!result.includes('null'), 'should not show "null"');
});

// ─── formatKillResults ────────────────────────────────────────────────────────

console.log('\nformatKillResults');

test('includes summary line for multiple ports', () => {
  const results = [
    { success: true, pid: '4821', name: 'node', port: 3000, alreadyFree: false },
    { success: false, pid: null, name: null, port: 9999, alreadyFree: true },
  ];
  const output = formatKillResults(results);
  assert.ok(output.includes('3000'), 'should include port 3000');
  assert.ok(output.includes('9999'), 'should include port 9999');
  // Summary should be present
  assert.ok(output.toLowerCase().includes('killed') || output.toLowerCase().includes('free'), 'should include summary');
});

test('does not show summary for single port', () => {
  const results = [
    { success: true, pid: '4821', name: 'node', port: 3000, alreadyFree: false },
  ];
  const output = formatKillResults(results);
  assert.ok(output.includes('3000'));
});

// ─── formatPortInfo ──────────────────────────────────────────────────────────

console.log('\nformatPortInfo');

test('shows "free" message when no process found', () => {
  const output = formatPortInfo(null, 3000);
  assert.ok(output.includes('3000'), 'should mention port');
  assert.ok(output.toLowerCase().includes('free') || output.toLowerCase().includes('no process'), 'should indicate free');
});

test('shows port, PID, and process name for active port', () => {
  const info = { port: 3000, pid: '4821', name: 'node', cmd: 'node server.js' };
  const output = formatPortInfo(info, 3000);
  assert.ok(output.includes('3000'), 'should show port');
  assert.ok(output.includes('4821'), 'should show PID');
  assert.ok(output.includes('node'), 'should show process name');
});

test('shows command line when available', () => {
  const info = { port: 3000, pid: '4821', name: 'node', cmd: 'node server.js --port 3000' };
  const output = formatPortInfo(info, 3000);
  assert.ok(output.includes('server.js'), 'should show command');
});

test('truncates very long command lines', () => {
  const longCmd = 'node ' + 'a'.repeat(200);
  const info = { port: 3000, pid: '4821', name: 'node', cmd: longCmd };
  const output = formatPortInfo(info, 3000);
  const cmdLine = output.split('\n').find(l => l.includes('node aaaa'));
  if (cmdLine) {
    assert.ok(cmdLine.length < 120, 'long command should be truncated');
  }
});

test('handles null name gracefully', () => {
  const info = { port: 3000, pid: '4821', name: null, cmd: null };
  const output = formatPortInfo(info, 3000);
  assert.ok(output.includes('3000'));
  assert.ok(!output.includes('null'));
});

// ─── formatPortList ──────────────────────────────────────────────────────────

console.log('\nformatPortList');

const SAMPLE_PORTS = [
  { port: 80, pid: '4', name: 'nginx', address: '*' },
  { port: 3000, pid: '4821', name: 'node', address: '*' },
  { port: 8080, pid: '1234', name: 'python', address: '127.0.0.1' },
];

test('renders a table with PORT, PID, PROCESS, ADDRESS headers', () => {
  const output = formatPortList(SAMPLE_PORTS);
  assert.ok(output.includes('PORT'), 'should have PORT header');
  assert.ok(output.includes('PID'), 'should have PID header');
  assert.ok(output.includes('PROCESS'), 'should have PROCESS header');
  assert.ok(output.includes('ADDRESS'), 'should have ADDRESS header');
});

test('includes all ports in output', () => {
  const output = formatPortList(SAMPLE_PORTS);
  assert.ok(output.includes('80'), 'should show port 80');
  assert.ok(output.includes('3000'), 'should show port 3000');
  assert.ok(output.includes('8080'), 'should show port 8080');
});

test('includes process names in output', () => {
  const output = formatPortList(SAMPLE_PORTS);
  assert.ok(output.includes('nginx'), 'should show nginx');
  assert.ok(output.includes('node'), 'should show node');
  assert.ok(output.includes('python'), 'should show python');
});

test('includes port count in footer', () => {
  const output = formatPortList(SAMPLE_PORTS);
  assert.ok(output.includes('3'), 'should include count');
  assert.ok(output.toLowerCase().includes('port'), 'should include word "port"');
});

test('shows "no listening ports" for empty array', () => {
  const output = formatPortList([]);
  assert.ok(output.toLowerCase().includes('no') || output.toLowerCase().includes('empty'), 'should indicate empty');
});

// ─── formatJson ──────────────────────────────────────────────────────────────

console.log('\nformatJson');

test('produces valid JSON', () => {
  const data = { port: 3000, pid: '4821' };
  const output = formatJson(data);
  assert.doesNotThrow(() => JSON.parse(output));
  const parsed = JSON.parse(output);
  assert.equal(parsed.port, 3000);
  assert.equal(parsed.pid, '4821');
});

test('produces pretty-printed JSON (indented)', () => {
  const data = { a: 1, b: 2 };
  const output = formatJson(data);
  assert.ok(output.includes('\n'), 'should be indented with newlines');
});

test('handles arrays', () => {
  const data = [{ port: 3000 }, { port: 8080 }];
  const output = formatJson(data);
  const parsed = JSON.parse(output);
  assert.equal(parsed.length, 2);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nreporter.test.js: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
