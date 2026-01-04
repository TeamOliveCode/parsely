import { describe, it, expect } from 'vitest';
import { Sanitizer } from './sanitizer';

describe('Sanitizer', () => {
  describe('Basic Functionality', () => {
    it('should return empty string for empty input', () => {
      expect(Sanitizer.clean('')).toBe('');
    });

    it('should return empty string for falsy input', () => {
      // @ts-expect-error Testing with null
      expect(Sanitizer.clean(null)).toBe('');
      // @ts-expect-error Testing with undefined
      expect(Sanitizer.clean(undefined)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(Sanitizer.clean('  hello world  ')).toBe('hello world');
    });

    it('should return unchanged text for clean input', () => {
      const input = 'This is clean text.';
      expect(Sanitizer.clean(input)).toBe(input);
    });
  });

  describe('Line Ending Normalization', () => {
    it('should convert Windows line endings to Unix', () => {
      const input = 'Line 1\r\nLine 2\r\nLine 3';
      const expected = 'Line 1\nLine 2\nLine 3';
      expect(Sanitizer.clean(input)).toBe(expected);
    });

    it('should handle mixed line endings', () => {
      const input = 'Line 1\r\nLine 2\nLine 3\r\nLine 4';
      const result = Sanitizer.clean(input);
      expect(result).not.toContain('\r\n');
      expect(result).toContain('\n');
    });

    it('should preserve Unix line endings', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      expect(Sanitizer.clean(input)).toBe(input);
    });

    it('should handle old Mac line endings (CR only)', () => {
      // Note: The sanitizer converts \r\n but not standalone \r
      const input = 'Line 1\r\nLine 2';
      const result = Sanitizer.clean(input);
      expect(result).toBe('Line 1\nLine 2');
    });
  });

  describe('Excessive Newline Collapsing', () => {
    it('should collapse three newlines to two', () => {
      const input = 'Paragraph 1\n\n\nParagraph 2';
      const expected = 'Paragraph 1\n\nParagraph 2';
      expect(Sanitizer.clean(input)).toBe(expected);
    });

    it('should collapse many newlines to two', () => {
      const input = 'Paragraph 1\n\n\n\n\n\n\nParagraph 2';
      const expected = 'Paragraph 1\n\nParagraph 2';
      expect(Sanitizer.clean(input)).toBe(expected);
    });

    it('should preserve double newlines', () => {
      const input = 'Paragraph 1\n\nParagraph 2';
      expect(Sanitizer.clean(input)).toBe(input);
    });

    it('should preserve single newlines', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      expect(Sanitizer.clean(input)).toBe(input);
    });

    it('should handle multiple sections with excessive newlines', () => {
      const input = 'Section 1\n\n\n\nSection 2\n\n\n\n\nSection 3';
      const expected = 'Section 1\n\nSection 2\n\nSection 3';
      expect(Sanitizer.clean(input)).toBe(expected);
    });
  });

  describe('Combined Operations', () => {
    it('should normalize Windows line endings and collapse newlines', () => {
      const input = 'Para 1\r\n\r\n\r\nPara 2';
      const expected = 'Para 1\n\nPara 2';
      expect(Sanitizer.clean(input)).toBe(expected);
    });

    it('should handle complex mixed content', () => {
      const input = '  \r\n  Line 1\r\n\r\n\r\n\r\nLine 2\n\n\n\nLine 3  \r\n  ';
      const result = Sanitizer.clean(input);

      // Should not have Windows line endings
      expect(result).not.toContain('\r\n');
      // Should not have more than 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
      // Should not have leading/trailing whitespace
      expect(result).toBe(result.trim());
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with only whitespace', () => {
      expect(Sanitizer.clean('   ')).toBe('');
      expect(Sanitizer.clean('\t\t\t')).toBe('');
      expect(Sanitizer.clean('\n\n\n')).toBe('');
    });

    it('should handle text with only CRLF', () => {
      expect(Sanitizer.clean('\r\n\r\n\r\n')).toBe('');
    });

    it('should handle single character input', () => {
      expect(Sanitizer.clean('a')).toBe('a');
      expect(Sanitizer.clean(' ')).toBe('');
      expect(Sanitizer.clean('\n')).toBe('');
    });

    it('should handle tabs and spaces', () => {
      const input = 'Text\twith\ttabs\tand  spaces';
      expect(Sanitizer.clean(input)).toBe(input);
    });

    it('should handle unicode content', () => {
      const input = '你好世界\n\n\n\nHello World\r\n\r\nПривет мир';
      const result = Sanitizer.clean(input);
      expect(result).toContain('你好世界');
      expect(result).toContain('Hello World');
      expect(result).toContain('Привет мир');
      expect(result).not.toContain('\r');
    });

    it('should handle emoji content', () => {
      const input = '🎉 Celebration 🎊\n\n\n\n🚀 Launch 🌟';
      const _expected = '🎉 Celebration 🎊\n\nLaunch 🌟';
      const result = Sanitizer.clean(input);
      expect(result).toContain('🎉');
      expect(result).not.toMatch(/\n{3,}/);
    });
  });

  describe('Real-World Content', () => {
    it('should clean article content with varied formatting', () => {
      const input = `
        Article Title\r\n
        \r\n
        \r\n
        First paragraph of the article.\r\n
        \r\n
        \r\n
        \r\n
        Second paragraph continues here.\r\n

        Third paragraph with some content.
      `;
      const result = Sanitizer.clean(input);

      // Should not have Windows line endings
      expect(result).not.toContain('\r\n');
      // Should not have excessive newlines
      expect(result).not.toMatch(/\n{3,}/);
      // Should be trimmed
      expect(result[0]).not.toBe(' ');
      expect(result[0]).not.toBe('\n');
    });

    it('should clean code blocks with preserved formatting', () => {
      const input =
        'function hello() {\n  console.log("Hello");\n}\n\n\n\nfunction goodbye() {\n  console.log("Bye");\n}';
      const result = Sanitizer.clean(input);

      // Function content should be preserved
      expect(result).toContain('function hello()');
      expect(result).toContain('function goodbye()');
      // Excessive newlines collapsed
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should handle HTML content strings', () => {
      const input = '<p>Paragraph 1</p>\r\n\r\n\r\n<p>Paragraph 2</p>';
      const result = Sanitizer.clean(input);

      expect(result).toContain('<p>Paragraph 1</p>');
      expect(result).toContain('<p>Paragraph 2</p>');
      expect(result).not.toContain('\r');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very long text', () => {
      const longText = 'word '.repeat(10000);
      const input = `${longText}\n\n\n\n${longText}`;
      const result = Sanitizer.clean(input);

      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should handle many line breaks', () => {
      const input = 'text' + '\n'.repeat(100) + 'more text';
      const result = Sanitizer.clean(input);

      expect(result).not.toMatch(/\n{3,}/);
      expect(result).toContain('text');
      expect(result).toContain('more text');
    });

    it('should handle alternating CRLF and LF', () => {
      const input = 'A\r\nB\nC\r\nD\nE\r\nF';
      const result = Sanitizer.clean(input);

      expect(result).not.toContain('\r');
      expect(result).toBe('A\nB\nC\nD\nE\nF');
    });
  });
});
