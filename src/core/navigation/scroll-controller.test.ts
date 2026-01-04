import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollController } from './scroll-controller';
import { ReaderState } from '../state/reader-state';

describe('ScrollController', () => {
  let state: ReaderState;
  let controller: ScrollController;

  beforeEach(() => {
    vi.useFakeTimers();
    state = new ReaderState([
      'Para 1',
      'Para 2',
      'Para 3',
      'Para 4',
      'Para 5',
      'Para 6',
      'Para 7',
      'Para 8',
      'Para 9',
      'Para 10',
    ]);
    controller = new ScrollController(state);
  });

  afterEach(() => {
    controller.destroy();
    vi.useRealTimers();
  });

  describe('Basic Scroll Behavior', () => {
    it('should always return true (consume wheel events)', () => {
      expect(controller.handleWheel(10)).toBe(true);
      expect(controller.handleWheel(-10)).toBe(true);
      expect(controller.handleWheel(0)).toBe(true);
    });

    it('should navigate next on downward scroll past threshold', () => {
      controller.handleWheel(60); // Above SINGLE_SCROLL_THRESHOLD (50)

      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should navigate prev on upward scroll past threshold', () => {
      state.goTo(5);
      controller.handleWheel(-60); // Negative = upward

      expect(state.getCurrentIndex()).toBe(4);
    });

    it('should not navigate on scroll below threshold', () => {
      controller.handleWheel(30); // Below threshold

      expect(state.getCurrentIndex()).toBe(0);
    });
  });

  describe('Delta Accumulation', () => {
    it('should accumulate small scrolls to reach threshold', () => {
      controller.handleWheel(20);
      expect(state.getCurrentIndex()).toBe(0);

      controller.handleWheel(20);
      expect(state.getCurrentIndex()).toBe(0);

      controller.handleWheel(20); // Total: 60, above threshold
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should reset accumulated delta after threshold time (150ms)', () => {
      controller.handleWheel(40);
      expect(state.getCurrentIndex()).toBe(0);

      vi.advanceTimersByTime(200); // Past SCROLL_RESET_DELAY

      controller.handleWheel(40); // Should start fresh
      expect(state.getCurrentIndex()).toBe(0); // Still below threshold
    });

    it('should reset accumulated delta after navigation', () => {
      controller.handleWheel(60); // Navigate
      expect(state.getCurrentIndex()).toBe(1);

      // Accumulated delta should be reset, need full threshold again
      vi.advanceTimersByTime(100); // Wait for debounce

      controller.handleWheel(30);
      expect(state.getCurrentIndex()).toBe(1); // Not enough for another navigation
    });
  });

  describe('Fast Scroll', () => {
    it('should skip multiple paragraphs on fast scroll', () => {
      vi.advanceTimersByTime(100); // Ensure clean state

      controller.handleWheel(200); // Well above FAST_SCROLL_THRESHOLD (150)

      // Should move multiple paragraphs (up to FAST_SCROLL_MULTIPLIER = 3)
      expect(state.getCurrentIndex()).toBeGreaterThan(1);
    });

    it('should respect FAST_SCROLL_MULTIPLIER limit', () => {
      vi.advanceTimersByTime(100);

      controller.handleWheel(500); // Very fast scroll

      // Should move at most 3 paragraphs (FAST_SCROLL_MULTIPLIER)
      expect(state.getCurrentIndex()).toBeLessThanOrEqual(3);
    });

    it('should handle fast upward scroll', () => {
      state.goTo(5);
      vi.advanceTimersByTime(100);

      controller.handleWheel(-200);

      expect(state.getCurrentIndex()).toBeLessThan(5);
      expect(state.getCurrentIndex()).toBeGreaterThanOrEqual(2); // At most 3 back from 5
    });
  });

  describe('Debouncing', () => {
    it('should debounce rapid navigation', () => {
      controller.handleWheel(60); // First navigation
      expect(state.getCurrentIndex()).toBe(1);

      controller.handleWheel(60); // Immediate second - should be debounced
      expect(state.getCurrentIndex()).toBe(1);

      vi.advanceTimersByTime(100); // Wait for debounce to clear
      controller.handleWheel(60);
      expect(state.getCurrentIndex()).toBe(2);
    });

    it('should allow navigation after debounce delay', () => {
      controller.handleWheel(60);
      expect(state.getCurrentIndex()).toBe(1);

      vi.advanceTimersByTime(90); // Past DEBOUNCE_DELAY (80)

      controller.handleWheel(60);
      expect(state.getCurrentIndex()).toBe(2);
    });
  });

  describe('Direction Changes', () => {
    it('should handle direction reversal', () => {
      state.goTo(5);

      controller.handleWheel(60); // Down to 6
      expect(state.getCurrentIndex()).toBe(6);

      vi.advanceTimersByTime(100);

      controller.handleWheel(-60); // Up to 5
      expect(state.getCurrentIndex()).toBe(5);
    });

    it('should cancel out opposing scroll directions', () => {
      controller.handleWheel(40); // Accumulate positive
      controller.handleWheel(-30); // Accumulate negative

      // Net delta = 10, below threshold
      expect(state.getCurrentIndex()).toBe(0);
    });
  });

  describe('Boundary Conditions', () => {
    it('should not go below zero', () => {
      controller.handleWheel(-100);
      controller.handleWheel(-100);

      expect(state.getCurrentIndex()).toBe(0);
    });

    it('should complete at end of content', () => {
      state.goTo(8);

      let completed = false;
      state.subscribe((i, t, r, c) => {
        completed = c;
      });

      controller.handleWheel(60); // To 9
      vi.advanceTimersByTime(100);
      controller.handleWheel(60); // Complete

      expect(completed).toBe(true);
    });

    it('should handle scroll at boundaries gracefully', () => {
      // At start, scroll up
      controller.handleWheel(-100);
      expect(state.getCurrentIndex()).toBe(0);

      // Go to end
      state.goTo(9);
      let completed = false;
      state.subscribe((i, t, r, c) => {
        completed = c;
      });

      vi.advanceTimersByTime(100);
      controller.handleWheel(100); // Past end

      expect(completed).toBe(true);
    });
  });

  describe('Zero and Edge Values', () => {
    it('should handle zero delta', () => {
      controller.handleWheel(0);
      expect(state.getCurrentIndex()).toBe(0);
    });

    it('should handle very small deltas', () => {
      for (let i = 0; i < 100; i++) {
        controller.handleWheel(1);
      }
      // After 100 small scrolls with accumulation = 100, should have navigated
      expect(state.getCurrentIndex()).toBeGreaterThanOrEqual(1);
    });

    it('should handle negative zero', () => {
      controller.handleWheel(-0);
      expect(state.getCurrentIndex()).toBe(0);
    });
  });

  describe('destroy()', () => {
    it('should clean up timeout on destroy', () => {
      controller.handleWheel(60); // Creates timeout

      // Should not throw
      expect(() => controller.destroy()).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      expect(() => {
        controller.destroy();
        controller.destroy();
        controller.destroy();
      }).not.toThrow();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle trackpad gestures (many small deltas)', () => {
      // Simulate trackpad smooth scroll
      for (let i = 0; i < 10; i++) {
        controller.handleWheel(8);
        vi.advanceTimersByTime(10);
      }

      // Total delta = 80, should have navigated
      expect(state.getCurrentIndex()).toBeGreaterThanOrEqual(1);
    });

    it('should handle mouse wheel clicks (discrete deltas)', () => {
      // Simulate mouse wheel with 100px per click
      controller.handleWheel(100);
      expect(state.getCurrentIndex()).toBe(1);

      vi.advanceTimersByTime(500);

      controller.handleWheel(100);
      expect(state.getCurrentIndex()).toBe(2);
    });

    it('should handle flick scroll gestures', () => {
      // Simulate a fast flick with decreasing deltas
      controller.handleWheel(150);
      expect(state.getCurrentIndex()).toBeGreaterThan(0);

      vi.advanceTimersByTime(100);

      controller.handleWheel(80);
      controller.handleWheel(40);
      controller.handleWheel(20);

      // Should have navigated further
      expect(state.getCurrentIndex()).toBeGreaterThan(1);
    });

    it('should handle scroll reversal mid-gesture', () => {
      state.goTo(5);

      // Start scrolling down
      controller.handleWheel(40);
      // User changes mind, scrolls up
      controller.handleWheel(-80);

      // Net: -40, should go up if threshold reached
      // Actually needs to reach -50 threshold
      controller.handleWheel(-20); // Net: -60

      expect(state.getCurrentIndex()).toBe(4);
    });
  });

  describe('Timing Edge Cases', () => {
    it('should handle scroll exactly at reset boundary', () => {
      controller.handleWheel(40);
      vi.advanceTimersByTime(151); // Just past SCROLL_RESET_DELAY

      controller.handleWheel(40);
      expect(state.getCurrentIndex()).toBe(0); // Reset happened, below threshold
    });

    it('should handle scroll just before reset', () => {
      controller.handleWheel(40);
      vi.advanceTimersByTime(149); // Just before reset

      controller.handleWheel(40); // Should accumulate
      expect(state.getCurrentIndex()).toBe(1); // Total 80 > 50 threshold
    });

    it('should handle debounce exactly at boundary', () => {
      controller.handleWheel(60);
      expect(state.getCurrentIndex()).toBe(1);

      vi.advanceTimersByTime(80); // Exactly at DEBOUNCE_DELAY

      controller.handleWheel(60);
      expect(state.getCurrentIndex()).toBe(2);
    });
  });

  describe('Single Paragraph Edge Case', () => {
    it('should handle single paragraph content', () => {
      const singleState = new ReaderState(['Only one']);
      const singleController = new ScrollController(singleState);

      singleController.handleWheel(60);

      let completed = false;
      singleState.subscribe((i, t, r, c) => {
        completed = c;
      });

      expect(completed).toBe(true);

      singleController.destroy();
    });
  });

  describe('Empty Content Edge Case', () => {
    it('should handle empty content', () => {
      const emptyState = new ReaderState([]);
      const emptyController = new ScrollController(emptyState);

      expect(() => {
        emptyController.handleWheel(100);
        emptyController.handleWheel(-100);
      }).not.toThrow();

      emptyController.destroy();
    });
  });

  describe('Concurrent State Changes', () => {
    it('should work with external state changes', () => {
      controller.handleWheel(60); // Go to 1
      expect(state.getCurrentIndex()).toBe(1);

      state.goTo(5); // External jump

      vi.advanceTimersByTime(100);

      controller.handleWheel(60); // Should continue from new position
      expect(state.getCurrentIndex()).toBe(6);
    });

    it('should work with external reset via setParagraphs', () => {
      controller.handleWheel(60);
      expect(state.getCurrentIndex()).toBe(1);

      state.setParagraphs(['New 1', 'New 2', 'New 3']);
      expect(state.getCurrentIndex()).toBe(0);

      vi.advanceTimersByTime(100);

      controller.handleWheel(60);
      expect(state.getCurrentIndex()).toBe(1);
    });
  });
});
