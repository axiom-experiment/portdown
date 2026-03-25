/**
 * portdown — killer.js
 * Kill a process by PID or by port number.
 * Zero dependencies — pure Node.js built-ins only.
 */

import { safeExec, getKillCommand } from './platform.js';
import { findPid, findPortInfo } from './finder.js';

/**
 * Kill a process by PID.
 * @param {string} pid
 * @param {boolean} force - use SIGKILL (true) or SIGTERM (false)
 * @param {Function} [execFn]
 * @returns {boolean} true if kill command succeeded
 */
export function killByPid(pid, force = false, execFn) {
  const cmd = getKillCommand(pid, force);
  const result = safeExec(cmd, execFn);
  // null means execSync threw (non-zero exit = process was not found or already dead)
  // For our purposes, if the command ran without throwing, we consider it a success.
  return result !== null;
}

/**
 * Kill the process listening on a port.
 * @param {number} port
 * @param {object} [opts]
 * @param {boolean} [opts.force=false] - SIGKILL instead of SIGTERM
 * @param {Function} [opts.execFn] - injectable for testing
 * @returns {{ success: boolean, pid: string|null, name: string|null, port: number, alreadyFree: boolean }}
 */
export function killPort(port, opts = {}) {
  const { force = false, execFn } = opts;

  const info = findPortInfo(port, execFn);

  if (!info) {
    return { success: false, pid: null, name: null, port, alreadyFree: true };
  }

  const killed = killByPid(info.pid, force, execFn);

  return {
    success: killed,
    pid: info.pid,
    name: info.name,
    port,
    alreadyFree: false
  };
}

/**
 * Kill processes on multiple ports.
 * @param {number[]} ports
 * @param {object} [opts]
 * @param {boolean} [opts.force=false]
 * @param {Function} [opts.execFn]
 * @returns {Array<ReturnType<typeof killPort>>}
 */
export function killPorts(ports, opts = {}) {
  return ports.map(port => killPort(port, opts));
}
