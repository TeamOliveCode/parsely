/**
 * Splits plain text into paragraphs for reader mode.
 * Used for user-selected text that doesn't come from article extraction.
 */
export class TextSplitter {
  /**
   * Split text into paragraphs based on:
   * 1. Empty lines (double newline)
   * 2. Single newlines
   * 3. Sentence endings (. ? !)
   */
  public static split(text: string): string[] {
    if (!text || !text.trim()) {
      return [];
    }

    // Normalize line endings
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // First split by empty lines (paragraph breaks)
    const blocks = normalized.split(/\n\s*\n/).filter((block) => block.trim());

    const paragraphs: string[] = [];

    for (const block of blocks) {
      // Split each block by single newlines
      const lines = block.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        // Split by sentence endings, keeping the punctuation
        const sentences = this.splitBySentence(line.trim());
        paragraphs.push(...sentences);
      }
    }

    return paragraphs.filter((p) => p.trim().length > 0);
  }

  /**
   * Split text by sentence endings while preserving punctuation.
   * Handles common abbreviations and edge cases.
   */
  private static splitBySentence(text: string): string[] {
    if (!text) return [];

    // Common abbreviations that shouldn't split
    const abbreviations = [
      'Mr',
      'Mrs',
      'Ms',
      'Dr',
      'Prof',
      'Sr',
      'Jr',
      'vs',
      'etc',
      'i.e',
      'e.g',
      'cf',
      'al',
      'Inc',
      'Ltd',
      'Corp',
      'Co',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Regex to match sentence endings
    // Matches . ? ! followed by space and capital letter, or end of string
    const sentenceEndRegex = /([.?!])(\s+)(?=[A-Z가-힣])/g;

    // Protect abbreviations by temporarily replacing their periods
    let processed = text;
    for (const abbr of abbreviations) {
      const regex = new RegExp(`\\b${abbr}\\.`, 'g');
      processed = processed.replace(regex, `${abbr}<<<DOT>>>`);
    }

    // Also protect decimal numbers (e.g., 3.14)
    processed = processed.replace(/(\d)\.(\d)/g, '$1<<<DOT>>>$2');

    // Split by sentence endings
    const parts = processed.split(sentenceEndRegex);

    // Reconstruct sentences
    const sentences: string[] = [];
    let current = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part.match(/^[.?!]$/)) {
        // This is punctuation - add to current sentence
        current += part;
      } else if (part.match(/^\s+$/)) {
        // This is whitespace after punctuation - finalize sentence
        if (current.trim()) {
          sentences.push(current.trim().replace(/<<<DOT>>>/g, '.'));
        }
        current = '';
      } else {
        // This is text content
        current += part;
      }
    }

    // Add remaining text
    if (current.trim()) {
      sentences.push(current.trim().replace(/<<<DOT>>>/g, '.'));
    }

    // If no sentence breaks found, return original text
    if (sentences.length === 0) {
      return [text];
    }

    return sentences;
  }
}
