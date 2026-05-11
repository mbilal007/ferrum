import { encodeCell } from './half-block.js';
import type { PixelBuffer, FrameBuffer, Cell, ColorMode, Color } from './types.js';

/** Extract an RGB Color from a Uint8Array pixel buffer at the given pixel index (stride = 4 for RGBA). */
function pixelAt(data: Uint8Array, index: number): Color {
  const base = index * 4;
  return { r: data[base]!, g: data[base + 1]!, b: data[base + 2]! };
}

/**
 * Convert a PixelBuffer into a FrameBuffer by pairing pixel rows into half-block cells.
 * Each pair of pixel rows maps to one cell row; odd-height images duplicate the last row.
 */
export function buildFrameBuffer(pixels: PixelBuffer, mode: ColorMode): FrameBuffer {
  const cols = pixels.width;
  const rows = Math.ceil(pixels.height / 2);
  const cells: Cell[][] = [];

  for (let cellRow = 0; cellRow < rows; cellRow++) {
    const topPixelRow = cellRow * 2;
    const bottomPixelRow = topPixelRow + 1 < pixels.height ? topPixelRow + 1 : topPixelRow;
    const row: Cell[] = [];

    for (let col = 0; col < cols; col++) {
      const top = pixelAt(pixels.data, topPixelRow * cols + col);
      const bottom = pixelAt(pixels.data, bottomPixelRow * cols + col);
      row.push(encodeCell(top, bottom, mode));
    }

    cells.push(row);
  }

  return { cols, rows, cells };
}
