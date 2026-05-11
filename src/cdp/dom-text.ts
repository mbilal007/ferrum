import type { CDPSession } from 'puppeteer-core';

export interface TextNode {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: { r: number; g: number; b: number };
  fontSize: number;
}

/** JS snippet injected into the page to bulk-extract all visible text with layout info. */
const EXTRACT_SCRIPT = `() => {
  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent?.trim();
      if (!text) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let current;
  while ((current = walker.nextNode())) {
    const parent = current.parentElement;
    if (!parent) continue;

    const range = document.createRange();
    range.selectNodeContents(current);
    const rects = range.getClientRects();

    const style = getComputedStyle(parent);
    const fontSize = parseFloat(style.fontSize);
    const colorMatch = style.color.match(/\\d+/g);
    const r = colorMatch ? parseInt(colorMatch[0], 10) : 0;
    const g = colorMatch ? parseInt(colorMatch[1], 10) : 0;
    const b = colorMatch ? parseInt(colorMatch[2], 10) : 0;

    for (const rect of rects) {
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;

      results.push({
        text: current.textContent.trim(),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: { r, g, b },
        fontSize
      });
    }
  }

  return results;
}`;

/**
 * Extract all visible text nodes from the page in a single CDP call.
 * Returns text content with bounding rects, colors, and font sizes.
 */
export async function extractTextNodes(cdp: CDPSession): Promise<TextNode[]> {
  try {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(${EXTRACT_SCRIPT})()`,
      returnByValue: true,
      awaitPromise: false,
    });

    if (result.result?.value && Array.isArray(result.result.value)) {
      return result.result.value as TextNode[];
    }
    return [];
  } catch {
    return [];
  }
}
