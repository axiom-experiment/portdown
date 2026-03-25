/**
 * portdown — public API
 * Zero-dependency cross-platform port killer for Node.js.
 *
 * @example
 * import { killPort, findPortInfo, listPorts, isPortInUse } from 'portdown';
 *
 * // Kill a port
 * const result = killPort(3000);
 * console.log(result.success); // true
 *
 * // Get info without killing
 * const info = findPortInfo(3000);
 * console.log(info); // { port: 3000, pid: '4821', name: 'node', cmd: 'node server.js' }
 *
 * // List all listening ports
 * const ports = listPorts();
 */

export { killPort, killPorts, killByPid } from './killer.js';
export { findPid, findPortInfo, findProcessName, isPortInUse } from './finder.js';
export { listPorts, filterPorts } from './lister.js';
export { PLATFORM, IS_WINDOWS, IS_MAC, IS_LINUX, IS_UNIX } from './platform.js';
