/**
 * portdown — platform detection and OS-level utilities
 * Zero dependencies — pure Node.js built-ins only
 */

import { execSync } from 'node:child_process';
import os from 'node:os';

export const PLATFORM = os.platform(); // 'darwin' | 'linux' | 'win32'
export const IS_WINDOWS = PLATFORM === 'win32';
export const IS_MAC = PLATFORM === 'darwin';
export const IS_LINUX = PLATFORM === 'linux';
export const IS_UNIX = IS_MAC || IS_LINUX;

/**
 * Safely run a shell command, returning output or null on failure.
 * @param {string} cmd
 * @param {Function} [execFn] - injectable for testing
 * @returns {string|null}
 */
export function safeExec(cmd, execFn = execSync) {
  try {
    return execFn(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    return null;
  }
}

/**
 * Get the OS-level command to find the PID listening on a given port.
 * @param {number} port
 * @returns {{ cmd: string, parse: (output: string) => string|null }}
 */
export function getPidCommand(port) {
  if (IS_WINDOWS) {
    return {
      cmd: `netstat -ano 2>nul`,
      parse: (output) => parseWindowsNetstat(output, port)
    };
  }
  // macOS and Linux: use lsof
  return {
    cmd: `lsof -ti TCP:${port} -sTCP:LISTEN 2>/dev/null`,
    parse: (output) => output && output.trim() ? output.trim().split('\n')[0] : null
  };
}

/**
 * Get the process name for a given PID.
 * @param {string} pid
 * @returns {{ cmd: string }}
 */
export function getProcessNameCommand(pid) {
  if (IS_WINDOWS) {
    return { cmd: `tasklist /FI "PID eq ${pid}" /FO CSV /NH 2>nul` };
  }
  return { cmd: `ps -p ${pid} -o comm= 2>/dev/null` };
}

/**
 * Get the full command line for a given PID.
 * @param {string} pid
 * @returns {{ cmd: string }}
 */
export function getProcessCommandlineCommand(pid) {
  if (IS_WINDOWS) {
    return { cmd: `wmic process where ProcessId=${pid} get CommandLine /VALUE 2>nul` };
  }
  return { cmd: `ps -p ${pid} -o args= 2>/dev/null` };
}

/**
 * Get the command to kill a process by PID.
 * @param {string} pid
 * @param {boolean} force - use SIGKILL instead of SIGTERM
 * @returns {string}
 */
export function getKillCommand(pid, force = false) {
  if (IS_WINDOWS) {
    return `taskkill /PID ${pid} ${force ? '/F ' : ''}/T 2>nul`;
  }
  const signal = force ? '-9' : '-15';
  return `kill ${signal} ${pid} 2>/dev/null`;
}

/**
 * Get the command to list all LISTENING ports.
 * @returns {{ cmd: string, parse: (output: string) => PortEntry[] }}
 */
export function getListCommand() {
  if (IS_WINDOWS) {
    return {
      cmd: 'netstat -ano 2>nul',
      parse: parseWindowsListening
    };
  }
  return {
    cmd: 'lsof -i -P -n -sTCP:LISTEN 2>/dev/null',
    parse: parseUnixLsofListen
  };
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse Windows `netstat -ano` output to find PID for a specific port.
 * Lines look like:
 *   TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4821
 * @param {string} output
 * @param {number} port
 * @returns {string|null} PID or null
 */
export function parseWindowsNetstat(output, port) {
  if (!output) return null;
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('TCP') && !trimmed.startsWith('UDP')) continue;
    if (!trimmed.toUpperCase().includes('LISTENING')) continue;
    // Match :PORT followed by whitespace
    const portPattern = new RegExp(`[.:]${port}\\s+`);
    if (portPattern.test(trimmed)) {
      const parts = trimmed.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) return pid;
    }
  }
  return null;
}

/**
 * Parse Windows tasklist CSV output to extract process name.
 * Line looks like: "node.exe","4821","Console","1","65,280 K"
 * @param {string} output
 * @returns {string|null}
 */
export function parseWindowsTasklist(output) {
  if (!output) return null;
  const line = output.trim().split('\n')[0];
  if (!line) return null;
  const match = line.match(/^"([^"]+)"/);
  return match ? match[1].replace(/\.exe$/i, '') : null;
}

/**
 * Parse Windows `netstat -ano` output for all LISTENING entries.
 * @param {string} output
 * @returns {Array<{port: number, pid: string, address: string}>}
 */
export function parseWindowsListening(output) {
  if (!output) return [];
  const results = [];
  const seen = new Set();
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('TCP')) continue;
    if (!trimmed.toUpperCase().includes('LISTENING')) continue;
    const parts = trimmed.split(/\s+/);
    // parts: [TCP, local_addr:port, foreign_addr:port, LISTENING, PID]
    if (parts.length < 5) continue;
    const localAddr = parts[1];
    const pid = parts[parts.length - 1];
    if (!pid || !/^\d+$/.test(pid)) continue;
    const lastColon = localAddr.lastIndexOf(':');
    if (lastColon === -1) continue;
    const port = parseInt(localAddr.slice(lastColon + 1), 10);
    if (isNaN(port)) continue;
    const key = `${port}:${pid}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ port, pid, address: localAddr.slice(0, lastColon) });
    }
  }
  return results.sort((a, b) => a.port - b.port);
}

/**
 * Parse Unix `lsof -i -P -n -sTCP:LISTEN` output.
 * Lines look like:
 *   node    4821 user   23u  IPv6 0x1234      0t0  TCP *:3000 (LISTEN)
 * @param {string} output
 * @returns {Array<{port: number, pid: string, name: string, address: string}>}
 */
export function parseUnixLsofListen(output) {
  if (!output) return [];
  const results = [];
  const seen = new Set();
  const lines = output.split('\n');
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    // COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
    if (parts.length < 9) continue;
    const name = parts[0];
    const pid = parts[1];
    // lsof splits '(LISTEN)' as a separate token when using /s+/
    // Handle both: '*:3000 (LISTEN)' as one token, or '*:3000' + '(LISTEN)' as two
    let addrField = parts[parts.length - 1];
    if (addrField === '(LISTEN)') {
      addrField = parts[parts.length - 2];
    } else {
      addrField = addrField.replace(/s*(LISTEN)s*$/, '');
    }
    const lastColon = addrField.lastIndexOf(':');
    if (lastColon === -1) continue;
    const address = addrField.slice(0, lastColon);
    const port = parseInt(addrField.slice(lastColon + 1), 10);
    if (isNaN(port) || !pid || !/^\d+$/.test(pid)) continue;
    const key = `${port}:${pid}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ port, pid, name, address });
    }
  }
  return results.sort((a, b) => a.port - b.port);
}
