import { colorClose } from '../utils/color.js';
import { formatFg, formatBg } from './quantizer.js';
import type { Color, Cell, ColorMode } from './types.js';

// U+2584 LOWER HALF BLOCK: fg paints the bottom half, bg paints the top half.
const LOWER_HALF_BLOCK = '▄';

/**
 * Encodes a top+bottom pixel pair into a terminal Cell.
 * When the two colors are close enough, emits a space with only a bg color
 * to reduce SGR output significantly.
 */
export function encodeCell(top: Color, bottom: Color, mode: ColorMode): Cell {
  if (colorClose(top, bottom)) {
    const encoded = formatBg(top, mode) + ' \x1b[0m';
    return { fg: bottom, bg: top, char: ' ', encoded };
  }

  const encoded = formatFg(bottom, mode) + formatBg(top, mode) + LOWER_HALF_BLOCK + '\x1b[0m';
  return { fg: bottom, bg: top, char: LOWER_HALF_BLOCK, encoded };
}
