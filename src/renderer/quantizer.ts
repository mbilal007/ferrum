import { rgbDistance, XTERM_256_PALETTE } from '../utils/color.js';
import type { Color, ColorMode } from './types.js';

// Cache key packs r, g, b into a single integer to avoid string allocation.
const cache = new Map<number, number>();

/** Find the nearest xterm-256 palette index for an RGB color using Manhattan distance. Results are cached. */
export function nearestAnsi256(c: Color): number {
  const key = (c.r << 16) | (c.g << 8) | c.b;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < XTERM_256_PALETTE.length; i++) {
    const d = rgbDistance(c, XTERM_256_PALETTE[i]!);
    if (d < bestDist) {
      bestDist = d;
      best = i;
      if (d === 0) break;
    }
  }

  cache.set(key, best);
  return best;
}

/** Returns the SGR foreground sequence for the given color and color mode. */
export function formatFg(c: Color, mode: ColorMode): string {
  if (mode === 'truecolor') {
    return `\x1b[38;2;${c.r};${c.g};${c.b}m`;
  }
  return `\x1b[38;5;${nearestAnsi256(c)}m`;
}

/** Returns the SGR background sequence for the given color and color mode. */
export function formatBg(c: Color, mode: ColorMode): string {
  if (mode === 'truecolor') {
    return `\x1b[48;2;${c.r};${c.g};${c.b}m`;
  }
  return `\x1b[48;5;${nearestAnsi256(c)}m`;
}
