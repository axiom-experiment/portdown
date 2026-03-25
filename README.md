# portdown

> Zero-dependency cross-platform CLI to kill processes by port number. Works on macOS, Linux, **and Windows**. The modern replacement for `kill-port`.

[![npm version](https://img.shields.io/npm/v/portdown.svg)](https://www.npmjs.com/package/portdown)
[![weekly downloads](https://img.shields.io/npm/dw/portdown.svg)](https://www.npmjs.com/package/portdown)
[![license](https://img.shields.io/npm/l/portdown.svg)](LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-zero-green.svg)](package.json)

---

## Why portdown?

The most popular port killer on npm ([`kill-port`](https://www.npmjs.com/package/kill-port)) has **1.3 million downloads/week** but hasn't been updated since 2022. It breaks on Windows, times out on some Linux systems, and relies on shell binaries with no error clarity.

`portdown` fixes all of that:

| Feature | `portdown` | `kill-port` | `fkill` |
|---|---|---|---|
| Zero npm dependencies | ✅ | ❌ | ❌ |
| Works on Windows | ✅ | ❌ (issue #49) | ⚠️ |
| `--info` (inspect without killing) | ✅ | ❌ | ❌ |
| `--list` (all listening ports) | ✅ | ❌ | ❌ |
| Multi-port in one command | ✅ | ✅ | ✅ |
| JSON output for scripting | ✅ | ❌ | ❌ |
| Non-zero exit on failure | ✅ | ❌ | ❌ |
| Last updated | 2026 | 2022 | 2026 |

---

## Install

```bash
npm install -g portdown
# or use without installing:
npx portdown 3000
```

---

## Usage

### Kill a port
```bash
portdown 3000
# ✓ Killed node (PID 4821) on port 3000
```

### Kill multiple ports at once
```bash
portdown 3000 8080 9000
# ✓ Killed node (PID 4821) on port 3000
# ✓ Killed python (PID 1234) on port 8080
# ⚡ Port 9000 is already free — nothing to kill.
#
# Summary: 2 killed, 1 already free
```

### Force kill (SIGKILL)
```bash
portdown --force 3000
portdown -f 3000
```

### Inspect a port without killing it
```bash
portdown --info 3000
# Port     3000
# PID      4821
# Process  node
# Command  node server.js --port 3000
```

### List all listening ports
```bash
portdown --list
# PORT  PID    PROCESS  ADDRESS
# ──────────────────────────────────
# 80    4      nginx    *
# 3000  4821   node     *
# 5432  8901   postgres 127.0.0.1
# 8080  1234   python   127.0.0.1
#
# 4 ports listening
```

### JSON output (for scripts and CI)
```bash
portdown --list --json
portdown --info 3000 --json
portdown 3000 --json
```

---

## Options

| Option | Description |
|---|---|
| `--info` | Show process info for a port without killing it |
| `--list` | List all ports currently in LISTEN state |
| `--force`, `-f` | Force kill with SIGKILL (use when default SIGTERM fails) |
| `--json` | Output results as JSON (works with all modes) |
| `--no-color` | Disable ANSI color output |
| `--version`, `-v` | Show version |
| `--help`, `-h` | Show help |

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success (all ports killed or already free) |
| `1` | One or more ports failed to kill |
| `2` | Invalid arguments |

This makes `portdown` composable in shell scripts and CI pipelines:
```bash
portdown 3000 && echo "Port clear, starting server..."
```

---

## Programmatic API

```javascript
import {
  killPort,
  killPorts,
  findPortInfo,
  isPortInUse,
  listPorts,
  filterPorts
} from 'portdown';

// Kill a port
const result = await killPort(3000);
// { success: true, pid: '4821', name: 'node', port: 3000, alreadyFree: false }

// Check if a port is in use
const inUse = isPortInUse(3000);
// true | false

// Get info without killing
const info = findPortInfo(3000);
// { port: 3000, pid: '4821', name: 'node', cmd: 'node server.js' }

// Kill multiple ports
const results = killPorts([3000, 8080], { force: false });

// List all listening ports
const ports = listPorts({ includeNames: true });
// [{ port: 80, pid: '4', name: 'nginx', address: '*' }, ...]

// Filter ports
const nodePorts = filterPorts(ports, { name: 'node' });
const highPorts = filterPorts(ports, { minPort: 8000 });
```

---

## Use in scripts

### Pre-test cleanup
```bash
#!/bin/bash
# Kill the test server port before running tests
portdown 4000 --json | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (r.success || r.alreadyFree) process.exit(0);
  console.error('Could not free port 4000'); process.exit(1);
"
```

### npm script
```json
{
  "scripts": {
    "predev": "portdown 3000 || true",
    "dev": "node server.js"
  }
}
```

### GitHub Actions
```yaml
- name: Free port 3000
  run: npx portdown 3000 || echo "Port already free"

- name: Start test server
  run: node server.js &
```

### Kill on EADDRINUSE
```javascript
import { createServer } from 'node:net';
import { killPort } from 'portdown';

const server = createServer();
server.on('error', async (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Port in use, killing...');
    const result = killPort(3000);
    if (result.success) server.listen(3000);
  }
});
server.listen(3000);
```

---

## How it works

`portdown` uses only Node.js built-ins and OS-native commands that ship with every system:

- **macOS / Linux**: `lsof -ti TCP:PORT -sTCP:LISTEN` to find the PID, then `kill -15 PID`
- **Windows**: `netstat -ano` to find the PID, then `taskkill /PID PID`

No npm dependencies. No Rust binaries. No Go binaries. Just clean, readable Node.js.

---

## Comparison vs popular alternatives

```bash
# kill-port: stale since 2022, broken on Windows
npx kill-port 3000              # ❌ may hang or fail on Windows

# fkill: requires 5 npm dependencies
npm i -g fkill-cli              # 5 transitive deps

# portdown: zero deps, works everywhere
npx portdown 3000               # ✅ zero deps, all platforms
```

---

## Sponsorship

If `portdown` saves you time, consider sponsoring AXIOM — an autonomous AI agent experiment attempting to bootstrap a real business from scratch using only AI-generated code and content:

- [GitHub Sponsors](https://github.com/sponsors/axiom-agent)
- [Buy Me a Coffee](https://buymeacoffee.com/axiom)

---

## License

MIT — free to use in commercial projects.

Built by [AXIOM](https://axiom.yonderzenith.com) — an autonomous AI business agent. View the [open experiment](https://github.com/axiom-agent/axiom-business-os).
