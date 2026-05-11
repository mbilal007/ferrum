import type { PixelBuffer } from './types.js';

interface ColorBox {
  pixels: number[][];
  channel: number;
  min: number[];
  max: number[];
}

/**
 * Median-cut color quantization: analyzes the frame's actual colors and picks
 * the optimal N colors to represent it. Produces dramatically better results
 * than a fixed palette for photos and web content.
 */
function medianCut(pixels: PixelBuffer, maxColors: number): { palette: number[][]; indexed: Uint8Array } {
  const { width, height, data } = pixels;
  const totalPixels = width * height;

  // Collect all unique-ish pixels (sample if too many for performance)
  const sampleStep = totalPixels > 50000 ? Math.ceil(totalPixels / 50000) : 1;
  const samples: number[][] = [];

  for (let i = 0; i < totalPixels; i += sampleStep) {
    const base = i * 4;
    samples.push([data[base]!, data[base + 1]!, data[base + 2]!]);
  }

  // Build initial box containing all samples
  const initialBox = makeBox(samples);
  const boxes: ColorBox[] = [initialBox];

  // Split boxes until we have maxColors
  while (boxes.length < maxColors) {
    // Find the box with the largest range on any channel
    let bestIdx = 0;
    let bestRange = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]!;
      for (let ch = 0; ch < 3; ch++) {
        const range = box.max[ch]! - box.min[ch]!;
        if (range > bestRange) {
          bestRange = range;
          bestIdx = i;
          box.channel = ch;
        }
      }
    }

    if (bestRange === 0) break;

    const box = boxes[bestIdx]!;
    const ch = box.channel;

    // Sort pixels by the widest channel and split at median
    box.pixels.sort((a, b) => a[ch]! - b[ch]!);
    const mid = Math.floor(box.pixels.length / 2);

    if (mid === 0 || mid === box.pixels.length) break;

    const left = box.pixels.slice(0, mid);
    const right = box.pixels.slice(mid);

    boxes[bestIdx] = makeBox(left);
    boxes.push(makeBox(right));
  }

  // Compute palette as average color of each box
  const palette: number[][] = boxes.map(box => {
    let r = 0, g = 0, b = 0;
    for (const px of box.pixels) {
      r += px[0]!;
      g += px[1]!;
      b += px[2]!;
    }
    const n = box.pixels.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });

  // Map every pixel to nearest palette entry
  const indexed = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const base = i * 4;
    const r = data[base]!;
    const g = data[base + 1]!;
    const b = data[base + 2]!;

    let bestDist = Infinity;
    let bestColor = 0;
    for (let c = 0; c < palette.length; c++) {
      const p = palette[c]!;
      const dr = r - p[0]!;
      const dg = g - p[1]!;
      const db = b - p[2]!;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestColor = c;
        if (dist === 0) break;
      }
    }
    indexed[i] = bestColor;
  }

  return { palette, indexed };
}

function makeBox(pixels: number[][]): ColorBox {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const px of pixels) {
    for (let ch = 0; ch < 3; ch++) {
      if (px[ch]! < min[ch]!) min[ch] = px[ch]!;
      if (px[ch]! > max[ch]!) max[ch] = px[ch]!;
    }
  }
  return { pixels, channel: 0, min, max };
}

/**
 * Encode a PixelBuffer into a Sixel escape sequence using median-cut quantization.
 * Sixel encodes pixels in vertical bands of 6. Each column is one character (value + 63).
 * Color registers define the palette; pixel data references register numbers.
 */
export function encodeSixel(pixels: PixelBuffer, maxColors = 256): Buffer {
  const { width, height } = pixels;
  if (width === 0 || height === 0) return Buffer.from('');

  const { palette, indexed } = medianCut(pixels, maxColors);
  const parts: string[] = [];

  // DCS introducer: P0;0;q sets raster attributes
  parts.push(`\x1bP0;0;q"1;1;${width};${height}`);

  // Define color registers (RGB mode = 2, values 0-100%)
  for (let i = 0; i < palette.length; i++) {
    const [r, g, b] = palette[i]!;
    const rp = Math.round((r! / 255) * 100);
    const gp = Math.round((g! / 255) * 100);
    const bp = Math.round((b! / 255) * 100);
    parts.push(`#${i};2;${rp};${gp};${bp}`);
  }

  // Encode pixel data in 6-row bands
  for (let bandY = 0; bandY < height; bandY += 6) {
    const bandHeight = Math.min(6, height - bandY);

    // For each color in this band, emit its sixel row
    for (let colorIdx = 0; colorIdx < palette.length; colorIdx++) {
      let hasPixels = false;
      let rowData = '';
      let runChar = '';
      let runLength = 0;

      for (let x = 0; x < width; x++) {
        let sixelValue = 0;

        for (let bit = 0; bit < bandHeight; bit++) {
          const y = bandY + bit;
          const pixelIdx = y * width + x;
          if (indexed[pixelIdx] === colorIdx) {
            sixelValue |= (1 << bit);
          }
        }

        const ch = String.fromCharCode(sixelValue + 63);

        if (ch === runChar) {
          runLength++;
        } else {
          if (runLength > 0) {
            hasPixels = hasPixels || runChar !== '?';
            rowData += encodeRun(runChar, runLength);
          }
          runChar = ch;
          runLength = 1;
        }
      }

      // Flush last run
      if (runLength > 0) {
        hasPixels = hasPixels || runChar !== '?';
        rowData += encodeRun(runChar, runLength);
      }

      if (hasPixels) {
        parts.push(`#${colorIdx}${rowData}$`);
      }
    }

    // Move to next band (- = graphics new line)
    parts.push('-');
  }

  // String terminator
  parts.push('\x1b\\');

  return Buffer.from(parts.join(''));
}

/** RLE encode a run of identical sixel characters. */
function encodeRun(char: string, count: number): string {
  if (count === 1) return char;
  if (count === 2) return char + char;
  if (count === 3) return char + char + char;
  return `!${count}${char}`;
}
