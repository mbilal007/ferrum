import type { PixelBuffer, Renderer, ColorMode } from './types.js';
import type { TextNode } from '../cdp/dom-text.js';
import { resizeToTerminal } from './resize.js';
import { buildFrameBuffer } from './frame-buffer.js';
import { applyTextOverlay } from './text-overlay.js';
import { DiffWriter } from './diff-writer.js';

/**
 * Renders pixels using half-block Unicode characters (U+2584).
 * Each cell encodes two vertical pixels via fg/bg colors.
 * Supports differential output to minimize terminal writes.
 */
export class HalfBlockRenderer implements Renderer {
  private diffWriter = new DiffWriter();
  private colorMode: ColorMode;
  private cols: number;
  private rows: number;
  private textNodes: TextNode[] = [];
  private scrollY = 0;

  constructor(cols: number, rows: number, colorMode: ColorMode) {
    this.cols = cols;
    this.rows = rows;
    this.colorMode = colorMode;
  }

  /** Update terminal dimensions (call on SIGWINCH). */
  setSize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  /** Update text overlay data from the TextCache. */
  setTextOverlay(textNodes: TextNode[], scrollY: number): void {
    this.textNodes = textNodes;
    this.scrollY = scrollY;
  }

  render(pixels: PixelBuffer): Buffer {
    const scaled = resizeToTerminal(pixels, this.cols, this.rows);
    const frame = buildFrameBuffer(scaled, this.colorMode);
    if (this.textNodes.length > 0) {
      applyTextOverlay(frame, this.textNodes, 1024, 768, this.scrollY, this.colorMode);
    }
    return this.diffWriter.render(frame, this.colorMode);
  }

  reset(): void {
    this.diffWriter.reset();
  }
}
