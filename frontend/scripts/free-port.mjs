// Frees port 5173 before the dev server starts, so a stale `vite` process left running from a
// previous session doesn't cause `strictPort` to fail this app's startup (see vite.config.js).
// Cross-platform: uses `netstat`/`taskkill` on Windows and `lsof`/`kill` elsewhere.
import { execSync } from 'node:child_process'

const PORT = 5173

function freePortWindows(port) {
  const output = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' })
  const pids = new Set()

  for (const line of output.split('\n')) {
    const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/)
    if (match && Number(match[1]) === port) {
      pids.add(match[2])
    }
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`)
      console.log(`[free-port] Stopped stale process ${pid} holding port ${port}.`)
    } catch {
      // Process may have already exited; nothing to do.
    }
  }
}

function freePortPosix(port) {
  let pids = ''
  try {
    pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim()
  } catch {
    return
  }

  for (const pid of pids.split('\n').filter(Boolean)) {
    try {
      execSync(`kill -9 ${pid}`)
      console.log(`[free-port] Stopped stale process ${pid} holding port ${port}.`)
    } catch {
      // Process may have already exited; nothing to do.
    }
  }
}

try {
  if (process.platform === 'win32') {
    freePortWindows(PORT)
  } else {
    freePortPosix(PORT)
  }
} catch (error) {
  // Non-fatal: if port inspection fails, fall through and let Vite's strictPort surface the
  // conflict clearly instead of silently reassigning a port.
  console.warn(`[free-port] Could not check port ${PORT}:`, error.message)
}
