/** RGB color with 0-255 components */
export interface Color {
  r: number;
  g: number;
  b: number;
}

/** A single terminal cell (one character position) */
export interface Cell {
  fg: Color;
  bg: Color;
  char: string;
  encoded: string;
}

/** Raw RGBA pixel buffer from image decode */
export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Grid of terminal cells ready for output */
export interface FrameBuffer {
  cols: number;
  rows: number;
  cells: Cell[][];
}

/** Terminal color mode */
export type ColorMode = 'truecolor' | '256';

/** Output rendering mode */
export type RenderMode = 'halfblock' | 'sixel';

/** Render options for the library API */
export interface RenderOptions {
  cols?: number;
  rows?: number;
  colorMode?: ColorMode;
  renderMode?: RenderMode;
}

/** Abstract renderer that converts pixel data to terminal output. */
export interface Renderer {
  render(pixels: PixelBuffer): Buffer;
  reset(): void;
}
