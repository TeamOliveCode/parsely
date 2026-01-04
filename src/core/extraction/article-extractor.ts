import { Readability } from '@mozilla/readability';
import type { ExtractedArticle } from '../../types';

export class ArticleExtractor {
  // Marker to preserve h1 tags through Readability processing
  private static readonly H1_MARKER_START = '\uE010H1START\uE010';
  private static readonly H1_MARKER_END = '\uE010H1END\uE010';

  public static extract(doc: Document): ExtractedArticle | null {
    // Clone the document to avoid side-effects on the original page
    const docClone = doc.cloneNode(true) as Document;

    // Preserve h1 tags by converting them to marked divs before Readability
    this.preserveH1Tags(docClone);

    const reader = new Readability(docClone);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length === 0) {
      return null;
    }

    // Restore h1 tags from markers
    const content = this.restoreH1Tags(article.content || '');

    return {
      title: article.title || '',
      content,
      textContent: article.textContent || '',
      byline: article.byline || null,
      excerpt: article.excerpt || null,
      siteName: article.siteName || null,
    };
  }

  /**
   * Convert h1 tags to divs with markers before Readability processes them.
   * This prevents Readability from removing or demoting h1 tags.
   */
  private static preserveH1Tags(doc: Document): void {
    const h1Elements = doc.querySelectorAll('h1');
    h1Elements.forEach((h1) => {
      // Create a div with special markers
      const div = doc.createElement('div');
      div.innerHTML = `${this.H1_MARKER_START}${h1.innerHTML}${this.H1_MARKER_END}`;
      h1.parentNode?.replaceChild(div, h1);
    });
  }

  /**
   * Restore h1 tags from markers after Readability processing.
   */
  private static restoreH1Tags(html: string): string {
    // Convert markers back to h1 tags
    let restored = html;

    // Pattern: MARKER_START...content...MARKER_END -> <h1>content</h1>
    const pattern = new RegExp(
      `${this.escapeRegex(this.H1_MARKER_START)}([\\s\\S]*?)${this.escapeRegex(this.H1_MARKER_END)}`,
      'g'
    );

    restored = restored.replace(pattern, '<h1>$1</h1>');

    return restored;
  }

  /**
   * Escape special regex characters in a string.
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
