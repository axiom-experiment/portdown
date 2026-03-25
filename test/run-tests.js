/**
 * portdown test runner — executes all test files sequentially
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  'platform.test.js',
  'finder.test.js',
  'killer.test.js',
  'lister.test.js',
  'reporter.test.js',
];

let totalPassed = 0;
let totalFailed = 0;

console.log('════════════════════════════════════════');
console.log('  portdown test suite');
console.log('════════════════════════════════════════');

for (const testFile of tests) {
  const filePath = path.join(__dirname, testFile);
  console.log(`\n▶ Running ${testFile}`);
  try {
    const output = execSync(`node "${filePath}"`, { encoding: 'utf8', stdio: 'pipe' });
    process.stdout.write(output);

    // Count results from output
    const passMatches = output.match(/(\d+) passed/g) || [];
    const failMatches = output.match(/(\d+) failed/g) || [];
    const passed = passMatches.reduce((sum, m) => sum + parseInt(m), 0);
    const failed = failMatches.reduce((sum, m) => sum + parseInt(m), 0);
    totalPassed += passed;
    totalFailed += failed;
  } catch (err) {
    const output = err.stdout || '';
    const errOutput = err.stderr || '';
    process.stdout.write(output);
    if (errOutput) process.stderr.write(errOutput);

    const passMatches = output.match(/(\d+) passed/g) || [];
    const failMatches = output.match(/(\d+) failed/g) || [];
    const passed = passMatches.reduce((sum, m) => sum + parseInt(m), 0);
    const failed = Math.max(
      1,
      failMatches.reduce((sum, m) => sum + parseInt(m), 0)
    );
    totalPassed += passed;
    totalFailed += failed;
  }
}

console.log('\n════════════════════════════════════════');
const allPassed = totalFailed === 0;
const statusIcon = allPassed ? '✓' : '✗';
const status = allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED';
console.log(`  ${statusIcon} ${status}`);
console.log(`  ${totalPassed} passed, ${totalFailed} failed`);
console.log('════════════════════════════════════════\n');

process.exit(allPassed ? 0 : 1);
