import { launchChrome } from '../cdp/chrome-launcher.js';
import type { ChromeInstance } from '../cdp/chrome-launcher.js';
import { connect } from '../cdp/connection.js';
import type { BrowserSession } from '../cdp/connection.js';
import { startScreencast } from '../cdp/screencast.js';
import type { ScreencastHandle } from '../cdp/screencast.js';
import { TextCache } from '../cdp/text-cache.js';
import type { PixelBuffer } from '../renderer/types.js';
import { DiffWriter } from '../renderer/diff-writer.js';
import { buildFrameBuffer } from '../renderer/frame-buffer.js';
import { resizeToTerminal } from '../renderer/resize.js';
import { applyTextOverlay } from '../renderer/text-overlay.js';
import {
  getTerminalSize,
  detectColorMode,
  hideCursor,
  showCursor,
  resetStyle,
} from '../renderer/terminal.js';
import { createInputHandler } from '../cdp/input.js';

const MIN_COLS = 160;
const MIN_ROWS = 50;
const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;

/**
 * Full browse command: launches Chrome, connects via CDP, streams a live
 * screencast into the terminal, and wires up keyboard/mouse input.
 */
export async function browseCommand(url: string): Promise<void> {
  const { cols, rows } = getTerminalSize();
  if (cols < MIN_COLS || rows < MIN_ROWS) {
    process.stderr.write(
      `Warning: terminal is ${cols}x${rows}, recommended minimum is ${MIN_COLS}x${MIN_ROWS}\n`
    );
  }

  process.stderr.write('Connecting to Chrome...\n');

  let chrome: ChromeInstance;
  try {
    chrome = await launchChrome({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: failed to launch Chrome: ${msg}\n`);
    process.exit(1);
  }

  let session: BrowserSession;
  try {
    const size = getTerminalSize();
    session = await connect(chrome.wsEndpoint, size.cols, size.rows);
  } catch (err) {
    chrome.kill();
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: failed to connect to Chrome: ${msg}\n`);
    process.exit(1);
  }

  try {
    await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    await session.close();
    chrome.kill();
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: navigation failed: ${msg}\n`);
    process.exit(1);
  }

  // Clear the "Connecting to Chrome..." line
  process.stderr.write('\x1b[1A\x1b[2K');
  process.stdout.write(hideCursor());

  const diffWriter = new DiffWriter();
  const colorMode = detectColorMode();
  const textCache = new TextCache();

  await textCache.attach(session.cdp);

  let screencast: ScreencastHandle | null = null;
  const inputHandler = createInputHandler(session.cdp, getTerminalSize, (deltaY) => {
    textCache.updateScroll(deltaY);
  });

  const cleanup = async () => {
    inputHandler.stop();
    if (screencast) await screencast.stop();
    await session.close();
    chrome.kill();
    process.stdout.write(showCursor() + resetStyle());
  };

  process.on('SIGINT', () => { void cleanup().then(() => process.exit(130)); });
  process.on('SIGTERM', () => { void cleanup().then(() => process.exit(143)); });
  process.on('uncaughtException', (err) => {
    process.stdout.write(showCursor() + resetStyle());
    console.error(err);
    process.exit(1);
  });
  process.on('exit', () => { chrome.kill(); });

  screencast = await startScreencast(
    session.cdp,
    { quality: 80 },
    (pixels: PixelBuffer) => {
      const { cols: c, rows: r } = getTerminalSize();
      const scaled = resizeToTerminal(pixels, c, r);
      const frame = buildFrameBuffer(scaled, colorMode);
      applyTextOverlay(frame, textCache.getTextNodes(), VIEWPORT_WIDTH, VIEWPORT_HEIGHT, textCache.getScrollY(), colorMode);
      const output = diffWriter.render(frame, colorMode);
      process.stdout.write(output);
    }
  );

  inputHandler.start();

  // Reset diff state on terminal resize so the next frame does a full repaint
  process.on('SIGWINCH', () => {
    diffWriter.reset();
    textCache.invalidate();
  });
}
