#!/usr/bin/env node

import { renderCommand } from './commands/render.js';
import { browseCommand } from './commands/browse.js';

const VERSION = '0.1.0';

const HELP = `
ferrum v${VERSION} — programmable terminal rendering

Usage:
  ferrum render <image>         Render an image in the terminal
  ferrum <url>                  Browse a URL in the terminal
  ferrum --help                 Show this help
  ferrum --version              Show version

Examples:
  ferrum render photo.jpg
  ferrum https://example.com
`.trim();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    process.exit(0);
  }

  const command = args[0];

  if (command === 'render') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Error: render requires a file path');
      process.exit(1);
    }
    await renderCommand(filePath);
  } else if (command?.startsWith('http://') || command?.startsWith('https://')) {
    await browseCommand(command);
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
