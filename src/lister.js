/**
 * portdown — lister.js
 * List all ports currently in LISTEN state on the system.
 * Zero dependencies — pure Node.js built-ins only.
 */

import { safeExec, getListCommand } from './platform.js';
import { findProcessName } from './finder.js';

/**
 * List all ports currently listening on this system.
 * @param {object} [opts]
 * @param {boolean} [opts.includeNames=false] - resolve process names (slower, extra exec per process)
 * @param {Function} [opts.execFn] - injectable for testing
 * @returns {Array<{port: number, pid: string, name: string|null, address: string}>}
 */
export function listPorts(opts = {}) {
  const { includeNames = false, execFn } = opts;
  const { cmd, parse } = getListCommand();
  const output = safeExec(cmd, execFn);
  const entries = parse(output || '');

  if (!includeNames) return entries;

  // Resolve names for entries that don't already have them (Windows entries lack names)
  return entries.map(entry => {
    if (entry.name) return entry;
    const name = findProcessName(entry.pid, execFn);
    return { ...entry, name };
  });
}

/**
 * Filter the port list to a specific address family or PID.
 * @param {Array} ports - result of listPorts()
 * @param {object} filter
 * @param {string} [filter.pid] - filter to specific PID
 * @param {string} [filter.name] - filter by process name (case-insensitive partial match)
 * @param {number} [filter.minPort] - minimum port number
 * @param {number} [filter.maxPort] - maximum port number
 * @returns {Array}
 */
export function filterPorts(ports, filter = {}) {
  return ports.filter(entry => {
    if (filter.pid && entry.pid !== String(filter.pid)) return false;
    if (filter.name && !entry.name?.toLowerCase().includes(filter.name.toLowerCase())) return false;
    if (filter.minPort !== undefined && entry.port < filter.minPort) return false;
    if (filter.maxPort !== undefined && entry.port > filter.maxPort) return false;
    return true;
  });
}
