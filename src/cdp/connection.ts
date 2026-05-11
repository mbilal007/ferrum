import puppeteer from 'puppeteer-core';
import type { Page, CDPSession } from 'puppeteer-core';

export interface BrowserSession {
  page: Page;
  cdp: CDPSession;
  close: () => Promise<void>;
}

const VIEWPORT_WIDTH = 1024;
const VIEWPORT_HEIGHT = 768;
const MIN_SCALE = 0.2;
const MAX_SCALE = 1.0;

/** Connect to a running Chrome instance via its WebSocket endpoint and set up a page ready for screencasting. */
export async function connect(
  wsEndpoint: string,
  terminalCols: number,
  terminalRows: number
): Promise<BrowserSession> {
  const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });

  const pages = await browser.pages();
  const page: Page = pages.length > 0 ? pages[0] : await browser.newPage();

  const cdp = await page.createCDPSession();

  // Scale the viewport so it maps reasonably to the terminal character grid.
  // 1.5 approximates the pixel-per-column density at typical font sizes.
  const rawScale = (terminalCols * 1.5) / VIEWPORT_WIDTH;
  const deviceScaleFactor = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor,
    mobile: false,
  });

  return {
    page,
    cdp,
    close: async () => {
      await cdp.detach();
      await browser.disconnect();
    },
  };
}
