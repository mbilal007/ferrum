import type { CDPSession } from 'puppeteer-core';

export interface InputHandler {
  start: () => void;
  stop: () => void;
}

// xterm SGR mouse protocol sequence pattern: ESC[<btn;col;rowM or ESC[<btn;col;rowm
const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;

/** Maps terminal pixel coords to page coords for a 1024x768 viewport. */
function terminalToPage(
  col: number,
  row: number,
  terminalCols: number,
  terminalRows: number
): { x: number; y: number } {
  return {
    x: col * (1024 / terminalCols),
    y: row * 2 * (768 / (terminalRows * 2)),
  };
}

/**
 * Creates a handler that translates raw terminal key/mouse input into CDP
 * Input.dispatch* events. Enables xterm SGR mouse reporting on start and
 * restores the terminal state on stop.
 */
export function createInputHandler(
  cdp: CDPSession,
  getTerminalSize: () => { cols: number; rows: number }
): InputHandler {
  const onData = (data: Buffer) => {
    const seq = data.toString('binary');

    // Ctrl+C: restore terminal and exit
    if (data[0] === 0x03) {
      process.stdout.write('\x1b[?1000l\x1b[?1006l');
      process.exit(0);
    }

    // Arrow Up
    if (seq === '\x1b[A') {
      void cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 300, deltaX: 0, deltaY: -100 });
      return;
    }

    // Arrow Down
    if (seq === '\x1b[B') {
      void cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 300, deltaX: 0, deltaY: 100 });
      return;
    }

    // Page Up
    if (seq === '\x1b[5~') {
      void cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 300, deltaX: 0, deltaY: -500 });
      return;
    }

    // Page Down
    if (seq === '\x1b[6~') {
      void cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 300, deltaX: 0, deltaY: 500 });
      return;
    }

    // xterm SGR mouse click: ESC[<0;col;rowM (press) or ESC[<0;col;rowm (release)
    const mouse = SGR_MOUSE_RE.exec(seq);
    if (mouse) {
      const btn = parseInt(mouse[1]!, 10);
      const col = parseInt(mouse[2]!, 10) - 1; // SGR is 1-based
      const row = parseInt(mouse[3]!, 10) - 1;
      const isPress = mouse[4] === 'M';

      // Only handle left button (btn 0)
      if (btn === 0) {
        const { cols, rows } = getTerminalSize();
        const { x, y } = terminalToPage(col, row, cols, rows);
        const type = isPress ? 'mousePressed' : 'mouseReleased';
        void cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
    }
  };

  return {
    start() {
      // Enable xterm mouse reporting (button events) + SGR extended coordinates
      process.stdout.write('\x1b[?1000h\x1b[?1006h');
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    },

    stop() {
      process.stdout.write('\x1b[?1000l\x1b[?1006l');
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
    },
  };
}
