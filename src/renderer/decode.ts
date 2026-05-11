import { readFile } from 'node:fs/promises';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import type { PixelBuffer } from './types.js';

// Magic bytes for format detection
const JPEG_MAGIC_0 = 0xff;
const JPEG_MAGIC_1 = 0xd8;
const PNG_MAGIC_0 = 0x89;
const PNG_MAGIC_1 = 0x50;

/** Detect image format from the first two magic bytes. Returns 'jpeg', 'png', or 'unknown'. */
function detectFormat(buf: Buffer): 'jpeg' | 'png' | 'unknown' {
  if (buf[0] === JPEG_MAGIC_0 && buf[1] === JPEG_MAGIC_1) return 'jpeg';
  if (buf[0] === PNG_MAGIC_0 && buf[1] === PNG_MAGIC_1) return 'png';
  return 'unknown';
}

/** Decode a JPEG or PNG buffer to a raw RGBA PixelBuffer. */
export function decodeImageBuffer(buffer: Buffer): PixelBuffer {
  const format = detectFormat(buffer);

  if (format === 'jpeg') {
    const result = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    return { width: result.width, height: result.height, data: result.data };
  }

  if (format === 'png') {
    const result = PNG.sync.read(buffer);
    return { width: result.width, height: result.height, data: new Uint8Array(result.data) };
  }

  throw new Error(`Unsupported image format: magic bytes 0x${buffer[0]?.toString(16)} 0x${buffer[1]?.toString(16)}`);
}

/** Read a JPEG or PNG file from disk and decode it to a raw RGBA PixelBuffer. */
export async function decodeImageFile(filePath: string): Promise<PixelBuffer> {
  const buffer = await readFile(filePath);
  return decodeImageBuffer(buffer);
}
