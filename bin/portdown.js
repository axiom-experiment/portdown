#!/usr/bin/env node
/**
 * portdown — CLI entry point
 * Zero-dependency cross-platform port killer.
 *
 * Usage:
 *   portdown 3000               Kill process on port 3000
 *   portdown 3000 8080          Kill processes on ports 3000 and 8080
 *   portdown --info 3000        Show process info without killing
 *   portdown --list             List all listening ports
 *   portdown --list --json      List all listening ports as JSON
 *   portdown --force 3000       Force kill (SIGKILL) instead of SIGTERM
 */

import { killPorts, findPortInfo, isPortInUse } from '../src/index.js';
import { listPorts } from '../src/lister.js';
import {
  formatKillResults,
  formatPortInfo,
  formatPortList,
  formatJson,
  setColor
} from '../src/reporter.js';

const VERSION = '1.0.0';

function printHelp() {
  console.log(`
portdown v${VERSION} — Kill processes by port number

${bold('USAGE')}
  portdown [options] <port> [port2] [port3...]
  portdown --list
  portdown --info <port>

${bold('ARGUMENTS')}
  <port>           Port number(s) to kill (e.g. 3000, 8080, 9000)

${bold('OPTIONS')}
  --info           Show process info for a port without killing it
  --list           List all ports currently listening on this system
  --force, -f      Force kill (SIGKILL) instead of graceful (SIGTERM)
  --json           Output results as JSON
  --no-color       Disable ANSI color output
  --version, -v    Show version
  --help, -h       Show this help message

${bold('EXAMPLES')}
  portdown 3000                Kill the process on port 3000
  portdown 3000 8080 9000      Kill processes on multiple ports at once
  portdown --force 3000        Force kill (use when --default doesn't work)
  portdown --info 3000         Show what's listening on port 3000
  portdown --list              List all listening ports with PIDs and process names
  portdown --list --json       JSON output for scripting

${bold('EXIT CODES')}
  0    All specified ports were killed (or already free)
  1    One or more ports failed to kill
  2    Invalid arguments

${bold('NOTES')}
  Works on macOS, Linux, and Windows — zero npm dependencies required.
  Uses lsof on Unix, netstat on Windows. Both are built into the OS.
`.trim());
}

function bold(text) {
  return process.stdout.isTTY ? `\x1b[1m${text}\x1b[0m` : text;
}

// ─── Argument Parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

let mode = 'kill'; // 'kill' | 'info' | 'list'
let force = false;
let json = false;
let noColor = false;
const ports = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--help':
    case '-h':
      printHelp();
      process.exit(0);
      break;
    case '--version':
    case '-v':
      console.log(`portdown v${VERSION}`);
      process.exit(0);
      break;
    case '--info':
      mode = 'info';
      break;
    case '--list':
      mode = 'list';
      break;
    case '--force':
    case '-f':
      force = true;
      break;
    case '--json':
      json = true;
      break;
    case '--no-color':
      noColor = true;
      break;
    default:
      if (/^\d+$/.test(arg)) {
        ports.push(parseInt(arg, 10));
      } else if (arg.startsWith('-')) {
        console.error(`portdown: unknown option: ${arg}`);
        console.error(`Run 'portdown --help' for usage.`);
        process.exit(2);
      } else {
        console.error(`portdown: invalid argument: ${arg} (expected a port number)`);
        console.error(`Run 'portdown --help' for usage.`);
        process.exit(2);
      }
  }
}

// Apply color setting
if (noColor || !process.stdout.isTTY) {
  setColor(false);
}

// ─── Mode: List ───────────────────────────────────────────────────────────────

if (mode === 'list') {
  const entries = listPorts({ includeNames: true });
  if (json) {
    console.log(formatJson(entries));
  } else {
    console.log(formatPortList(entries));
  }
  process.exit(0);
}

// ─── Mode: Info ───────────────────────────────────────────────────────────────

if (mode === 'info') {
  if (ports.length === 0) {
    console.error('portdown: --info requires a port number');
    console.error("Example: portdown --info 3000");
    process.exit(2);
  }

  const port = ports[0];
  const info = findPortInfo(port);

  if (json) {
    console.log(formatJson(info || { port, listening: false }));
    process.exit(info ? 0 : 1);
  }

  console.log(formatPortInfo(info, port));
  process.exit(info ? 0 : 1);
}

// ─── Mode: Kill ───────────────────────────────────────────────────────────────

if (ports.length === 0) {
  console.error('portdown: no port specified');
  console.error('');
  printHelp();
  process.exit(2);
}

// Validate all ports
for (const port of ports) {
  if (port < 1 || port > 65535) {
    console.error(`portdown: invalid port number: ${port} (must be 1–65535)`);
    process.exit(2);
  }
}

const results = killPorts(ports, { force });

if (json) {
  console.log(formatJson(results));
} else {
  console.log(formatKillResults(results));
}

// Exit 0 if all killed or already free, 1 if any failures
const anyFailed = results.some(r => !r.success && !r.alreadyFree);
process.exit(anyFailed ? 1 : 0);
