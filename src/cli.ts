#!/usr/bin/env node

import { renderCommand } from './commands/render.js';
import { browseCommand } from './commands/browse.js';
import type { RenderMode } from './renderer/types.js';

const VERSION = '0.1.0';

const HELP = `
ferrum v${VERSION} — programmable terminal rendering

Usage:
  ferrum render <image>         Render an image in the terminal
  ferrum <url>                  Browse a URL in the terminal
  ferrum --help                 Show this help
  ferrum --version              Show version

Options:
  --sixel                       Force Sixel graphics output
  --halfblock                   Force half-block character output
  (default: auto-detect based on terminal capabilities)

Examples:
  ferrum render photo.jpg
  ferrum https://example.com
  ferrum --sixel https://example.com
`.trim();

/** Extract render mode flag from args, return the flag and remaining args. */
function parseRenderMode(args: string[]): { mode?: RenderMode; rest: string[] } {
  const rest: string[] = [];
  let mode: RenderMode | undefined;

  for (const arg of args) {
    if (arg === '--sixel') mode = 'sixel';
    else if (arg === '--halfblock') mode = 'halfblock';
    else rest.push(arg);
  }

  return { mode, rest };
}

async function main() {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
    console.log(VERSION);
    process.exit(0);
  }

  const { mode, rest: args } = parseRenderMode(rawArgs);
  const command = args[0];

  if (command === 'render') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Error: render requires a file path');
      process.exit(1);
    }
    await renderCommand(filePath, mode);
  } else if (command?.startsWith('http://') || command?.startsWith('https://')) {
    await browseCommand(command, mode);
  } else {
    console.error(`Unknown command or URL: ${command}`);
    console.error('Run "ferrum --help" for usage');
    process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
