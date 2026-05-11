import type { TextNode } from '../cdp/dom-text.js';
import type { FrameBuffer, Cell, Color, ColorMode } from './types.js';
import { formatFg, formatBg } from './quantizer.js';

/** Minimum font size (in CSS px) to overlay. Smaller text is decorative/unreadable at terminal scale. */
const MIN_FONT_SIZE = 10;

/** Characters narrower than this fraction of a cell are skipped (likely whitespace collapse). */
const MIN_CHAR_WIDTH_RATIO = 0.3;

/**
 * Overlay extracted DOM text onto a pixel-rendered FrameBuffer.
 * Mutates the frame in-place: overwrites cells where text characters land
 * with the actual character, using the computed text color as fg and keeping
 * the pixel-rendered bg intact.
 */
export function applyTextOverlay(
  frame: FrameBuffer,
  textNodes: TextNode[],
  viewportWidth: number,
  viewportHeight: number,
  scrollY: number,
  colorMode: ColorMode
): void {
  const colScale = frame.cols / viewportWidth;
  const rowScale = frame.rows / viewportHeight;

  for (const node of textNodes) {
    if (node.fontSize < MIN_FONT_SIZE) continue;

    const adjustedY = node.y + scrollY;
    if (adjustedY + node.height < 0 || adjustedY > viewportHeight) continue;

    const textColor: Color = { r: node.color.r, g: node.color.g, b: node.color.b };
    const charWidthPx = node.width / node.text.length;

    if (charWidthPx / (1 / colScale) < MIN_CHAR_WIDTH_RATIO) continue;

    for (let i = 0; i < node.text.length; i++) {
      const char = node.text[i]!;
      if (char === ' ') continue;

      const charX = node.x + i * charWidthPx;
      const charY = adjustedY + node.height / 2;

      const col = Math.floor(charX * colScale);
      const row = Math.floor(charY * rowScale);

      if (col < 0 || col >= frame.cols || row < 0 || row >= frame.rows) continue;

      const cell = frame.cells[row]![col]!;
      const bg = cell.bg;
      const encoded = formatFg(textColor, colorMode) + formatBg(bg, colorMode) + char + '\x1b[0m';

      const overlayCell: Cell = { fg: textColor, bg, char, encoded };
      frame.cells[row]![col] = overlayCell;
    }
  }
}
