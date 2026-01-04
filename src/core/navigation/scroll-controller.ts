import { ReaderState } from '../state/reader-state';

export class ScrollController {
  private state: ReaderState;
  private accumulatedDelta: number = 0;
  private lastScrollTime: number = 0;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  // Thresholds for scroll behavior
  private readonly SINGLE_SCROLL_THRESHOLD = 50; // Delta needed for single paragraph move
  private readonly FAST_SCROLL_THRESHOLD = 150; // Delta needed to trigger fast scroll
  private readonly FAST_SCROLL_MULTIPLIER = 3; // How many paragraphs to skip on fast scroll
  private readonly SCROLL_RESET_DELAY = 150; // ms before resetting accumulated delta
  private readonly DEBOUNCE_DELAY = 80; // ms between paragraph changes for smooth feel

  private lastNavigationTime: number = 0;
  private isNavigating: boolean = false;

  constructor(state: ReaderState) {
    this.state = state;
  }

  public handleWheel(deltaY: number): boolean {
    const now = Date.now();

    // Reset accumulated delta if too much time has passed
    if (now - this.lastScrollTime > this.SCROLL_RESET_DELAY) {
      this.accumulatedDelta = 0;
    }

    this.lastScrollTime = now;
    this.accumulatedDelta += deltaY;

    // Clear existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Check if we should navigate
    const absDelta = Math.abs(this.accumulatedDelta);

    if (absDelta >= this.SINGLE_SCROLL_THRESHOLD) {
      // Debounce rapid navigation
      if (now - this.lastNavigationTime < this.DEBOUNCE_DELAY && this.isNavigating) {
        return true;
      }

      const direction = this.accumulatedDelta > 0 ? 1 : -1; // 1 = down/next, -1 = up/prev

      // Determine how many paragraphs to move
      let paragraphsToMove = 1;
      if (absDelta >= this.FAST_SCROLL_THRESHOLD) {
        // Fast scroll - move multiple paragraphs
        paragraphsToMove = Math.min(
          this.FAST_SCROLL_MULTIPLIER,
          Math.floor(absDelta / this.SINGLE_SCROLL_THRESHOLD)
        );
      }

      this.navigate(direction, paragraphsToMove);
      this.lastNavigationTime = now;
      this.isNavigating = true;

      // Reset accumulated delta after navigation
      this.accumulatedDelta = 0;

      // Set timeout to mark navigation as complete
      this.scrollTimeout = setTimeout(() => {
        this.isNavigating = false;
      }, this.DEBOUNCE_DELAY);

      return true;
    }

    return true; // Always consume wheel events in reader mode
  }

  private navigate(direction: number, count: number): void {
    for (let i = 0; i < count; i++) {
      if (direction > 0) {
        this.state.next();
      } else {
        this.state.prev();
      }
    }
  }

  public destroy(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
  }
}
