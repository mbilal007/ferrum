import type { PixelBuffer, FrameBuffer, ColorMode, RenderOptions } from '../renderer/types.js';
import { decodeImageBuffer } from '../renderer/decode.js';
import { resizeToTerminal } from '../renderer/resize.js';
import { buildFrameBuffer } from '../renderer/frame-buffer.js';
import { DiffWriter } from '../renderer/diff-writer.js';
import { getTerminalSize, detectColorMode } from '../renderer/terminal.js';
import { launchChrome } from '../cdp/chrome-launcher.js';
import { connect } from '../cdp/connection.js';

/**
 * Render a URL to a FrameBuffer — the programmatic library API.
 * Launches Chrome, captures a single frame, returns structured data.
 */
export async function render(url: string, opts?: RenderOptions): Promise<FrameBuffer> {
  const cols = opts?.cols ?? getTerminalSize().cols;
  const rows = opts?.rows ?? getTerminalSize().rows;
  const mode: ColorMode = opts?.colorMode ?? detectColorMode();

  const chrome = await launchChrome({ width: 1024, height: 768 });

  try {
    const session = await connect(chrome.wsEndpoint, cols, rows);

    try {
      await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const cdp = session.cdp;
      const result = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 80,
      });

      const buffer = Buffer.from(result.data, 'base64');
      const pixels = decodeImageBuffer(buffer);
      const scaled = resizeToTerminal(pixels, cols, rows);
      return buildFrameBuffer(scaled, mode);
    } finally {
      await session.close();
    }
  } finally {
    chrome.kill();
  }
}

export { DiffWriter } from '../renderer/diff-writer.js';
export type { PixelBuffer, FrameBuffer, ColorMode, RenderOptions } from '../renderer/types.js';
