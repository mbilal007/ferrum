import { launchChrome } from '../cdp/chrome-launcher.js';
import type { ChromeInstance } from '../cdp/chrome-launcher.js';
import { connect } from '../cdp/connection.js';
import type { BrowserSession } from '../cdp/connection.js';
import { startScreencast } from '../cdp/screencast.js';
import type { ScreencastHandle } from '../cdp/screencast.js';
import { TextCache } from '../cdp/text-cache.js';
import type { PixelBuffer, RenderMode } from '../renderer/types.js';
import { HalfBlockRenderer } from '../renderer/half-block-renderer.js';
import { SixelRenderer } from '../renderer/sixel-renderer.js';
import {
  getTerminalSize,
  detectColorMode,
  detectRenderMode,
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
export async function browseCommand(url: string, explicitMode?: RenderMode): Promise<void> {
  const { cols, rows } = getTerminalSize();
  if (cols < MIN_COLS || rows < MIN_ROWS) {
    process.stderr.write(
      `Warning: terminal is ${cols}x${rows}, recommended minimum is ${MIN_COLS}x${MIN_ROWS}\n`
    );
  }

  const renderMode = detectRenderMode(explicitMode);
  process.stderr.write(`Connecting to Chrome... (${renderMode} mode)\n`);

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

  // Clear the status line
  process.stderr.write('\x1b[1A\x1b[2K');
  process.stdout.write(hideCursor());

  const colorMode = detectColorMode();
  const textCache = new TextCache();

  // Build the appropriate renderer
  const halfBlock = renderMode === 'halfblock'
    ? new HalfBlockRenderer(cols, rows, colorMode)
    : null;
  const sixel = renderMode === 'sixel'
    ? new SixelRenderer(cols, rows)
    : null;

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

      if (sixel) {
        sixel.setSize(c, r);
        const output = sixel.render(pixels);
        process.stdout.write(output);
      } else if (halfBlock) {
        halfBlock.setSize(c, r);
        halfBlock.setTextOverlay(textCache.getTextNodes(), textCache.getScrollY());
        const output = halfBlock.render(pixels);
        process.stdout.write(output);
      }
    }
  );

  inputHandler.start();

  // Reset renderer state on terminal resize
  process.on('SIGWINCH', () => {
    halfBlock?.reset();
    sixel?.reset();
    textCache.invalidate();
  });
}
