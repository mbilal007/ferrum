import type { Color } from '../renderer/types.js';

/** Manhattan distance between two RGB colors. Faster than Euclidean for nearest-color comparisons. */
export function rgbDistance(a: Color, b: Color): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

/** Returns true if two colors are within the given threshold (default 36). */
export function colorClose(a: Color, b: Color, threshold = 36): boolean {
  return rgbDistance(a, b) < threshold;
}

/** Convert an RGB color to the nearest xterm-256 palette index using the standard formula. */
export function rgbToAnsi256(c: Color): number {
  // Exact grayscale ramp: r=g=b and value matches the 24-step ramp
  if (c.r === c.g && c.g === c.b) {
    if (c.r < 8) return 16;
    if (c.r > 248) return 231;
    return Math.round((c.r - 8) / 247 * 24) + 232;
  }
  const r = Math.round(c.r / 255 * 5);
  const g = Math.round(c.g / 255 * 5);
  const b = Math.round(c.b / 255 * 5);
  return 16 + 36 * r + 6 * g + b;
}

function buildXterm256Palette(): Color[] {
  const palette: Color[] = [];

  // 16 system colors (terminal-defined; use standard approximations)
  const system16: Color[] = [
    { r: 0,   g: 0,   b: 0   },
    { r: 128, g: 0,   b: 0   },
    { r: 0,   g: 128, b: 0   },
    { r: 128, g: 128, b: 0   },
    { r: 0,   g: 0,   b: 128 },
    { r: 128, g: 0,   b: 128 },
    { r: 0,   g: 128, b: 128 },
    { r: 192, g: 192, b: 192 },
    { r: 128, g: 128, b: 128 },
    { r: 255, g: 0,   b: 0   },
    { r: 0,   g: 255, b: 0   },
    { r: 255, g: 255, b: 0   },
    { r: 0,   g: 0,   b: 255 },
    { r: 255, g: 0,   b: 255 },
    { r: 0,   g: 255, b: 255 },
    { r: 255, g: 255, b: 255 },
  ];
  palette.push(...system16);

  // 216-color 6x6x6 cube (indices 16-231)
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette.push({
          r: r === 0 ? 0 : 55 + r * 40,
          g: g === 0 ? 0 : 55 + g * 40,
          b: b === 0 ? 0 : 55 + b * 40,
        });
      }
    }
  }

  // 24-step grayscale ramp (indices 232-255)
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    palette.push({ r: v, g: v, b: v });
  }

  return palette;
}

export const XTERM_256_PALETTE: Color[] = buildXterm256Palette();
