import type { CDPSession } from 'puppeteer-core';
import type { TextNode } from './dom-text.js';
import { extractTextNodes } from './dom-text.js';

/** Debounce period for re-extraction after invalidation events (ms). */
const INVALIDATION_DEBOUNCE_MS = 150;

/**
 * Caches extracted text nodes and manages invalidation on scroll, navigation,
 * and DOM changes. Re-extraction is async and non-blocking; stale data is
 * served until the new extraction completes.
 */
export class TextCache {
  private nodes: TextNode[] = [];
  private scrollY = 0;
  private cdp: CDPSession | null = null;
  private extracting = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** Attach to a CDP session and perform initial text extraction. */
  async attach(cdp: CDPSession): Promise<void> {
    this.cdp = cdp;

    cdp.on('Page.frameNavigated', () => this.invalidate());
    cdp.on('DOM.documentUpdated', () => this.scheduleExtraction());

    await this.extract();
  }

  /** Returns the current cached text nodes. */
  getTextNodes(): TextNode[] {
    return this.nodes;
  }

  /** Returns the accumulated scroll offset since last extraction. */
  getScrollY(): number {
    return this.scrollY;
  }

  /** Update scroll offset when user scrolls. Schedules re-extraction for position accuracy. */
  updateScroll(deltaY: number): void {
    this.scrollY += deltaY;
    this.scheduleExtraction();
  }

  /** Force invalidation: clears scroll offset and re-extracts. */
  invalidate(): void {
    this.scrollY = 0;
    this.scheduleExtraction();
  }

  private scheduleExtraction(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.extract();
    }, INVALIDATION_DEBOUNCE_MS);
  }

  private async extract(): Promise<void> {
    if (!this.cdp || this.extracting) return;
    this.extracting = true;

    try {
      const nodes = await extractTextNodes(this.cdp);
      this.nodes = nodes;
      this.scrollY = 0;
    } finally {
      this.extracting = false;
    }
  }
}
