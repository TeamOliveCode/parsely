import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { ArticleExtractor } from './article-extractor';

describe('ArticleExtractor', () => {
  function createDocument(html: string): Document {
    const dom = new JSDOM(html, { url: 'https://example.com' });
    return dom.window.document;
  }

  describe('extract - basic functionality', () => {
    it('should extract article content from valid HTML', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test Article</title></head>
        <body>
          <article>
            <h1>Article Title</h1>
            <p>This is the first paragraph of the article content. It needs to be long enough for Readability to consider it valid content for extraction.</p>
            <p>This is the second paragraph with more content. Readability needs sufficient text to determine this is an article worth extracting.</p>
            <p>Here is a third paragraph to make the content even more substantial. The more content we have, the better Readability can identify the main article.</p>
          </article>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Article');
      expect(result?.textContent).toContain('first paragraph');
    });

    it('should return null for empty document', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Empty</title></head>
        <body></body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      expect(result).toBeNull();
    });

    it('should handle document with minimal content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Nav Only</title></head>
        <body>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      // Readability may or may not extract minimal content
      // We just verify it doesn't throw
      if (result) {
        expect(result.title).toBeDefined();
      }
    });
  });

  describe('extract - h1 preservation', () => {
    it('should preserve h1 tags in extracted content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <article>
            <h1>Main Heading</h1>
            <p>This is a comprehensive article with enough content for Readability to process. We need multiple paragraphs to ensure proper extraction.</p>
            <p>Second paragraph continues the article content with additional information that makes this a substantial piece of text.</p>
            <h1>Another Section</h1>
            <p>More content follows the second heading. This paragraph provides context for the new section of the article.</p>
          </article>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      expect(result).not.toBeNull();
      // The h1 tags should be preserved in the content
      if (result?.content) {
        expect(result.content).toContain('<h1>');
      }
    });
  });

  describe('extract - metadata extraction', () => {
    it('should extract article metadata', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Full Article Title</title>
          <meta property="og:site_name" content="Example Site">
          <meta name="author" content="John Doe">
          <meta name="description" content="This is the article excerpt.">
        </head>
        <body>
          <article>
            <p class="byline">By John Doe</p>
            <p>This is substantial article content that needs to be long enough for the Readability algorithm to properly parse and extract. Multiple sentences help ensure extraction success.</p>
            <p>Additional paragraph content continues here with more information about the topic being discussed in this article.</p>
            <p>A third paragraph adds even more content to make this a fully-formed article that Readability can confidently extract.</p>
          </article>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      expect(result).not.toBeNull();
      expect(result?.title).toBeTruthy();
    });

    it('should handle missing metadata gracefully', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Simple Article</title></head>
        <body>
          <article>
            <p>Just a simple article without much metadata. This content needs to be long enough for extraction to work properly.</p>
            <p>Second paragraph provides additional content for the Readability algorithm to process and extract successfully.</p>
          </article>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      expect(result).not.toBeNull();
      expect(result?.byline).toBeNull();
      expect(result?.siteName).toBeNull();
    });
  });

  describe('extract - edge cases', () => {
    it('should not modify the original document', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title></head>
        <body>
          <article>
            <h1>Original Heading</h1>
            <p>Original content that should remain unchanged in the source document. This is important for ensuring extraction doesn't have side effects.</p>
            <p>More original content to make this substantial enough for extraction.</p>
          </article>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const originalH1 = doc.querySelector('h1')?.textContent;

      ArticleExtractor.extract(doc);

      // Original document should be unchanged
      expect(doc.querySelector('h1')?.textContent).toBe(originalH1);
    });

    it('should handle documents with special characters', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Special &amp; Characters</title></head>
        <body>
          <article>
            <h1>Heading with "quotes" &amp; symbols</h1>
            <p>Content with special characters: &lt;tag&gt;, "quotes", 'apostrophes', and unicode: 你好世界. This needs to be long enough for extraction.</p>
            <p>More content with émojis 🎉 and other special characters that should be preserved during extraction.</p>
          </article>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      expect(result).not.toBeNull();
      if (result?.textContent) {
        expect(result.textContent).toContain('special characters');
      }
    });

    it('should handle deeply nested content', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Nested Content</title></head>
        <body>
          <div>
            <div>
              <div>
                <article>
                  <div>
                    <p>Deeply nested paragraph content that should still be extracted by Readability. The nesting depth should not affect extraction.</p>
                    <p>Another nested paragraph with additional content to ensure proper extraction of the article.</p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const doc = createDocument(html);
      const result = ArticleExtractor.extract(doc);

      expect(result).not.toBeNull();
      expect(result?.textContent).toContain('Deeply nested');
    });
  });
});
