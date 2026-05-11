import { colorClose } from '../utils/color.js';
import { moveCursor } from './terminal.js';
import type { Cell, FrameBuffer, ColorMode } from './types.js';

const ONE_MB = 1024 * 1024;

export class DiffWriter {
  private prevCells: Cell[][] | null = null;
  private outputBuf: Buffer = Buffer.allocUnsafe(ONE_MB);

  /**
   * Renders a FrameBuffer into a Buffer of ANSI escape sequences.
   * On the first call (or after reset) performs a full render.
   * On subsequent calls, skips unchanged cells and uses cursor movement
   * to jump over runs of unchanged cells. Falls back to full render when
   * >60% of cells have changed, avoiding many small cursor moves.
   */
  render(frame: FrameBuffer, _mode: ColorMode): Buffer {
    const buf = this.outputBuf;
    let offset = 0;

    const write = (s: string) => {
      const needed = Buffer.byteLength(s, 'utf8');
      // Grow buffer if required (rare: large frames approaching 1MB)
      if (offset + needed > buf.length) {
        this.outputBuf = Buffer.allocUnsafe(buf.length * 2);
        buf.copy(this.outputBuf, 0, 0, offset);
        return write(s);
      }
      offset += buf.write(s, offset, 'utf8');
    };

    const doFullRender = () => {
      for (let row = 0; row < frame.rows; row++) {
        write(moveCursor(0, row));
        for (let col = 0; col < frame.cols; col++) {
          write(frame.cells[row]![col]!.encoded);
        }
      }
    };

    if (this.prevCells === null) {
      doFullRender();
    } else {
      // Count changed cells to decide whether to diff or full-render
      let changed = 0;
      const total = frame.rows * frame.cols;

      for (let row = 0; row < frame.rows; row++) {
        for (let col = 0; col < frame.cols; col++) {
          const cur = frame.cells[row]![col]!;
          const prev = this.prevCells[row]?.[col];
          if (prev === undefined || !cellsMatch(cur, prev)) changed++;
        }
      }

      if (changed / total > 0.6) {
        doFullRender();
      } else {
        for (let row = 0; row < frame.rows; row++) {
          let col = 0;
          while (col < frame.cols) {
            const cur = frame.cells[row]![col]!;
            const prev = this.prevCells[row]?.[col];

            if (prev !== undefined && cellsMatch(cur, prev)) {
              col++;
              continue;
            }

            // Move to the first changed cell in this run, then write contiguous changed cells
            write(moveCursor(col, row));
            while (col < frame.cols) {
              const c = frame.cells[row]![col]!;
              const p = this.prevCells[row]?.[col];
              if (p !== undefined && cellsMatch(c, p)) break;
              write(c.encoded);
              col++;
            }
          }
        }
      }
    }

    this.prevCells = frame.cells;
    return buf.subarray(0, offset);
  }

  /** Clears previous frame state, forcing a full render on the next call. */
  reset(): void {
    this.prevCells = null;
  }
}

/** Returns true when two cells are visually identical within color tolerance. */
function cellsMatch(a: Cell, b: Cell): boolean {
  return (
    a.char === b.char &&
    colorClose(a.fg, b.fg, 0) &&
    colorClose(a.bg, b.bg, 0)
  );
}
