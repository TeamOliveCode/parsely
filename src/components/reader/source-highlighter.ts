/**
 * Highlights the current sentence/paragraph on the source page
 * so users can see where they are in the original article.
 *
 * When a sentence is part of a longer DOM paragraph, we highlight
 * just that sentence using text range detection.
 */
export class SourceHighlighter {
  private highlightOverlay: HTMLElement | null = null;
  private paragraphMappings: Array<{
    element: HTMLElement | null;
    textRange: { start: number; end: number } | null; // Character positions within element
  }> = [];
  private currentIndex: number = -1;

  constructor() {
    this.createHighlightOverlay();
  }

  /**
   * Get text content from an element.
   * Uses innerText when available (browser), falls back to textContent (jsdom).
   */
  private getElementText(el: HTMLElement): string {
    return el.innerText ?? el.textContent ?? '';
  }

  private createHighlightOverlay(): void {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'reader-source-highlight';
    Object.assign(this.highlightOverlay.style, {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '2147483646',
      background: 'rgba(0, 255, 159, 0.15)',
      border: '2px solid rgba(0, 255, 159, 0.6)',
      borderRadius: '6px',
      transition: 'all 0.25s ease-out',
      opacity: '0',
      boxShadow: '0 0 30px rgba(0, 255, 159, 0.3), inset 0 0 20px rgba(0, 255, 159, 0.1)',
    });
  }

  /**
   * Maps serialized paragraphs to DOM elements using sequential matching.
   * For sentences within long paragraphs, also tracks the text range.
   */
  public mapParagraphs(serializedParagraphs: string[]): void {
    this.paragraphMappings = [];
    const allTextElements = this.getTextElementsInOrder();

    if (allTextElements.length === 0 || serializedParagraphs.length === 0) {
      return;
    }

    // Precompute normalized text for all elements
    const elementTexts: Array<{ el: HTMLElement; text: string; consumed: number }> = [];
    for (const el of allTextElements) {
      elementTexts.push({
        el,
        text: this.normalizeText(this.getElementText(el)),
        consumed: 0,
      });
    }

    let currentElIdx = 0;

    for (let i = 0; i < serializedParagraphs.length; i++) {
      const paraText = this.normalizeText(serializedParagraphs[i]);

      if (paraText.length < 5) {
        this.paragraphMappings.push({ element: null, textRange: null });
        continue;
      }

      let matched = false;

      // Try to match starting from current element position (sequential)
      for (
        let lookAhead = 0;
        lookAhead < 5 && currentElIdx + lookAhead < elementTexts.length;
        lookAhead++
      ) {
        const elIdx = currentElIdx + lookAhead;
        const { el, text: elText, consumed } = elementTexts[elIdx];

        const matchResult = this.findTextInElement(paraText, elText, consumed);

        if (matchResult.found) {
          this.paragraphMappings.push({
            element: el,
            textRange: matchResult.isSentenceInParagraph
              ? { start: matchResult.position, end: matchResult.position + paraText.length }
              : null,
          });
          matched = true;

          if (matchResult.isSentenceInParagraph) {
            elementTexts[elIdx].consumed = matchResult.position + paraText.length;
          } else {
            currentElIdx = elIdx + 1;
          }
          break;
        }
      }

      // Fallback: search anywhere ahead
      if (!matched) {
        for (let j = currentElIdx; j < elementTexts.length; j++) {
          const { el, text: elText } = elementTexts[j];
          const matchResult = this.findTextInElement(paraText, elText, 0);

          if (matchResult.found) {
            this.paragraphMappings.push({
              element: el,
              textRange: matchResult.isSentenceInParagraph
                ? { start: matchResult.position, end: matchResult.position + paraText.length }
                : null,
            });
            matched = true;

            if (matchResult.isSentenceInParagraph) {
              elementTexts[j].consumed = matchResult.position + paraText.length;
              currentElIdx = j;
            } else {
              currentElIdx = j + 1;
            }
            break;
          }
        }
      }

      if (!matched) {
        this.paragraphMappings.push({ element: null, textRange: null });
      }
    }
  }

  /**
   * Find paragraph text within element text.
   * Returns position and whether it's a sentence within a larger paragraph.
   */
  private findTextInElement(
    paraText: string,
    elText: string,
    startFrom: number
  ): { found: boolean; position: number; isSentenceInParagraph: boolean } {
    const searchText = elText.slice(startFrom);

    if (searchText.length < 5) {
      return { found: false, position: -1, isSentenceInParagraph: false };
    }

    // Check if paragraph matches at start of remaining text
    const matchScore = this.characterMatch(paraText, searchText);
    if (matchScore >= 0.8) {
      const isSentence = elText.length > paraText.length * 1.5;
      return { found: true, position: startFrom, isSentenceInParagraph: isSentence };
    }

    // Search for paragraph as substring within element
    const position = this.findSubstring(paraText, searchText);
    if (position >= 0) {
      return { found: true, position: startFrom + position, isSentenceInParagraph: true };
    }

    return { found: false, position: -1, isSentenceInParagraph: false };
  }

  /**
   * Character-by-character matching score (first 50 chars).
   */
  private characterMatch(str1: string, str2: string): number {
    const len = Math.min(50, str1.length, str2.length);
    if (len < 5) return 0;

    let matches = 0;
    for (let i = 0; i < len; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    return matches / len;
  }

  /**
   * Find substring position using first 40 characters.
   */
  private findSubstring(needle: string, haystack: string): number {
    const searchLen = Math.min(40, needle.length);
    if (searchLen < 10) return -1;

    const searchStr = needle.slice(0, searchLen);
    return haystack.indexOf(searchStr);
  }

  private getTextElementsInOrder(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const validTags = new Set([
      'P',
      'LI',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'BLOCKQUOTE',
      'FIGCAPTION',
      'PRE',
      'TD',
      'TH',
      'DIV',
    ]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        const el = node as HTMLElement;
        if (!validTags.has(el.tagName)) return NodeFilter.FILTER_SKIP;
        const text = this.getElementText(el).trim();
        if (!text || text.length < 5) return NodeFilter.FILTER_SKIP;
        const blockChildren = el.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6');
        if (blockChildren.length > 2) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      elements.push(node as HTMLElement);
    }
    return elements;
  }

  private normalizeText(text: string): string {
    // Strip HTML tags first (serialized paragraphs may contain anchor tags)
    const withoutTags = text.replace(/<[^>]*>/g, '');
    // Remove bullet points, list markers at start
    const withoutMarkers = withoutTags.replace(/^[•\-*\d]+[.):]?\s*/, '');
    return withoutMarkers.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Highlight the sentence/paragraph at the given index.
   * If it's a sentence within a larger paragraph, highlights just that text range.
   */
  public highlight(index: number): void {
    if (!this.highlightOverlay) return;
    this.currentIndex = index;

    const mapping = this.paragraphMappings[index];
    if (!mapping || !mapping.element) {
      this.highlightOverlay.style.opacity = '0';
      return;
    }

    const { element, textRange } = mapping;
    let rect: DOMRect;

    if (textRange) {
      // Highlight specific text range within the element
      const rangeRect = this.getTextRangeRect(element, textRange.start, textRange.end);
      if (rangeRect) {
        rect = rangeRect;
      } else {
        // Fallback to whole element
        rect = element.getBoundingClientRect();
      }
    } else {
      // Highlight whole element
      rect = element.getBoundingClientRect();
    }

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const padding = 8;

    Object.assign(this.highlightOverlay.style, {
      top: `${rect.top + scrollY - padding}px`,
      left: `${rect.left + scrollX - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`,
      opacity: '1',
    });

    // Scroll to the highlighted text, not just the element
    // Calculate the center of the highlighted area and scroll to it
    this.scrollToRect(rect);
  }

  /**
   * Scroll the viewport so the given rect is centered vertically.
   */
  private scrollToRect(rect: DOMRect): void {
    const viewportHeight = window.innerHeight;
    const rectCenterY = rect.top + rect.height / 2;
    const targetScrollY = window.scrollY + rectCenterY - viewportHeight / 2;

    window.scrollTo({
      top: Math.max(0, targetScrollY),
      behavior: 'smooth',
    });
  }

  /**
   * Get the bounding rect for a text range within an element.
   * Uses Range API to find the exact position of the text.
   */
  private getTextRangeRect(
    element: HTMLElement,
    startOffset: number,
    endOffset: number
  ): DOMRect | null {
    try {
      const text = this.getElementText(element).toLowerCase().replace(/\s+/g, ' ').trim();
      const normalizedStart = startOffset;
      const normalizedEnd = Math.min(endOffset, text.length);

      // Find the text node(s) containing our range
      const range = document.createRange();
      let currentOffset = 0;
      let startNode: Node | null = null;
      let endNode: Node | null = null;
      let startNodeOffset = 0;
      let endNodeOffset = 0;

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;

      while ((node = walker.nextNode())) {
        const nodeText = (node.textContent || '').toLowerCase().replace(/\s+/g, ' ');
        const nodeLen = nodeText.length;

        if (!startNode && currentOffset + nodeLen > normalizedStart) {
          startNode = node;
          startNodeOffset = normalizedStart - currentOffset;
        }

        if (currentOffset + nodeLen >= normalizedEnd) {
          endNode = node;
          endNodeOffset = normalizedEnd - currentOffset;
          break;
        }

        currentOffset += nodeLen;
      }

      if (startNode && endNode) {
        // Clamp offsets to actual node lengths
        const startTextLen = startNode.textContent?.length || 0;
        const endTextLen = endNode.textContent?.length || 0;
        startNodeOffset = Math.min(startNodeOffset, startTextLen);
        endNodeOffset = Math.min(endNodeOffset, endTextLen);

        range.setStart(startNode, startNodeOffset);
        range.setEnd(endNode, endNodeOffset);
        return range.getBoundingClientRect();
      }
    } catch {
      // Fallback to null if range API fails
    }

    return null;
  }

  public hide(): void {
    if (this.highlightOverlay) this.highlightOverlay.style.opacity = '0';
  }

  public mount(): void {
    if (this.highlightOverlay && !document.body.contains(this.highlightOverlay)) {
      document.body.appendChild(this.highlightOverlay);
    }
  }

  public unmount(): void {
    if (this.highlightOverlay && document.body.contains(this.highlightOverlay)) {
      document.body.removeChild(this.highlightOverlay);
    }
    this.paragraphMappings = [];
    this.currentIndex = -1;
  }

  public updatePosition(): void {
    if (this.currentIndex >= 0) this.highlight(this.currentIndex);
  }

  /**
   * Find the paragraph index that contains the given selected text.
   * Returns the index of the paragraph containing the selection,
   * or null if not found.
   */
  public findParagraphBySelection(selectedText: string): number | null {
    if (this.paragraphMappings.length === 0 || !selectedText) {
      return null;
    }

    const normalizedSelection = this.normalizeText(selectedText);
    if (normalizedSelection.length < 3) {
      return null;
    }

    // Search through paragraphs to find one containing the selected text
    for (let i = 0; i < this.paragraphMappings.length; i++) {
      const mapping = this.paragraphMappings[i];
      if (!mapping || !mapping.element) continue;

      const elementText = this.normalizeText(this.getElementText(mapping.element));
      if (elementText.includes(normalizedSelection)) {
        return i;
      }
    }

    return null;
  }
}
