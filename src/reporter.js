/**
 * portdown — reporter.js
 * Output formatting for CLI results (ANSI colors, tables, JSON).
 * Zero dependencies — pure Node.js built-ins only.
 */

// ANSI color codes
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

let useColor = true;

export function setColor(enabled) {
  useColor = enabled;
}

function c(color, text) {
  return useColor ? `${C[color]}${text}${C.reset}` : text;
}

function bold(text) {
  return useColor ? `${C.bold}${text}${C.reset}` : text;
}

function dim(text) {
  return useColor ? `${C.dim}${text}${C.reset}` : text;
}

// ─── Kill Results ────────────────────────────────────────────────────────────

/**
 * Format the result of a killPort() call for CLI display.
 * @param {object} result - from killer.killPort()
 * @returns {string}
 */
export function formatKillResult(result) {
  const { success, pid, name, port, alreadyFree } = result;

  if (alreadyFree) {
    return c('yellow', `⚡ Port ${bold(port)} is already free — nothing to kill.`);
  }

  const processStr = name
    ? `${c('cyan', name)} ${dim(`(PID ${pid})`)}`
    : `${dim(`PID ${pid}`)}`;

  if (success) {
    return c('green', `✓`) + ` Killed ${processStr} on port ${bold(c('green', String(port)))}`;
  } else {
    return c('red', `✗`) + ` Failed to kill ${processStr} on port ${bold(c('red', String(port)))}`;
  }
}

/**
 * Format multiple kill results.
 * @param {object[]} results
 * @returns {string}
 */
export function formatKillResults(results) {
  const lines = results.map(formatKillResult);
  const killed = results.filter(r => r.success).length;
  const free = results.filter(r => r.alreadyFree).length;
  const failed = results.filter(r => !r.success && !r.alreadyFree).length;

  const summary = [];
  if (killed > 0) summary.push(c('green', `${killed} killed`));
  if (free > 0) summary.push(c('yellow', `${free} already free`));
  if (failed > 0) summary.push(c('red', `${failed} failed`));

  if (results.length > 1) {
    lines.push('');
    lines.push(dim(`Summary: `) + summary.join(dim(', ')));
  }

  return lines.join('\n');
}

// ─── Port Info ───────────────────────────────────────────────────────────────

/**
 * Format port info for --info display.
 * @param {object|null} info - from finder.findPortInfo()
 * @param {number} port
 * @returns {string}
 */
export function formatPortInfo(info, port) {
  if (!info) {
    return c('yellow', `⚡ Port ${bold(port)} is free — no process listening.`);
  }

  const lines = [
    `${bold(c('blue', 'Port'))}     ${bold(String(info.port))}`,
    `${bold(c('blue', 'PID'))}      ${info.pid}`,
    `${bold(c('blue', 'Process'))}  ${info.name ? c('cyan', info.name) : dim('unknown')}`,
  ];

  if (info.cmd) {
    const cmdDisplay = info.cmd.length > 80 ? info.cmd.slice(0, 77) + '...' : info.cmd;
    lines.push(`${bold(c('blue', 'Command'))}  ${dim(cmdDisplay)}`);
  }

  return lines.join('\n');
}

// ─── Port List ───────────────────────────────────────────────────────────────

/**
 * Format a list of listening ports as a table.
 * @param {Array} ports - from lister.listPorts()
 * @returns {string}
 */
export function formatPortList(ports) {
  if (!ports || ports.length === 0) {
    return c('yellow', 'No listening ports found.');
  }

  // Column widths
  const maxPort = Math.max(4, ...ports.map(p => String(p.port).length));
  const maxPid = Math.max(3, ...ports.map(p => String(p.pid).length));
  const maxName = Math.max(7, ...ports.map(p => (p.name || 'unknown').length));
  const maxAddr = Math.max(7, ...ports.map(p => (p.address || '*').length));

  const pad = (s, n) => String(s).padEnd(n);

  const header = [
    bold(c('blue', pad('PORT', maxPort))),
    bold(c('blue', pad('PID', maxPid))),
    bold(c('blue', pad('PROCESS', maxName))),
    bold(c('blue', pad('ADDRESS', maxAddr))),
  ].join('  ');

  const sep = dim('─'.repeat(maxPort + maxPid + maxName + maxAddr + 6));

  const rows = ports.map(p => [
    c('green', pad(p.port, maxPort)),
    dim(pad(p.pid, maxPid)),
    p.name ? c('cyan', pad(p.name, maxName)) : dim(pad('unknown', maxName)),
    dim(pad(p.address || '*', maxAddr)),
  ].join('  '));

  return [header, sep, ...rows, '', dim(`${ports.length} port${ports.length === 1 ? '' : 's'} listening`)].join('\n');
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

export function formatJson(data) {
  return JSON.stringify(data, null, 2);
}
