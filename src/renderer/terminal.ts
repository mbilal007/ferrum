import type { ColorMode, RenderMode } from './types.js';

/** Returns current terminal dimensions, falling back to 80x24 if not available. */
export function getTerminalSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  };
}

/** Detects truecolor support via the COLORTERM env variable, defaults to '256'. */
export function detectColorMode(): ColorMode {
  const val = process.env['COLORTERM']?.toLowerCase();
  return val === 'truecolor' || val === '24bit' ? 'truecolor' : '256';
}

/**
 * Detect Sixel support via TERM and TERM_PROGRAM env variables.
 * DA1 response parsing would be more accurate but requires async terminal I/O;
 * env-based detection covers the common cases.
 */
export function detectSixelSupport(): boolean {
  const term = process.env['TERM'] ?? '';
  const termProgram = (process.env['TERM_PROGRAM'] ?? '').toLowerCase();
  const lcdTerminal = (process.env['LC_TERMINAL'] ?? '').toLowerCase();

  // Known Sixel-capable terminals
  if (termProgram === 'iterm.app') return true;
  if (termProgram === 'wezterm') return true;
  if (termProgram === 'contour') return true;
  if (lcdTerminal === 'iterm2') return true;
  if (term.includes('mlterm')) return true;
  if (term.includes('yaft')) return true;
  if (termProgram === 'foot') return true;

  return false;
}

/** Determine render mode: explicit flag overrides auto-detection. */
export function detectRenderMode(explicit?: RenderMode): RenderMode {
  if (explicit) return explicit;
  return detectSixelSupport() ? 'sixel' : 'halfblock';
}

/** Returns the ANSI escape sequence to hide the terminal cursor. */
export function hideCursor(): string {
  return '\x1b[?25l';
}

/** Returns the ANSI escape sequence to show the terminal cursor. */
export function showCursor(): string {
  return '\x1b[?25h';
}

/** Returns an ANSI escape sequence to move the cursor to a given 0-based col/row. */
export function moveCursor(col: number, row: number): string {
  return `\x1b[${row + 1};${col + 1}H`;
}

/** Returns the ANSI sequence to reset all SGR attributes. */
export function resetStyle(): string {
  return '\x1b[0m';
}

/**
 * Registers process signal and exit handlers that restore the terminal
 * to a usable state (cursor visible, styles reset) before the process ends.
 */
export function setupTerminalRestore(): void {
  const restore = () => {
    process.stdout.write(showCursor() + resetStyle());
  };

  process.on('SIGINT', () => { restore(); process.exit(130); });
  process.on('SIGTERM', () => { restore(); process.exit(143); });
  process.on('uncaughtException', (err) => {
    restore();
    console.error(err);
    process.exit(1);
  });
  process.on('exit', restore);
}
