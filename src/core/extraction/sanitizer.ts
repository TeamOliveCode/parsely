export class Sanitizer {
  public static clean(text: string): string {
    if (!text) return '';

    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Collapse excessive newlines
      .trim();
  }
}
