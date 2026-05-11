import { access } from 'node:fs/promises';
import { decodeImageFile } from '../renderer/decode.js';
import { resizeToTerminal } from '../renderer/resize.js';
import { buildFrameBuffer } from '../renderer/frame-buffer.js';
import { DiffWriter } from '../renderer/diff-writer.js';
import { getTerminalSize, detectColorMode, hideCursor, showCursor, resetStyle, setupTerminalRestore } from '../renderer/terminal.js';

/** Render a static image file in the terminal */
export async function renderCommand(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  setupTerminalRestore();

  const { cols, rows } = getTerminalSize();
  const mode = detectColorMode();

  const pixels = await decodeImageFile(filePath);
  const scaled = resizeToTerminal(pixels, cols, rows);
  const frame = buildFrameBuffer(scaled, mode);

  const writer = new DiffWriter();
  const output = writer.render(frame, mode);

  process.stdout.write(hideCursor());
  process.stdout.write(output);
  process.stdout.write('\n' + resetStyle() + showCursor());
}
