import { access } from 'node:fs/promises';
import { decodeImageFile } from '../renderer/decode.js';
import { resizeToTerminal } from '../renderer/resize.js';
import { buildFrameBuffer } from '../renderer/frame-buffer.js';
import { DiffWriter } from '../renderer/diff-writer.js';
import { encodeSixel } from '../renderer/sixel.js';
import { bilinearResize } from '../renderer/resize.js';
import type { RenderMode } from '../renderer/types.js';
import { getTerminalSize, detectColorMode, detectRenderMode, hideCursor, showCursor, resetStyle, setupTerminalRestore } from '../renderer/terminal.js';

/** Render a static image file in the terminal */
export async function renderCommand(filePath: string, explicitMode?: RenderMode): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  setupTerminalRestore();

  const { cols, rows } = getTerminalSize();
  const renderMode = detectRenderMode(explicitMode);
  const pixels = await decodeImageFile(filePath);

  process.stdout.write(hideCursor());

  if (renderMode === 'sixel') {
    // Sixel: resize to pixel dimensions and encode directly
    const targetWidth = cols * 8;
    const targetHeight = rows * 16;
    const srcAspect = pixels.width / pixels.height;
    const dstAspect = targetWidth / targetHeight;
    const fitWidth = srcAspect > dstAspect ? targetWidth : Math.round(targetHeight * srcAspect);
    const fitHeight = srcAspect > dstAspect ? Math.round(targetWidth / srcAspect) : targetHeight;

    const resized = bilinearResize(pixels, fitWidth, fitHeight);
    const output = encodeSixel(resized);
    process.stdout.write(output);
  } else {
    // Half-block: resize to terminal cells and render via character grid
    const mode = detectColorMode();
    const scaled = resizeToTerminal(pixels, cols, rows);
    const frame = buildFrameBuffer(scaled, mode);
    const writer = new DiffWriter();
    const output = writer.render(frame, mode);
    process.stdout.write(output);
  }

  process.stdout.write('\n' + resetStyle() + showCursor());
}
