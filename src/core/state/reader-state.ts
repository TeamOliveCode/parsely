import type { StateChangeListener } from '../../types';

export class ReaderState {
  private paragraphs: string[] = [];
  private wordCounts: number[] = [];
  private currentIndex: number = 0;
  private isCompleted: boolean = false;
  private listeners: StateChangeListener[] = [];
  private readonly WPM = 225;

  // Session stats
  private startTime: number = Date.now();
  private viewedIndices: Set<number> = new Set();

  constructor(paragraphs: string[] = [], initialIndex: number = 0) {
    this.paragraphs = paragraphs;
    this.wordCounts = paragraphs.map((p) => this.countWords(p));
    this.currentIndex = Math.min(Math.max(0, initialIndex), Math.max(0, paragraphs.length - 1));
    this.viewedIndices.add(this.currentIndex);
  }

  public setParagraphs(paragraphs: string[], initialIndex: number = 0) {
    this.paragraphs = paragraphs;
    this.wordCounts = paragraphs.map((p) => this.countWords(p));
    this.currentIndex = Math.min(Math.max(0, initialIndex), Math.max(0, paragraphs.length - 1));
    this.isCompleted = false;
    this.startTime = Date.now();
    this.viewedIndices = new Set([this.currentIndex]);
    this.notify();
  }

  public next() {
    if (this.isCompleted) return;

    if (this.currentIndex < this.paragraphs.length - 1) {
      this.currentIndex++;
      this.viewedIndices.add(this.currentIndex);
      this.notify();
    } else {
      this.isCompleted = true;
      this.notify();
    }
  }

  public prev() {
    if (this.isCompleted) {
      this.isCompleted = false;
      this.notify();
      return;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.notify();
    }
  }

  public goTo(index: number) {
    if (index >= 0 && index < this.paragraphs.length) {
      this.isCompleted = false;
      this.currentIndex = index;
      this.viewedIndices.add(this.currentIndex);
      this.notify();
    }
  }

  public subscribe(listener: StateChangeListener) {
    this.listeners.push(listener);
    // Initial notification
    listener(
      this.currentIndex,
      this.getCurrentText(),
      this.getRemainingMinutes(),
      this.isCompleted
    );
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentText(): string {
    return this.paragraphs[this.currentIndex] || '';
  }

  public getPreviousText(): string | null {
    if (this.currentIndex > 0) {
      return this.paragraphs[this.currentIndex - 1];
    }
    return null;
  }

  public getNextText(): string | null {
    if (this.currentIndex < this.paragraphs.length - 1) {
      return this.paragraphs[this.currentIndex + 1];
    }
    return null;
  }

  public getPrev2Text(): string | null {
    if (this.currentIndex > 1) {
      return this.paragraphs[this.currentIndex - 2];
    }
    return null;
  }

  public getNext2Text(): string | null {
    if (this.currentIndex < this.paragraphs.length - 2) {
      return this.paragraphs[this.currentIndex + 2];
    }
    return null;
  }

  public getTotal(): number {
    return this.paragraphs.length;
  }

  public getSessionStats() {
    return {
      timeSpentMs: Date.now() - this.startTime,
      paragraphsRead: this.viewedIndices.size,
      totalParagraphs: this.paragraphs.length,
    };
  }

  public getRemainingMinutes(): number {
    if (this.isCompleted) return 0;
    if (this.currentIndex >= this.paragraphs.length - 1) return 0;

    const remainingWords = this.wordCounts
      .slice(this.currentIndex + 1)
      .reduce((sum, count) => sum + count, 0);

    return Math.ceil(remainingWords / this.WPM);
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  private notify() {
    const text = this.getCurrentText();
    const remaining = this.getRemainingMinutes();
    this.listeners.forEach((l) => l(this.currentIndex, text, remaining, this.isCompleted));
  }
}
