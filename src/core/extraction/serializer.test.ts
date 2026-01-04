import { describe, it, expect } from 'vitest';
import { Serializer } from './serializer';

describe('Serializer', () => {
  describe('Basic Serialization', () => {
    it('should return empty array for empty input', () => {
      expect(Serializer.serialize('')).toEqual([]);
    });

    it('should return empty array for null/undefined-like input', () => {
      expect(Serializer.serialize('')).toEqual([]);
    });

    it('should extract simple paragraph text', () => {
      const html = '<p>This is a simple paragraph with enough content to be valid.</p>';
      const result = Serializer.serialize(html);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('This is a simple paragraph with enough content to be valid.');
    });

    it('should handle multiple paragraphs', () => {
      const html = `
        <p>First paragraph with sufficient content to be valid on its own.</p>
        <p>Second paragraph with sufficient content to be valid on its own.</p>
        <p>Third paragraph with sufficient content to be valid on its own.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('First paragraph');
      expect(result.join(' ')).toContain('Second paragraph');
      expect(result.join(' ')).toContain('Third paragraph');
    });
  });

  describe('HTML Element Handling', () => {
    it('should handle headings as separate paragraphs', () => {
      const html = `
        <h1>Main Title of the Article</h1>
        <p>This is the content following the heading with enough text.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toBe('Main Title of the Article');
    });

    it('should handle h2 through h6 headings', () => {
      const html = `
        <h2>Section Two Heading</h2>
        <p>Content after h2 with enough text to be valid.</p>
        <h3>Section Three Heading</h3>
        <p>Content after h3 with enough text to be valid.</p>
        <h4>Section Four Heading</h4>
        <p>Content after h4 with enough text to be valid.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result).toContain('Section Two Heading');
      expect(result).toContain('Section Three Heading');
      expect(result).toContain('Section Four Heading');
    });

    it('should handle unordered lists with bullet points', () => {
      const html = `
        <ul>
          <li>First list item with enough content here</li>
          <li>Second list item with enough content here</li>
          <li>Third list item with enough content here</li>
        </ul>
      `;
      const result = Serializer.serialize(html);
      expect(result.some((p) => p.startsWith('•'))).toBe(true);
      expect(result.some((p) => p.includes('First list item'))).toBe(true);
    });

    it('should handle ordered lists with numbers', () => {
      const html = `
        <ol>
          <li>First ordered item with content here</li>
          <li>Second ordered item with content here</li>
          <li>Third ordered item with content here</li>
        </ol>
      `;
      const result = Serializer.serialize(html);
      expect(result.some((p) => p.startsWith('1.'))).toBe(true);
      expect(result.some((p) => p.startsWith('2.'))).toBe(true);
      expect(result.some((p) => p.startsWith('3.'))).toBe(true);
    });

    it('should handle ordered lists with custom start attribute', () => {
      const html = `
        <ol start="5">
          <li>Fifth item content with enough text</li>
          <li>Sixth item content with enough text</li>
        </ol>
      `;
      const result = Serializer.serialize(html);
      expect(result.some((p) => p.startsWith('5.'))).toBe(true);
      expect(result.some((p) => p.startsWith('6.'))).toBe(true);
    });

    it('should handle blockquotes', () => {
      const html = `
        <blockquote>
          This is a quoted text that should be extracted properly as a separate block.
        </blockquote>
      `;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('quoted text');
    });

    it('should handle nested elements', () => {
      const html = `
        <div>
          <p>Outer paragraph with <strong>bold text</strong> and <em>italic text</em> inside.</p>
        </div>
      `;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('bold text');
      expect(result.join(' ')).toContain('italic text');
    });

    it('should handle links within text', () => {
      const html = `
        <p>This paragraph contains a <a href="https://example.com">link to another page</a> in the middle of the text.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('link to another page');
    });

    it('should handle br tags', () => {
      const html = `
        <p>First line of text.<br><br>Second line after breaks.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle pre/code blocks', () => {
      const html = `
        <pre><code>function hello() {
          console.log("Hello, World!");
        }</code></pre>
      `;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle figure and figcaption', () => {
      const html = `
        <figure>
          <img src="image.jpg" alt="Test image">
          <figcaption>This is the caption for the image above with enough text.</figcaption>
        </figure>
      `;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('caption for the image');
    });
  });

  describe('Paragraph Length Normalization', () => {
    it('should merge very short paragraphs', () => {
      const html = `
        <p>Short.</p>
        <p>Also short.</p>
        <p>Another short paragraph that when combined makes sense.</p>
      `;
      const result = Serializer.serialize(html);
      // Short paragraphs should be merged
      expect(result.length).toBeLessThan(3);
    });

    it('should split very long paragraphs', () => {
      const longParagraph = `
        <p>
          This is the beginning of a very long paragraph. It contains multiple sentences that go on and on.
          The reader would find it difficult to read such a long block of text. Therefore, the serializer
          should split this into smaller, more manageable chunks. Each chunk should be of reasonable length.
          We want to ensure that users can read one thought at a time. This improves comprehension and focus.
          The algorithm should find natural sentence boundaries. It should split at periods followed by spaces.
          This way, the reading experience is much better. Users can focus on one idea at a time.
          Long paragraphs are common in academic writing. But they make focused reading very difficult.
          Our extension aims to solve this problem. It breaks content into digestible pieces.
          This is especially helpful for people with attention difficulties. They can read one sentence at a time.
          The final result should be multiple paragraphs. Each paragraph should be comfortable to read.
        </p>
      `;
      const result = Serializer.serialize(longParagraph);
      // Very long paragraphs should be split
      result.forEach((para) => {
        expect(para.length).toBeLessThanOrEqual(700); // Allow some buffer over MAX_PARAGRAPH_LENGTH
      });
    });

    it('should keep medium-length paragraphs intact', () => {
      const html = `
        <p>This is a medium-length paragraph that contains enough content to be meaningful but not so much that it becomes overwhelming to read in a single view.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result).toHaveLength(1);
    });
  });

  describe('Sentence Boundary Detection', () => {
    it('should split long paragraphs with Wikipedia-style citations', () => {
      // This is a real paragraph from Wikipedia with multiple citations
      const html = `
        <p>Melaka is initially characterized as a street smart and rebellious criminal,[24][27] but this behavior is shown throughout Fray to be her way of protecting herself in the bleakness of her world.[27] She uses crime as a way to survive and accepts her life as hard but ordinary.[36][37] Over the course of her series, Melaka is portrayed as kind, compassionate, willing to help others, and protective of her community;[38] these characteristics are presented as unusual in her world and something that makes her stand apart.[28] Moreover, Season Eight depicts Melaka as focused on saving individuals, in opposition to Buffy who is more concerned about bigger picture issues.[39] While Melaka is shown as confident in her abilities, she has feelings of self-hatred and guilt over her past actions regarding Harth.[40] Whedon described Melaka as "hard, defensive, vulnerable, goofy, and yes, wicked sexy" and identified her as a "cool girl hero".[7] He said that he enjoyed writing female characters like Melaka, who he called "hard-edged but heroic", because he was drawn to "the people nobody takes seriously, having been one the greater part of my life".[24]</p>
      `;
      const result = Serializer.serialize(html);
      // Should be split into multiple paragraphs since it's very long
      expect(result.length).toBeGreaterThan(1);
      // Each paragraph should be reasonable length
      result.forEach((para) => {
        expect(para.length).toBeLessThanOrEqual(700);
      });
    });

    it('should fix missing periods between sentences', () => {
      const html = `<p>The president said The new policy will help everyone.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('said.');
    });

    it('should handle various sentence-ending verbs', () => {
      const testCases = [
        { html: '<p>She explained The process takes time.</p>', verb: 'explained' },
        { html: '<p>He admitted The mistake was his.</p>', verb: 'admitted' },
        { html: '<p>They announced The event is cancelled.</p>', verb: 'announced' },
      ];

      testCases.forEach(({ html, verb }) => {
        const result = Serializer.serialize(html);
        expect(result.join(' ')).toContain(`${verb}.`);
      });
    });

    it('should not add periods incorrectly', () => {
      const html = `<p>The ball rolled down the hill quickly.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).not.toContain('..');
    });
  });

  describe('Language Support', () => {
    it('should handle Korean text', () => {
      const html = `<p>안녕하세요. 이것은 한국어 텍스트입니다. 파슬리 익스텐션이 한글을 제대로 처리할 수 있는지 확인합니다.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('안녕하세요');
    });

    it('should handle Chinese text', () => {
      const html = `<p>你好世界。这是一个测试中文文本的段落。我们需要确保中文内容能够正确处理。</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('你好');
    });

    it('should handle Japanese text', () => {
      const html = `<p>こんにちは世界。これは日本語テキストのテストです。日本語が正しく処理されることを確認します。</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('こんにちは');
    });

    it('should handle mixed language content', () => {
      const html = `
        <p>This paragraph contains English and 한국어 mixed together. It should handle both properly.</p>
        <p>Another paragraph with 中文 and 日本語 as well as English text mixed in the content.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('English');
      expect(result.join(' ')).toContain('한국어');
    });

    it('should handle Korean without requiring terminal punctuation', () => {
      const html = `<p>이것은 마침표 없이 끝나는 한국어 텍스트입니다</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Punctuation Handling', () => {
    it('should recognize various sentence-ending punctuation', () => {
      const html = `
        <p>This ends with a period.</p>
        <p>This ends with an exclamation!</p>
        <p>This ends with a question?</p>
        <p>This ends with a colon:</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle CJK punctuation', () => {
      const html = `
        <p>这个句子用中文句号结束。</p>
        <p>这个句子用中文叹号结束！</p>
        <p>这个句子用中文问号结束？</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle quotation marks after punctuation', () => {
      const html = `<p>She said, "Hello world." The response was positive.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('Hello world');
    });
  });

  describe('Random and Edge Case Content', () => {
    it('should handle emoji content', () => {
      const html = `<p>This paragraph has emojis 🎉🚀💡 mixed with text that is long enough to be valid.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('🎉');
    });

    it('should handle special characters', () => {
      const html = `<p>Special chars: &amp; &lt; &gt; &quot; &#x27; should be decoded properly in the output.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('&');
      expect(result.join(' ')).toContain('<');
      expect(result.join(' ')).toContain('>');
    });

    it('should handle numbers and dates', () => {
      const html = `
        <p>The event happened on January 15, 2024. Around 1,234 people attended the ceremony.</p>
        <p>The temperature was 32.5°F or about -0.3°C on that particular day.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('January 15, 2024');
      expect(result.join(' ')).toContain('1,234');
    });

    it('should handle currency symbols', () => {
      const html = `<p>The product costs $99.99 in the US, €89.99 in Europe, and ¥10,000 in Japan.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('$99.99');
      expect(result.join(' ')).toContain('€89.99');
    });

    it('should handle mathematical expressions', () => {
      const html = `<p>The formula is: E = mc². Also, 2 + 2 = 4 and x² + y² = z² is the Pythagorean theorem.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('E = mc²');
    });

    it('should handle URLs in text', () => {
      const html = `<p>Visit https://example.com/path?query=value for more information about this topic.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('https://example.com');
    });

    it('should handle email addresses', () => {
      const html = `<p>Contact us at support@example.com or sales@company.org for assistance.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('support@example.com');
    });

    it('should handle phone numbers', () => {
      const html = `<p>Call us at +1 (555) 123-4567 or internationally at +44 20 7946 0958.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('+1 (555) 123-4567');
    });

    it('should handle hashtags and mentions', () => {
      const html = `<p>Follow us on social media using #ParselyReader and tag @ParselyApp in your posts.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('#ParselyReader');
      expect(result.join(' ')).toContain('@ParselyApp');
    });

    it('should handle tables', () => {
      const html = `
        <table>
          <tr><td>Row 1 Cell 1</td><td>Row 1 Cell 2</td></tr>
          <tr><td>Row 2 Cell 1</td><td>Row 2 Cell 2</td></tr>
        </table>
      `;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('Row 1 Cell 1');
    });

    it('should handle whitespace-only elements', () => {
      const html = `
        <p>   </p>
        <p>Actual content paragraph with enough text here.</p>
        <p>  \n\t  </p>
      `;
      const result = Serializer.serialize(html);
      expect(result.every((p) => p.trim().length > 0)).toBe(true);
    });

    it('should handle deeply nested elements', () => {
      const html = `
        <div><div><div><div><p>This is deeply nested content that should be extracted properly.</p></div></div></div></div>
      `;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('deeply nested content');
    });
  });

  describe('Real-World Article Content', () => {
    it('should handle a news article structure', () => {
      const html = `
        <article>
          <h1>Breaking News: Major Event Happens</h1>
          <p class="byline">By John Doe | December 27, 2024</p>
          <p>In a surprising turn of events, something major happened today that will affect millions of people across the globe.</p>
          <h2>Background Information</h2>
          <p>To understand the significance of this event, we need to look at the historical context and previous occurrences.</p>
          <blockquote>
            "This is the most important development we've seen in decades," said an expert on the matter.
          </blockquote>
          <p>The implications of this development are far-reaching and will likely influence future decisions.</p>
        </article>
      `;
      const result = Serializer.serialize(html);
      expect(result).toContain('Breaking News: Major Event Happens');
      expect(result.join(' ')).toContain('surprising turn of events');
      expect(result).toContain('Background Information');
    });

    it('should handle a blog post with lists', () => {
      const html = `
        <article>
          <h1>10 Tips for Better Productivity</h1>
          <p>Improving your productivity doesn't have to be complicated. Here are ten simple tips.</p>
          <h2>The Essential Tips</h2>
          <ol>
            <li>Wake up early and establish a morning routine</li>
            <li>Plan your day the night before</li>
            <li>Focus on one task at a time</li>
          </ol>
          <h2>Additional Advice</h2>
          <ul>
            <li>Take regular breaks to maintain focus</li>
            <li>Stay hydrated throughout the day</li>
            <li>Get enough sleep each night</li>
          </ul>
        </article>
      `;
      const result = Serializer.serialize(html);
      expect(result).toContain('10 Tips for Better Productivity');
      expect(result.some((p) => p.startsWith('1.'))).toBe(true);
      expect(result.some((p) => p.startsWith('•'))).toBe(true);
    });

    it('should handle technical documentation', () => {
      const html = `
        <article>
          <h1>API Documentation</h1>
          <h2>Authentication</h2>
          <p>All API requests require authentication using an API key in the header.</p>
          <pre><code>Authorization: Bearer YOUR_API_KEY</code></pre>
          <h2>Endpoints</h2>
          <h3>GET /users</h3>
          <p>Returns a list of all users in the system. Supports pagination and filtering.</p>
          <h3>POST /users</h3>
          <p>Creates a new user with the provided data. Returns the created user object.</p>
        </article>
      `;
      const result = Serializer.serialize(html);
      expect(result).toContain('API Documentation');
      expect(result.join(' ')).toContain('Authentication');
    });

    it('should handle academic paper structure', () => {
      const html = `
        <article>
          <h1>A Study on Reading Comprehension in Digital Environments</h1>
          <p><strong>Abstract:</strong> This study examines how digital reading differs from traditional reading methods.</p>
          <h2>Introduction</h2>
          <p>Reading has evolved significantly with the advent of digital technology. This paper explores the implications of this shift on comprehension and retention.</p>
          <h2>Methodology</h2>
          <p>We conducted a randomized controlled trial with 500 participants over a period of six months.</p>
          <h2>Results</h2>
          <p>Our findings indicate a 23% improvement in comprehension when using focused reading techniques.</p>
          <h2>Conclusion</h2>
          <p>Digital reading tools that promote focus can significantly enhance comprehension outcomes.</p>
        </article>
      `;
      const result = Serializer.serialize(html);
      expect(result[0]).toContain('A Study on Reading Comprehension');
      expect(result.join(' ')).toContain('Introduction');
      expect(result.join(' ')).toContain('Methodology');
      expect(result.join(' ')).toContain('Conclusion');
    });
  });

  describe('Malformed HTML', () => {
    it('should handle unclosed tags', () => {
      const html = `<p>This paragraph is not closed<p>Another paragraph here`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle extra closing tags', () => {
      const html = `<p>Normal paragraph</p></p></div>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('Normal paragraph');
    });

    it('should handle mixed case tags', () => {
      const html = `<P>Paragraph with mixed case tags.</P><DIV>Content in div.</DIV>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle self-closing tags', () => {
      const html = `<p>Before image</p><img src="test.jpg" /><p>After image with enough text.</p>`;
      const result = Serializer.serialize(html);
      expect(result.join(' ')).toContain('Before image');
      expect(result.join(' ')).toContain('After image');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very large documents', () => {
      const paragraphs = Array(100)
        .fill('<p>This is a repeated paragraph with enough content to be valid on its own.</p>')
        .join('');
      const html = `<article>${paragraphs}</article>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle single very long word', () => {
      const longWord = 'a'.repeat(1000);
      const html = `<p>Here is a ${longWord} very long word in the middle of a sentence.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle many small elements', () => {
      const spans = Array(50).fill('<span>word</span>').join(' ');
      const html = `<p>${spans}</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Complex List Scenarios', () => {
    it('should handle nested lists', () => {
      const html = `
        <ul>
          <li>First level item with content
            <ul>
              <li>Nested item one</li>
              <li>Nested item two</li>
            </ul>
          </li>
          <li>Another first level item</li>
        </ul>
      `;
      const result = Serializer.serialize(html);
      expect(result.some((p) => p.startsWith('•'))).toBe(true);
    });

    it('should handle mixed ordered and unordered lists', () => {
      const html = `
        <ol>
          <li>Ordered item one content</li>
          <li>Ordered item two content</li>
        </ol>
        <ul>
          <li>Unordered item one content</li>
          <li>Unordered item two content</li>
        </ul>
      `;
      const result = Serializer.serialize(html);
      expect(result.some((p) => p.startsWith('1.'))).toBe(true);
      expect(result.some((p) => p.startsWith('•'))).toBe(true);
    });

    it('should handle list items with complex content', () => {
      const html = `
        <ul>
          <li><strong>Bold item</strong> with additional text content</li>
          <li><a href="#">Linked item</a> with more description</li>
          <li><code>code item</code> with explanation text</li>
        </ul>
      `;
      const result = Serializer.serialize(html);
      expect(result.some((p) => p.includes('Bold item'))).toBe(true);
      expect(result.some((p) => p.includes('Linked item'))).toBe(true);
    });
  });

  describe('Heading Scenarios', () => {
    it('should never merge headings with adjacent paragraphs', () => {
      const html = `
        <h2>Section Title</h2>
        <p>Short.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result).toContain('Section Title');
      // The heading should be separate
      expect(result[0]).toBe('Section Title');
    });

    it('should handle consecutive headings', () => {
      const html = `
        <h1>Main Title</h1>
        <h2>Subtitle Here</h2>
        <h3>Sub-subtitle</h3>
      `;
      const result = Serializer.serialize(html);
      expect(result).toContain('Main Title');
      expect(result).toContain('Subtitle Here');
      expect(result).toContain('Sub-subtitle');
    });

    it('should handle headings with inline elements', () => {
      const html = `<h1>Title with <em>emphasis</em> and <strong>bold</strong></h1>`;
      const result = Serializer.serialize(html);
      expect(result[0]).toContain('Title with');
      expect(result[0]).toContain('emphasis');
      expect(result[0]).toContain('bold');
    });
  });

  describe('Unicode and International Content', () => {
    it('should handle RTL languages (Arabic)', () => {
      const html = `<p>مرحبا بالعالم. هذا نص عربي للاختبار. يجب أن تتم معالجته بشكل صحيح.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('مرحبا');
    });

    it('should handle Hebrew text', () => {
      const html = `<p>שלום עולם. זהו טקסט בעברית לבדיקה. הוא צריך להיות מעובד כראוי.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('שלום');
    });

    it('should handle Cyrillic text', () => {
      const html = `<p>Привет мир. Это русский текст для тестирования. Он должен обрабатываться правильно.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('Привет');
    });

    it('should handle Greek text', () => {
      const html = `<p>Γεια σου κόσμε. Αυτό είναι ελληνικό κείμενο για δοκιμή. Πρέπει να υποβληθεί σε επεξεργασία σωστά.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('Γεια');
    });

    it('should handle Thai text', () => {
      const html = `<p>สวัสดีชาวโลก นี่คือข้อความภาษาไทยสำหรับการทดสอบ ควรประมวลผลอย่างถูกต้อง</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('สวัสดี');
    });

    it('should handle Devanagari (Hindi) text', () => {
      const html = `<p>नमस्ते दुनिया। यह परीक्षण के लिए हिंदी पाठ है। इसे सही ढंग से संसाधित किया जाना चाहिए।</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.join(' ')).toContain('नमस्ते');
    });
  });

  describe('Numbers at Start of Paragraphs', () => {
    it('should preserve numbers at the beginning of text (not in lists)', () => {
      const html = `<p>1970~80년대 미국 연쇄살인범 증가의 원인이 차량과 공장에서 발생한 납 배출 가스 때문이었을 가능성이 있음.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toContain('1970');
      expect(result[0]).not.toMatch(/^\d+\.\s/); // Should not start with "N. " pattern like list items
    });

    it('should not mistake year ranges for list numbers', () => {
      const html = `<p>2020-2024 was a challenging period for the global economy.</p>`;
      const result = Serializer.serialize(html);
      expect(result[0]).toContain('2020-2024');
      expect(result[0]).not.toMatch(/^\d+\.\s/);
    });

    it('should not mistake standalone numbers for list numbers', () => {
      const html = `<p>42 is the answer to life, the universe, and everything according to Douglas Adams.</p>`;
      const result = Serializer.serialize(html);
      expect(result[0]).toContain('42 is the answer');
    });

    it('should correctly distinguish between ordered list items and number-starting paragraphs', () => {
      const html = `
        <ol>
          <li>This is an actual list item</li>
        </ol>
        <p>1984 is a dystopian novel by George Orwell about totalitarian surveillance.</p>
      `;
      const result = Serializer.serialize(html);
      // The list item should have "1. " prefix
      expect(result.some((p) => p.startsWith('1.') && p.includes('actual list item'))).toBe(true);
      // The paragraph should preserve "1984" at the start
      expect(result.some((p) => p.includes('1984 is a dystopian novel'))).toBe(true);
    });

    it('should handle Korean text with leading numbers correctly', () => {
      const html = `
        <p>1970~80년대 미국 연쇄살인범 증가의 원인이 차량과 공장에서 발생한 납 배출 가스 때문이었을 가능성이 있음. 이후 환경 규제로 감소했을 수도.</p>
        <p>2000년대 초반에는 인터넷 버블이 붕괴되었다.</p>
      `;
      const result = Serializer.serialize(html);
      expect(result.some((p) => p.includes('1970~80년대'))).toBe(true);
      expect(result.some((p) => p.includes('2000년대'))).toBe(true);
    });
  });

  describe('Content with Unusual Formatting', () => {
    it('should handle text with excessive whitespace', () => {
      const html = `<p>This    has     lots    of     extra     spaces    between    words.</p>`;
      const result = Serializer.serialize(html);
      expect(result[0]).not.toContain('  '); // No double spaces
    });

    it('should handle text with tabs and newlines', () => {
      const html = `<p>This\thas\ttabs\tand\nnewlines\nin\nit.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle zero-width characters', () => {
      const html = `<p>This has zero\u200Bwidth\u200Bspaces\u200Bin it.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle non-breaking spaces', () => {
      const html = `<p>This&nbsp;has&nbsp;non-breaking&nbsp;spaces&nbsp;in it.</p>`;
      const result = Serializer.serialize(html);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
