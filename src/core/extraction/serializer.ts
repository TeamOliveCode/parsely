export class Serializer {
  // Minimum characters for a paragraph to be considered valid
  private static readonly MIN_PARAGRAPH_LENGTH = 20;
  // Target length for paragraphs (will try to merge short segments)
  private static readonly TARGET_PARAGRAPH_LENGTH = 150;
  // Maximum length before forcing a split
  private static readonly MAX_PARAGRAPH_LENGTH = 600;
  // Unique marker for paragraph breaks (using uncommon Unicode private use area)
  private static readonly PARA_MARKER = '\uE000\uE001\uE000';
  // Marker for headings that should never be merged
  private static readonly HEADING_MARKER = '\uE002';
  // Marker for unordered list items that should never be merged
  private static readonly LIST_ITEM_MARKER = '\uE003';
  // Marker for ordered list items (includes position number)
  private static readonly ORDERED_LIST_MARKER = '\uE004';
  // Marker for preserved anchor tags
  private static readonly LINK_START_MARKER = '\uE005';
  private static readonly LINK_END_MARKER = '\uE006';
  private static readonly LINK_HREF_SEPARATOR = '\uE007';

  public static serialize(html: string): string[] {
    if (!html) return [];

    // Preprocess HTML to normalize paragraph breaks and preserve links
    const normalizedHtml = this.preprocessHtml(html);

    const temp = document.createElement('div');
    temp.innerHTML = normalizedHtml;

    // Extract text while preserving link markers
    const text = this.extractTextWithLinks(temp);

    // Split by our paragraph markers and double newlines
    const rawBlocks = text
      .split(this.PARA_MARKER)
      .flatMap((segment) => segment.split(/\n\n+/))
      .map((s) => s.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((s) => s.length > 0);

    // Post-process: fix missing periods, merge short segments, split long ones
    const fixedBlocks = rawBlocks.map((block) => this.fixMissingPeriods(block));
    const normalized = this.normalizeParagraphs(fixedBlocks);

    // Convert link markers back to HTML
    return normalized.map((p) => this.restoreLinks(p));
  }

  /**
   * Extract text from element while preserving anchor tags as markers
   */
  private static extractTextWithLinks(element: HTMLElement): string {
    let result = '';

    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'a') {
          const href = el.getAttribute('href');
          if (href && this.isValidLinkHref(href)) {
            // Convert relative URLs to absolute
            const absoluteHref = this.makeAbsoluteUrl(href);
            result += `${this.LINK_START_MARKER}${absoluteHref}${this.LINK_HREF_SEPARATOR}`;
            el.childNodes.forEach((child) => processNode(child));
            result += this.LINK_END_MARKER;
          } else {
            // Invalid or empty href, just process children
            el.childNodes.forEach((child) => processNode(child));
          }
        } else if (tagName === 'br') {
          result += '\n';
        } else if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
          // Skip these elements
        } else {
          el.childNodes.forEach((child) => processNode(child));
        }
      }
    };

    element.childNodes.forEach((child) => processNode(child));
    return result;
  }

  /**
   * Check if a link href is valid and should be preserved
   */
  private static isValidLinkHref(href: string): boolean {
    if (!href || href.trim() === '') return false;
    // Skip javascript: and other non-http links
    const lower = href.toLowerCase().trim();
    if (lower.startsWith('javascript:')) return false;
    if (lower.startsWith('mailto:')) return true;
    if (lower.startsWith('tel:')) return true;
    if (lower.startsWith('http://') || lower.startsWith('https://')) return true;
    if (
      lower.startsWith('/') ||
      lower.startsWith('#') ||
      lower.startsWith('./') ||
      lower.startsWith('../')
    )
      return true;
    // Relative URLs without prefix
    if (!lower.includes(':')) return true;
    return false;
  }

  /**
   * Convert relative URL to absolute URL
   */
  private static makeAbsoluteUrl(href: string): string {
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      return href;
    }
    try {
      return new URL(href, window.location.href).href;
    } catch {
      return href;
    }
  }

  /**
   * Convert link markers back to HTML anchor tags
   */
  private static restoreLinks(text: string): string {
    // Pattern: LINK_START_MARKER + href + LINK_HREF_SEPARATOR + text + LINK_END_MARKER
    const pattern = new RegExp(
      `${this.LINK_START_MARKER}([^${this.LINK_HREF_SEPARATOR}]+)${this.LINK_HREF_SEPARATOR}([^${this.LINK_END_MARKER}]*)${this.LINK_END_MARKER}`,
      'g'
    );

    return text.replace(pattern, (_, href, linkText) => {
      // Escape HTML in href and linkText to prevent XSS
      const safeHref = this.escapeHtml(href);
      const safeLinkText = this.escapeHtml(linkText);
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLinkText}</a>`;
    });
  }

  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Fix missing periods where sentences appear concatenated.
   * Only adds periods where there's strong evidence of a missing sentence boundary.
   */
  private static fixMissingPeriods(text: string): string {
    // Common sentence-ending verbs (past tense) that strongly indicate a sentence boundary
    const endingVerbs = [
      'said',
      'wrote',
      'stated',
      'added',
      'explained',
      'noted',
      'asked',
      'replied',
      'answered',
      'continued',
      'concluded',
      'reported',
      'announced',
      'revealed',
      'claimed',
      'argued',
      'suggested',
      'insisted',
      'warned',
      'admitted',
      'confirmed',
      'denied',
      'agreed',
      'happened',
      'occurred',
      'appeared',
      'disappeared',
      'ended',
      'began',
      'started',
      'finished',
      'stopped',
      'died',
      'lived',
      'arrived',
      'left',
      'returned',
      'went',
      'came',
      'found',
      'lost',
      'won',
      'failed',
      'succeeded',
      'worked',
      'played',
      'thought',
      'believed',
      'knew',
      'understood',
      'realized',
      'decided',
      'chose',
      'tried',
      'wanted',
      'needed',
      'hoped',
      'expected',
      'feared',
      'loved',
      'hated',
      'liked',
      'enjoyed',
      'felt',
      'heard',
      'saw',
      'watched',
      'noticed',
      'discovered',
      'learned',
      'taught',
      'studied',
      'read',
      'spoke',
      'told',
      'showed',
      'gave',
      'took',
      'brought',
      'sent',
      'received',
      'paid',
      'sold',
      'bought',
      'built',
      'made',
      'created',
      'destroyed',
      'changed',
      'improved',
      'increased',
      'decreased',
      'grew',
      'fell',
      'rose',
      'dropped',
      'moved',
      'stayed',
      'remained',
      'became',
      'seemed',
      'looked',
      'sounded',
      'turned',
      'kept',
      'held',
      'carried',
      'opened',
      'closed',
      'broke',
      'fixed',
      'helped',
      'hurt',
      'saved',
      'killed',
      'survived',
      'escaped',
      'caught',
      'released',
      'attacked',
      'defended',
      'fought',
      'won',
      'lost',
      'tied',
      'passed',
      'reached',
      'achieved',
      'completed',
      'launched',
      'published',
      'released',
      'announced',
      'presented',
      'introduced',
      'developed',
      'designed',
      'produced',
      'performed',
      'acted',
      'sang',
      'danced',
      'painted',
      'wrote',
      'composed',
      'invented',
      'discovered',
      'explored',
      'investigated',
      'tested',
      'proved',
      'demonstrated',
      'showed',
      'revealed',
      'exposed',
      'uncovered',
      'identified',
      'recognized',
      'acknowledged',
      'accepted',
      'rejected',
      'refused',
      'approved',
      'denied',
      'confirmed',
      'verified',
      'validated',
      'certified',
      'permitted',
      'allowed',
      'authorized',
      'prohibited',
      'banned',
      'blocked',
      'supported',
      'opposed',
      'criticized',
      'praised',
      'thanked',
      'apologized',
      'promised',
      'guaranteed',
      'ensured',
      'protected',
      'defended',
      'attacked',
      'influenced',
      'affected',
      'impacted',
      'transformed',
      'converted',
      'evolved',
    ];

    // Build regex pattern from verb list
    const verbPattern = endingVerbs.join('|');
    const regex = new RegExp(`\\b(${verbPattern})\\s+([A-Z][a-z])`, 'g');

    // Add period after sentence-ending verbs followed by capital letter
    let result = text.replace(regex, '$1. $2');

    // Clean up any double periods we might have created
    result = result.replace(/\.{2,}/g, '.');

    // Clean up period before existing punctuation
    result = result.replace(/\.([.!?])/g, '$1');

    return result;
  }

  /**
   * Preprocess HTML to convert various paragraph patterns into consistent markers.
   * Handles: <br><br>, <p>, <div>, block elements, etc.
   */
  private static preprocessHtml(html: string): string {
    // First, process ordered lists using DOM to get correct numbering
    const temp = document.createElement('div');
    temp.innerHTML = html;
    this.processOrderedLists(temp);
    let processed = temp.innerHTML;

    // Convert multiple <br> tags (with optional whitespace) to paragraph markers
    // Matches: <br><br>, <br/><br/>, <br> <br>, <br>\n<br>, etc.
    processed = processed.replace(/(<br\s*\/?>\s*){2,}/gi, this.PARA_MARKER);

    // Convert single <br> followed by blank line pattern
    processed = processed.replace(/<br\s*\/?>\s*\n\s*\n/gi, this.PARA_MARKER);

    // Add paragraph markers before and after block elements
    const blockTags = [
      'p',
      'div',
      'blockquote',
      'ul',
      'ol',
      'article',
      'section',
      'header',
      'footer',
      'aside',
      'figure',
      'figcaption',
      'pre',
      'address',
      'dt',
      'dd',
      'table',
      'tr',
    ];

    // Heading tags - mark content so it won't be merged
    const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

    for (const tag of headingTags) {
      // Add heading marker after opening tag
      processed = processed.replace(
        new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi'),
        `${this.PARA_MARKER}<${tag}$1>${this.HEADING_MARKER}`
      );
      // Add heading marker before closing tag
      processed = processed.replace(
        new RegExp(`</${tag}>`, 'gi'),
        `${this.HEADING_MARKER}</${tag}>${this.PARA_MARKER}`
      );
    }

    for (const tag of blockTags) {
      // Add marker before opening tag
      processed = processed.replace(
        new RegExp(`<${tag}(\\s|>)`, 'gi'),
        `${this.PARA_MARKER}<${tag}$1`
      );
      // Add marker after closing tag
      processed = processed.replace(new RegExp(`</${tag}>`, 'gi'), `</${tag}>${this.PARA_MARKER}`);
    }

    // Handle self-closing/void elements that indicate breaks
    processed = processed.replace(/<hr\s*\/?>/gi, this.PARA_MARKER);

    return processed;
  }

  /**
   * Process ordered lists in DOM to add proper numbering markers
   */
  private static processOrderedLists(container: HTMLElement): void {
    // Process all ordered lists
    const orderedLists = container.querySelectorAll('ol');
    orderedLists.forEach((ol) => {
      const startAttr = ol.getAttribute('start');
      let start = startAttr ? parseInt(startAttr, 10) : 1;
      if (isNaN(start)) start = 1;

      const listItems = ol.querySelectorAll(':scope > li');
      listItems.forEach((li, index) => {
        const num = start + index;
        // Prepend marker with number to the list item content
        const marker = document.createTextNode(
          `${this.PARA_MARKER}${this.ORDERED_LIST_MARKER}${num}${this.ORDERED_LIST_MARKER}`
        );
        li.insertBefore(marker, li.firstChild);
        // Add closing marker
        const endMarker = document.createTextNode(`${this.ORDERED_LIST_MARKER}${this.PARA_MARKER}`);
        li.appendChild(endMarker);
      });
    });

    // Process unordered lists
    const unorderedLists = container.querySelectorAll('ul');
    unorderedLists.forEach((ul) => {
      const listItems = ul.querySelectorAll(':scope > li');
      listItems.forEach((li) => {
        // Prepend marker for unordered list item
        const marker = document.createTextNode(`${this.PARA_MARKER}${this.LIST_ITEM_MARKER}`);
        li.insertBefore(marker, li.firstChild);
        // Add closing marker
        const endMarker = document.createTextNode(`${this.LIST_ITEM_MARKER}${this.PARA_MARKER}`);
        li.appendChild(endMarker);
      });
    });
  }

  /**
   * Check if paragraph contains heading marker (should never be merged)
   */
  private static isHeading(text: string): boolean {
    return text.includes(this.HEADING_MARKER);
  }

  /**
   * Remove heading markers from text
   */
  private static cleanHeadingMarkers(text: string): string {
    return text.replace(new RegExp(this.HEADING_MARKER, 'g'), '').trim();
  }

  /**
   * Check if paragraph contains unordered list item marker (should never be merged)
   * Must start with the marker to be considered a list item
   */
  private static isUnorderedListItem(text: string): boolean {
    return text.startsWith(this.LIST_ITEM_MARKER);
  }

  /**
   * Check if paragraph contains ordered list item marker (should never be merged)
   * Must start with the marker pattern to be considered a list item
   */
  private static isOrderedListItem(text: string): boolean {
    // Only consider it an ordered list item if it starts with the proper marker pattern
    const pattern = new RegExp(`^${this.ORDERED_LIST_MARKER}\\d+${this.ORDERED_LIST_MARKER}`);
    return pattern.test(text);
  }

  /**
   * Remove list item markers from text
   */
  private static cleanListItemMarkers(text: string): string {
    // Remove leading marker
    let cleaned = text;
    if (cleaned.startsWith(this.LIST_ITEM_MARKER)) {
      cleaned = cleaned.slice(this.LIST_ITEM_MARKER.length);
    }
    // Remove trailing marker
    if (cleaned.endsWith(this.LIST_ITEM_MARKER)) {
      cleaned = cleaned.slice(0, -this.LIST_ITEM_MARKER.length);
    }
    // Remove any remaining markers (shouldn't happen, but be safe)
    cleaned = cleaned.replace(new RegExp(this.LIST_ITEM_MARKER, 'g'), '');
    return cleaned.trim();
  }

  /**
   * Extract number and clean ordered list item markers from text
   * Returns [number, cleanedText]
   */
  private static cleanOrderedListMarkers(text: string): [number, string] {
    // Pattern: ORDERED_LIST_MARKER + number + ORDERED_LIST_MARKER at start
    const startPattern = new RegExp(
      `^${this.ORDERED_LIST_MARKER}(\\d+)${this.ORDERED_LIST_MARKER}`
    );
    const match = startPattern.exec(text);
    const num = match ? parseInt(match[1], 10) : 1;

    // Remove the start marker pattern and any trailing markers
    let cleaned = text;
    if (match) {
      cleaned = cleaned.slice(match[0].length);
    }
    // Remove trailing marker (ORDERED_LIST_MARKER at end)
    cleaned = cleaned.replace(new RegExp(`${this.ORDERED_LIST_MARKER}$`), '');
    // Remove any remaining standalone markers (shouldn't happen, but be safe)
    cleaned = cleaned.replace(new RegExp(this.ORDERED_LIST_MARKER, 'g'), '');

    return [num, cleaned.trim()];
  }

  /**
   * Normalize paragraphs: merge short ones, split long ones
   */
  private static normalizeParagraphs(paragraphs: string[]): string[] {
    const result: string[] = [];
    let buffer = '';

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];

      // Headings should never be merged - flush buffer and add heading separately
      if (this.isHeading(para)) {
        // Flush any existing buffer first
        if (buffer.trim()) {
          result.push(buffer);
          buffer = '';
        }
        // Add heading as its own paragraph
        result.push(this.cleanHeadingMarkers(para));
        continue;
      }

      // Ordered list items should never be merged - flush buffer and add with number
      if (this.isOrderedListItem(para)) {
        // Flush any existing buffer first
        if (buffer.trim()) {
          result.push(buffer);
          buffer = '';
        }
        // Add list item as its own paragraph (prefix with number)
        const [num, cleanedItem] = this.cleanOrderedListMarkers(para);
        if (cleanedItem) {
          result.push(`${num}. ${cleanedItem}`);
        }
        continue;
      }

      // Unordered list items should never be merged - flush buffer and add with bullet
      if (this.isUnorderedListItem(para)) {
        // Flush any existing buffer first
        if (buffer.trim()) {
          result.push(buffer);
          buffer = '';
        }
        // Add list item as its own paragraph (prefix with bullet)
        const cleanedItem = this.cleanListItemMarkers(para);
        if (cleanedItem) {
          result.push('• ' + cleanedItem);
        }
        continue;
      }

      // Skip very short fragments that look like headers or labels
      if (para.length < this.MIN_PARAGRAPH_LENGTH && !this.looksLikeCompleteSentence(para)) {
        // Try to merge with next paragraph if it exists
        if (buffer) {
          buffer += ' ' + para;
        } else {
          buffer = para;
        }
        continue;
      }

      // If we have a buffer, decide whether to merge or flush
      if (buffer) {
        const combined = buffer + ' ' + para;
        if (combined.length <= this.TARGET_PARAGRAPH_LENGTH) {
          // Merge short segments
          buffer = combined;
        } else {
          // Flush buffer, start new one with current para
          if (
            buffer.length >= this.MIN_PARAGRAPH_LENGTH ||
            this.looksLikeCompleteSentence(buffer)
          ) {
            result.push(buffer);
          }
          buffer = para;
        }
      } else {
        buffer = para;
      }

      // Check if buffer is complete (ends with punctuation, is long enough, etc.)
      if (this.isCompleteParagraph(buffer)) {
        // Handle very long paragraphs by splitting at sentence boundaries
        if (buffer.length > this.MAX_PARAGRAPH_LENGTH) {
          result.push(...this.splitLongParagraph(buffer));
        } else {
          result.push(buffer);
        }
        buffer = '';
      }
    }

    // Don't forget remaining buffer
    if (buffer.trim()) {
      if (buffer.length > this.MAX_PARAGRAPH_LENGTH) {
        result.push(...this.splitLongParagraph(buffer));
      } else {
        result.push(buffer);
      }
    }

    return result.filter((p) => p.length > 0);
  }

  /**
   * Check if text looks like a complete sentence/thought
   */
  private static looksLikeCompleteSentence(text: string): boolean {
    // Ends with terminal punctuation (including Korean/CJK punctuation)
    if (/[.!?:。！？]["'"»)]?\s*$/.test(text)) return true;

    // Is a heading (short text starting with capital or number)
    if (text.length < 80 && /^[A-Z0-9]/.test(text)) return true;

    // Is a list item or numbered point
    if (/^[\d•\-*]\s*[.)]\s*/.test(text)) return true;

    // Korean/CJK text that's reasonably long is likely complete
    // (Korean sentences often don't end with periods in informal writing)
    if (text.length >= 30 && /[\u3131-\u318E\uAC00-\uD7A3\u4E00-\u9FFF]/.test(text)) return true;

    return false;
  }

  /**
   * Check if buffer is ready to be flushed as a complete paragraph
   */
  private static isCompleteParagraph(text: string): boolean {
    // Long enough and ends with punctuation (including CJK)
    if (text.length >= this.MIN_PARAGRAPH_LENGTH && /[.!?。！？]["'"»)]?\s*$/.test(text)) {
      return true;
    }

    // Korean/CJK text that's reasonably long - flush without requiring punctuation
    if (
      text.length >= this.MIN_PARAGRAPH_LENGTH &&
      /[\u3131-\u318E\uAC00-\uD7A3\u4E00-\u9FFF]/.test(text)
    ) {
      return true;
    }

    // Very long - flush anyway
    if (text.length >= this.TARGET_PARAGRAPH_LENGTH * 2) {
      return true;
    }

    return false;
  }

  /**
   * Split a long paragraph at sentence boundaries
   */
  private static splitLongParagraph(text: string): string[] {
    const result: string[] = [];

    // Split at sentence boundaries (. ! ?) followed by optional closing quotes/parens,
    // optional citation markers like [24], and then space and capital letter.
    // This handles Wikipedia-style citations: "word.[24] Next" or "word.[24][27] Next"
    const sentencePattern = /([.!?]["'"»)\]]?)(\s*\[\d+\])*\s+(?=[A-Z])/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentencePattern.exec(text)) !== null) {
      // Include the punctuation and any citation markers in the sentence
      const fullMatch = match[0];
      const endPunctAndCitations = fullMatch.trimEnd();
      const sentence = text.slice(lastIndex, match.index + endPunctAndCitations.length);
      if (sentence.trim()) {
        sentences.push(sentence.trim());
      }
      lastIndex = match.index + match[0].length;
    }

    // Don't forget the last part
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      sentences.push(remaining);
    }

    // If no sentence boundaries found, try semicolon splitting for very long paragraphs
    if (sentences.length <= 1 && text.length > this.MAX_PARAGRAPH_LENGTH) {
      return this.splitAtSemicolons(text);
    }

    // If still no splits possible, return as-is
    if (sentences.length <= 1) {
      return [text];
    }

    // Group sentences into paragraphs of reasonable length
    let buffer = '';
    for (const sentence of sentences) {
      if (buffer) {
        const combined = buffer + ' ' + sentence;
        if (combined.length <= this.MAX_PARAGRAPH_LENGTH) {
          buffer = combined;
        } else {
          result.push(buffer);
          buffer = sentence;
        }
      } else {
        buffer = sentence;
      }
    }

    if (buffer) {
      result.push(buffer);
    }

    return result;
  }

  /**
   * Split text at semicolons as a fallback for paragraphs without clear sentence boundaries
   */
  private static splitAtSemicolons(text: string): string[] {
    const parts = text.split(/;\s+/);
    if (parts.length <= 1) {
      return [text];
    }

    const result: string[] = [];
    let buffer = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] + (i < parts.length - 1 ? ';' : '');
      if (buffer) {
        const combined = buffer + ' ' + part;
        if (combined.length <= this.MAX_PARAGRAPH_LENGTH) {
          buffer = combined;
        } else {
          result.push(buffer);
          buffer = part;
        }
      } else {
        buffer = part;
      }
    }

    if (buffer) {
      result.push(buffer);
    }

    return result;
  }
}
