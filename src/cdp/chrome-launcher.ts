import { spawn } from 'node:child_process';
import { findChrome } from './chrome-finder.js';

export interface ChromeInstance {
  wsEndpoint: string;
  kill: () => void;
  pid: number;
}

const LAUNCH_TIMEOUT_MS = 8000;
const WS_ENDPOINT_RE = /DevTools listening on (ws:\/\/[^\s]+)/;

/** Spawn headless Chrome and wait for the DevTools WebSocket endpoint to appear in stderr. */
export async function launchChrome(opts: { width: number; height: number }): Promise<ChromeInstance> {
  const chromePath = findChrome();

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=0',
    `--window-size=${opts.width},${opts.height}`,
  ];

  const proc = spawn(chromePath, args, {
    detached: false,
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  // Clean up child when parent exits
  process.on('exit', () => {
    try { proc.kill(); } catch { /* already dead */ }
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(
        `Chrome did not start within ${LAUNCH_TIMEOUT_MS / 1000}s. ` +
        'Make sure Chrome is installed and not blocked by a firewall or antivirus.'
      ));
    }, LAUNCH_TIMEOUT_MS);

    let stderrBuf = '';

    proc.stderr!.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const match = WS_ENDPOINT_RE.exec(stderrBuf);
      if (match) {
        clearTimeout(timer);
        resolve({
          wsEndpoint: match[1],
          pid: proc.pid!,
          kill: () => { try { proc.kill(); } catch { /* already dead */ } },
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Chrome at ${chromePath}: ${err.message}`));
    });

    proc.on('exit', (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited unexpectedly (code=${code}, signal=${signal}) before DevTools was ready`));
    });
  });
}
