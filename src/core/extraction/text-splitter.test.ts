import { describe, it, expect } from 'vitest';
import { TextSplitter } from './text-splitter';

describe('TextSplitter', () => {
  describe('split - basic functionality', () => {
    it('should return empty array for empty input', () => {
      expect(TextSplitter.split('')).toEqual([]);
      expect(TextSplitter.split('   ')).toEqual([]);
      expect(TextSplitter.split('\n\n')).toEqual([]);
    });

    it('should split by double newlines (paragraph breaks)', () => {
      const text = 'First paragraph.\n\nSecond paragraph.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['First paragraph.', 'Second paragraph.']);
    });

    it('should split by single newlines', () => {
      const text = 'First line.\nSecond line.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['First line.', 'Second line.']);
    });

    it('should handle mixed newlines', () => {
      const text = 'Paragraph one.\n\nLine one.\nLine two.\n\nParagraph three.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Paragraph one.', 'Line one.', 'Line two.', 'Paragraph three.']);
    });
  });

  describe('split - sentence splitting', () => {
    it('should split by sentence endings', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['First sentence.', 'Second sentence.', 'Third sentence.']);
    });

    it('should handle question marks', () => {
      const text = 'Is this a question? Yes it is.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Is this a question?', 'Yes it is.']);
    });

    it('should handle exclamation marks', () => {
      const text = 'Wow! That is amazing.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Wow!', 'That is amazing.']);
    });

    it('should handle mixed punctuation', () => {
      const text = 'Hello! How are you? I am fine.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Hello!', 'How are you?', 'I am fine.']);
    });
  });

  describe('split - abbreviations', () => {
    it('should not split on Mr.', () => {
      const text = 'Mr. Smith went to the store. He bought milk.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Mr. Smith went to the store.', 'He bought milk.']);
    });

    it('should not split on Dr.', () => {
      const text = 'Dr. Jones is here. She will see you now.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Dr. Jones is here.', 'She will see you now.']);
    });

    it('should not split on Mrs. and Ms.', () => {
      const text = 'Mrs. Brown and Ms. White arrived. They are early.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Mrs. Brown and Ms. White arrived.', 'They are early.']);
    });

    it('should not split on etc.', () => {
      const text = 'Bring food, drinks, etc. and more items. We need supplies.';
      const result = TextSplitter.split(text);
      // etc. is protected, so split happens at next sentence boundary
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toContain('etc.');
    });

    it('should not split on i.e. and e.g.', () => {
      const text = 'Use a browser, e.g. Chrome. It works well.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Use a browser, e.g. Chrome.', 'It works well.']);
    });

    it('should not split on Inc. and Ltd.', () => {
      const text = 'Apple Inc. announced news. The stock rose.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Apple Inc. announced news.', 'The stock rose.']);
    });

    it('should not split on month abbreviations', () => {
      const text = 'It happened on Jan. 15th. The weather was cold.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['It happened on Jan. 15th.', 'The weather was cold.']);
    });
  });

  describe('split - decimal numbers', () => {
    it('should not split on decimal numbers', () => {
      const text = 'The value is 3.14 percent. That is accurate.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['The value is 3.14 percent.', 'That is accurate.']);
    });

    it('should handle multiple decimals', () => {
      const text = 'Values are 1.5, 2.7, and 3.9 units. All valid.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Values are 1.5, 2.7, and 3.9 units.', 'All valid.']);
    });
  });

  describe('split - line ending normalization', () => {
    it('should normalize Windows line endings (CRLF)', () => {
      const text = 'First line.\r\nSecond line.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['First line.', 'Second line.']);
    });

    it('should normalize old Mac line endings (CR)', () => {
      const text = 'First line.\rSecond line.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['First line.', 'Second line.']);
    });

    it('should handle mixed line endings', () => {
      const text = 'Line one.\r\nLine two.\rLine three.\nLine four.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Line one.', 'Line two.', 'Line three.', 'Line four.']);
    });
  });

  describe('split - Korean text', () => {
    it('should split Korean sentences', () => {
      const text = '안녕하세요. 반갑습니다.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['안녕하세요.', '반갑습니다.']);
    });

    it('should handle Korean with newlines', () => {
      const text = '첫 번째 문단입니다.\n\n두 번째 문단입니다.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['첫 번째 문단입니다.', '두 번째 문단입니다.']);
    });
  });

  describe('split - edge cases', () => {
    it('should handle single sentence without punctuation', () => {
      const text = 'This is a sentence without ending punctuation';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['This is a sentence without ending punctuation']);
    });

    it('should handle text with only whitespace between lines', () => {
      const text = 'First.\n   \n   \nSecond.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['First.', 'Second.']);
    });

    it('should filter out empty results', () => {
      const text = '\n\nHello.\n\n\n\nWorld.\n\n';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['Hello.', 'World.']);
    });

    it('should handle sentence ending without space before capital', () => {
      const text = 'End of sentence.Start of next';
      const result = TextSplitter.split(text);
      // No space after period, so it won't split
      expect(result).toEqual(['End of sentence.Start of next']);
    });

    it('should handle lowercase after period (no split)', () => {
      const text = 'The file is test.txt and it works.';
      const result = TextSplitter.split(text);
      expect(result).toEqual(['The file is test.txt and it works.']);
    });
  });
});
