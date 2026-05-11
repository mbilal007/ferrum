import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const MACOS_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
];

const WINDOWS_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const LINUX_COMMANDS = ['google-chrome', 'chromium-browser', 'chromium'];

/** Returns the path to a Chrome/Chromium executable, or throws if none found. */
function tryPath(p: string): string | null {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return p;
  } catch {
    return null;
  }
}

/** Resolve a command name to its full path via `which`, returns null if not found. */
function which(cmd: string): string | null {
  try {
    const result = execFileSync('which', [cmd], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const p = result.trim();
    return p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

/** Find the Chrome or Chromium binary on the current platform. Throws with install instructions if not found. */
export function findChrome(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    for (const p of MACOS_PATHS) {
      const found = tryPath(p);
      if (found) return found;
    }
  } else if (platform === 'win32') {
    for (const p of WINDOWS_PATHS) {
      const found = tryPath(p);
      if (found) return found;
    }
  } else {
    // Linux and other Unix-like systems
    for (const cmd of LINUX_COMMANDS) {
      const resolved = which(cmd);
      if (resolved) {
        const found = tryPath(resolved);
        if (found) return found;
      }
    }
  }

  throw new Error(
    'Chrome or Chromium not found. Please install it:\n' +
    '  macOS:   https://www.google.com/chrome/\n' +
    '  Linux:   sudo apt install chromium-browser  (or your distro equivalent)\n' +
    '  Windows: https://www.google.com/chrome/'
  );
}

/** Run `chrome --version` and return the version string (e.g. "Google Chrome 120.0.6099.109"). */
export async function getChromeVersion(chromePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const output = execFileSync(chromePath, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
      });
      resolve(output.trim());
    } catch (err) {
      reject(new Error(`Failed to get Chrome version from ${chromePath}: ${String(err)}`));
    }
  });
}
