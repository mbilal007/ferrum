import type { CDPSession } from 'puppeteer-core';
import type { Protocol } from 'devtools-protocol';
import { decodeImageBuffer } from '../renderer/decode.js';
import type { PixelBuffer } from '../renderer/types.js';

export interface ScreencastOptions {
  maxFps: number;
  quality: number;
}

export interface ScreencastHandle {
  stop: () => Promise<void>;
}

/** Start a JPEG screencast using ACK-based backpressure. Chrome won't send the next frame
 *  until we acknowledge the current one, so the pipeline never gets ahead of the renderer. */
export async function startScreencast(
  cdp: CDPSession,
  options: ScreencastOptions,
  onFrame: (pixels: PixelBuffer) => void
): Promise<ScreencastHandle> {
  let stopped = false;

  cdp.on('Page.screencastFrame', async (event: Protocol.Page.ScreencastFrameEvent) => {
    if (stopped) return;

    try {
      const buf = Buffer.from(event.data, 'base64');
      const pixels = decodeImageBuffer(buf);
      onFrame(pixels);
    } catch (err) {
      // Decode failures are non-fatal; skip the frame and keep going
      process.stderr.write(`ferrum: screencast frame decode error: ${String(err)}\n`);
    } finally {
      // ACK after processing so Chrome waits for us before sending the next frame
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
      } catch {
        // CDP session may have closed; nothing to do
      }
    }
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: options.quality,
    everyNthFrame: 1,
  });

  return {
    stop: async () => {
      stopped = true;
      try {
        await cdp.send('Page.stopScreencast');
      } catch {
        // Session may already be closed if Chrome was killed
      }
    },
  };
}
