import type { PixelBuffer, Renderer } from './types.js';
import { bilinearResize } from './resize.js';
import { encodeSixel } from './sixel.js';
import { moveCursor } from './terminal.js';

/**
 * Renders pixels using Sixel escape sequences for terminals that support it.
 * Produces actual pixel-level graphics — dramatically higher fidelity than half-block.
 * Re-emits the full image each frame (Sixel encoding is fast; partial updates are complex).
 */
export class SixelRenderer implements Renderer {
  private cols: number;
  private rows: number;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
  }

  /** Update terminal dimensions (call on SIGWINCH). */
  setSize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  render(pixels: PixelBuffer): Buffer {
    // Sixel: target pixel dimensions based on terminal cell size.
    // Most terminals use ~8px wide x ~16px tall per cell.
    const targetWidth = this.cols * 8;
    const targetHeight = this.rows * 16;

    // Preserve aspect ratio
    const srcAspect = pixels.width / pixels.height;
    const dstAspect = targetWidth / targetHeight;

    let fitWidth: number;
    let fitHeight: number;

    if (srcAspect > dstAspect) {
      fitWidth = targetWidth;
      fitHeight = Math.round(targetWidth / srcAspect);
    } else {
      fitHeight = targetHeight;
      fitWidth = Math.round(targetHeight * srcAspect);
    }

    const resized = bilinearResize(pixels, fitWidth, fitHeight);

    // Position cursor at top-left and emit sixel data
    const prefix = moveCursor(0, 0);
    const sixelData = encodeSixel(resized);

    const output = Buffer.allocUnsafe(prefix.length + sixelData.length);
    output.write(prefix, 0, 'utf8');
    sixelData.copy(output, prefix.length);

    return output;
  }

  reset(): void {
    // No diff state to clear — sixel re-emits full image each frame
  }
}
