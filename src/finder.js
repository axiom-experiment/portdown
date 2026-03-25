/**
 * portdown — finder.js
 * Locate the PID and process metadata for a given port.
 * Zero dependencies — pure Node.js built-ins only.
 */

import {
  safeExec,
  getPidCommand,
  getProcessNameCommand,
  getProcessCommandlineCommand,
  parseWindowsTasklist,
  IS_WINDOWS
} from './platform.js';

/**
 * Find the PID of the process listening on a given port.
 * @param {number} port
 * @param {Function} [execFn] - injectable for testing
 * @returns {string|null} PID string or null if nothing is listening
 */
export function findPid(port, execFn) {
  const { cmd, parse } = getPidCommand(port);
  const output = safeExec(cmd, execFn);
  return parse(output);
}

/**
 * Find the process name for a given PID.
 * @param {string} pid
 * @param {Function} [execFn]
 * @returns {string|null}
 */
export function findProcessName(pid, execFn) {
  const { cmd } = getProcessNameCommand(pid);
  const output = safeExec(cmd, execFn);
  if (!output) return null;

  if (IS_WINDOWS) {
    return parseWindowsTasklist(output);
  }
  // Unix: ps returns just the command name
  return output.trim() || null;
}

/**
 * Find the full command line for a process.
 * @param {string} pid
 * @param {Function} [execFn]
 * @returns {string|null}
 */
export function findCommandLine(pid, execFn) {
  const { cmd } = getProcessCommandlineCommand(pid);
  const output = safeExec(cmd, execFn);
  if (!output) return null;

  if (IS_WINDOWS) {
    // wmic output: "CommandLine=node server.js\r\n\r\n"
    const match = output.match(/CommandLine=(.+)/);
    return match ? match[1].trim() : null;
  }
  return output.trim() || null;
}

/**
 * Get full process info for a port (PID + name + command).
 * @param {number} port
 * @param {Function} [execFn]
 * @returns {{ port: number, pid: string, name: string|null, cmd: string|null }|null}
 */
export function findPortInfo(port, execFn) {
  const pid = findPid(port, execFn);
  if (!pid) return null;

  const name = findProcessName(pid, execFn);
  const cmdLine = findCommandLine(pid, execFn);

  return { port, pid, name, cmd: cmdLine };
}

/**
 * Check if a port is in use.
 * @param {number} port
 * @param {Function} [execFn]
 * @returns {boolean}
 */
export function isPortInUse(port, execFn) {
  return findPid(port, execFn) !== null;
}
