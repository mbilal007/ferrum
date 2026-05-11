import type { PixelBuffer } from './types.js';

/**
 * Bilinear resize of an RGBA PixelBuffer to the given target dimensions.
 * Optimized for downscale ratios in the 1.5-2x range: avoids per-pixel allocations
 * by writing directly into a pre-allocated output buffer.
 */
export function bilinearResize(src: PixelBuffer, targetWidth: number, targetHeight: number): PixelBuffer {
  const { width: sw, height: sh, data: sd } = src;
  const out = new Uint8Array(targetWidth * targetHeight * 4);

  const xRatio = sw / targetWidth;
  const yRatio = sh / targetHeight;

  for (let dy = 0; dy < targetHeight; dy++) {
    const sy = dy * yRatio;
    const sy0 = Math.floor(sy);
    const sy1 = Math.min(sy0 + 1, sh - 1);
    const fy = sy - sy0;
    const fy1 = 1 - fy;

    const row0base = sy0 * sw * 4;
    const row1base = sy1 * sw * 4;
    const dstRowBase = dy * targetWidth * 4;

    for (let dx = 0; dx < targetWidth; dx++) {
      const sx = dx * xRatio;
      const sx0 = Math.floor(sx);
      const sx1 = Math.min(sx0 + 1, sw - 1);
      const fx = sx - sx0;
      const fx1 = 1 - fx;

      const p00 = row0base + sx0 * 4;
      const p10 = row0base + sx1 * 4;
      const p01 = row1base + sx0 * 4;
      const p11 = row1base + sx1 * 4;

      const dstIdx = dstRowBase + dx * 4;

      // Bilinear interpolation for each channel
      out[dstIdx]     = fy1 * (fx1 * sd[p00]     + fx * sd[p10])     + fy * (fx1 * sd[p01]     + fx * sd[p11]);
      out[dstIdx + 1] = fy1 * (fx1 * sd[p00 + 1] + fx * sd[p10 + 1]) + fy * (fx1 * sd[p01 + 1] + fx * sd[p11 + 1]);
      out[dstIdx + 2] = fy1 * (fx1 * sd[p00 + 2] + fx * sd[p10 + 2]) + fy * (fx1 * sd[p01 + 2] + fx * sd[p11 + 2]);
      out[dstIdx + 3] = fy1 * (fx1 * sd[p00 + 3] + fx * sd[p10 + 3]) + fy * (fx1 * sd[p01 + 3] + fx * sd[p11 + 3]);
    }
  }

  return { width: targetWidth, height: targetHeight, data: out };
}

/**
 * Resize a PixelBuffer to fit within a terminal grid of (cols x rows) cells.
 * Terminal half-block characters give 2 vertical pixels per row, so the pixel
 * target height is rows * 2. Aspect ratio is preserved; empty areas are black (0,0,0,255).
 */
export function resizeToTerminal(src: PixelBuffer, cols: number, rows: number): PixelBuffer {
  const targetWidth = cols;
  const targetHeight = rows * 2;

  const srcAspect = src.width / src.height;
  const dstAspect = targetWidth / targetHeight;

  let fitWidth: number;
  let fitHeight: number;

  if (srcAspect > dstAspect) {
    // Image is wider than destination: constrain by width
    fitWidth = targetWidth;
    fitHeight = Math.round(targetWidth / srcAspect);
  } else {
    // Image is taller than destination: constrain by height
    fitHeight = targetHeight;
    fitWidth = Math.round(targetHeight * srcAspect);
  }

  const resized = bilinearResize(src, fitWidth, fitHeight);

  // If the fit is exact, return immediately without padding
  if (fitWidth === targetWidth && fitHeight === targetHeight) {
    return resized;
  }

  // Center the resized image on a black canvas
  const canvas = new Uint8Array(targetWidth * targetHeight * 4);
  // Alpha channel defaults to 0; set to 255 for fully opaque black background
  for (let i = 3; i < canvas.length; i += 4) {
    canvas[i] = 255;
  }

  const offsetX = Math.floor((targetWidth - fitWidth) / 2);
  const offsetY = Math.floor((targetHeight - fitHeight) / 2);

  for (let y = 0; y < fitHeight; y++) {
    const srcRowStart = y * fitWidth * 4;
    const dstRowStart = ((offsetY + y) * targetWidth + offsetX) * 4;
    canvas.set(resized.data.subarray(srcRowStart, srcRowStart + fitWidth * 4), dstRowStart);
  }

  return { width: targetWidth, height: targetHeight, data: canvas };
}
