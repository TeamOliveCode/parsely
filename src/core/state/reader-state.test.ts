import { describe, it, expect, vi } from 'vitest';
import { ReaderState } from './reader-state';

describe('ReaderState', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with empty paragraphs', () => {
      const state = new ReaderState();
      expect(state.getTotal()).toBe(0);
      expect(state.getCurrentIndex()).toBe(0);
      expect(state.getCurrentText()).toBe('');
    });

    it('should initialize with provided paragraphs', () => {
      const paragraphs = ['First paragraph', 'Second paragraph', 'Third paragraph'];
      const state = new ReaderState(paragraphs);
      expect(state.getTotal()).toBe(3);
      expect(state.getCurrentIndex()).toBe(0);
      expect(state.getCurrentText()).toBe('First paragraph');
    });

    it('should initialize with custom initial index', () => {
      const paragraphs = ['First', 'Second', 'Third', 'Fourth'];
      const state = new ReaderState(paragraphs, 2);
      expect(state.getCurrentIndex()).toBe(2);
      expect(state.getCurrentText()).toBe('Third');
    });

    it('should clamp initial index to valid range', () => {
      const paragraphs = ['First', 'Second'];
      const stateHigh = new ReaderState(paragraphs, 10);
      expect(stateHigh.getCurrentIndex()).toBe(1); // Clamped to max

      const stateLow = new ReaderState(paragraphs, -5);
      expect(stateLow.getCurrentIndex()).toBe(0); // Clamped to min
    });
  });

  describe('Navigation - next()', () => {
    it('should advance to next paragraph', () => {
      const state = new ReaderState(['First', 'Second', 'Third']);
      expect(state.getCurrentIndex()).toBe(0);

      state.next();
      expect(state.getCurrentIndex()).toBe(1);
      expect(state.getCurrentText()).toBe('Second');
    });

    it('should set isCompleted when reaching the end', () => {
      const state = new ReaderState(['First', 'Second']);
      state.next(); // Go to Second
      state.next(); // Try to go past end

      // Verify completion state via listener
      let completedValue = false;
      state.subscribe((index, text, remaining, isCompleted) => {
        completedValue = isCompleted;
      });
      expect(completedValue).toBe(true);
    });

    it('should not advance when already completed', () => {
      const state = new ReaderState(['First', 'Second']);
      state.next(); // Go to Second
      state.next(); // Marks as completed

      const indexBefore = state.getCurrentIndex();
      state.next(); // Should do nothing
      expect(state.getCurrentIndex()).toBe(indexBefore);
    });
  });

  describe('Navigation - prev()', () => {
    it('should go to previous paragraph', () => {
      const state = new ReaderState(['First', 'Second', 'Third'], 2);
      expect(state.getCurrentIndex()).toBe(2);

      state.prev();
      expect(state.getCurrentIndex()).toBe(1);
      expect(state.getCurrentText()).toBe('Second');
    });

    it('should not go below zero', () => {
      const state = new ReaderState(['First', 'Second']);
      expect(state.getCurrentIndex()).toBe(0);

      state.prev();
      expect(state.getCurrentIndex()).toBe(0); // Still at 0
    });

    it('should reset completion state and stay at current position', () => {
      const state = new ReaderState(['First', 'Second']);
      state.next();
      state.next(); // Now completed

      let completedValue = true;
      state.subscribe((index, text, remaining, isCompleted) => {
        completedValue = isCompleted;
      });

      state.prev(); // Should reset completion
      expect(completedValue).toBe(false);
    });
  });

  describe('Navigation - goTo()', () => {
    it('should jump to specific index', () => {
      const state = new ReaderState(['First', 'Second', 'Third', 'Fourth']);
      state.goTo(2);
      expect(state.getCurrentIndex()).toBe(2);
      expect(state.getCurrentText()).toBe('Third');
    });

    it('should ignore invalid indices', () => {
      const state = new ReaderState(['First', 'Second']);
      state.goTo(-1);
      expect(state.getCurrentIndex()).toBe(0);

      state.goTo(10);
      expect(state.getCurrentIndex()).toBe(0);
    });

    it('should reset completion state when jumping', () => {
      const state = new ReaderState(['First', 'Second']);
      state.next();
      state.next(); // Completed

      let completedValue = true;
      state.subscribe((index, text, remaining, isCompleted) => {
        completedValue = isCompleted;
      });

      state.goTo(0);
      expect(completedValue).toBe(false);
    });

    it('should track viewed indices', () => {
      const state = new ReaderState(['First', 'Second', 'Third', 'Fourth']);
      state.goTo(3);
      state.goTo(1);

      const stats = state.getSessionStats();
      expect(stats.paragraphsRead).toBe(3); // 0 (initial), 3, and 1
    });
  });

  describe('Text Accessors', () => {
    it('should return current text', () => {
      const state = new ReaderState(['First', 'Second', 'Third']);
      expect(state.getCurrentText()).toBe('First');
    });

    it('should return previous text', () => {
      const state = new ReaderState(['First', 'Second', 'Third'], 1);
      expect(state.getPreviousText()).toBe('First');
    });

    it('should return null for previous when at start', () => {
      const state = new ReaderState(['First', 'Second']);
      expect(state.getPreviousText()).toBeNull();
    });

    it('should return next text', () => {
      const state = new ReaderState(['First', 'Second', 'Third']);
      expect(state.getNextText()).toBe('Second');
    });

    it('should return null for next when at end', () => {
      const state = new ReaderState(['First', 'Second'], 1);
      expect(state.getNextText()).toBeNull();
    });

    it('should handle empty paragraphs gracefully', () => {
      const state = new ReaderState([]);
      expect(state.getCurrentText()).toBe('');
      expect(state.getPreviousText()).toBeNull();
      expect(state.getNextText()).toBeNull();
    });
  });

  describe('Subscriber Pattern', () => {
    it('should call listener on subscribe with initial state', () => {
      const state = new ReaderState(['First', 'Second']);
      const listener = vi.fn();

      state.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(0, 'First', expect.any(Number), false);
    });

    it('should notify listeners on navigation', () => {
      const state = new ReaderState(['First', 'Second', 'Third']);
      const listener = vi.fn();
      state.subscribe(listener);

      listener.mockClear();
      state.next();

      expect(listener).toHaveBeenCalledWith(1, 'Second', expect.any(Number), false);
    });

    it('should support multiple listeners', () => {
      const state = new ReaderState(['First', 'Second']);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      state.subscribe(listener1);
      state.subscribe(listener2);

      listener1.mockClear();
      listener2.mockClear();
      state.next();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const state = new ReaderState(['First', 'Second']);
      const listener = vi.fn();

      const unsubscribe = state.subscribe(listener);
      listener.mockClear();

      unsubscribe();
      state.next();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should only remove the specific listener on unsubscribe', () => {
      const state = new ReaderState(['First', 'Second']);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsubscribe1 = state.subscribe(listener1);
      state.subscribe(listener2);

      listener1.mockClear();
      listener2.mockClear();

      unsubscribe1();
      state.next();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('setParagraphs()', () => {
    it('should reset state with new paragraphs', () => {
      const state = new ReaderState(['Old1', 'Old2']);
      state.next();

      state.setParagraphs(['New1', 'New2', 'New3']);

      expect(state.getTotal()).toBe(3);
      expect(state.getCurrentIndex()).toBe(0);
      expect(state.getCurrentText()).toBe('New1');
    });

    it('should reset to custom initial index', () => {
      const state = new ReaderState(['Old1', 'Old2']);
      state.setParagraphs(['New1', 'New2', 'New3'], 1);

      expect(state.getCurrentIndex()).toBe(1);
      expect(state.getCurrentText()).toBe('New2');
    });

    it('should reset completion state', () => {
      const state = new ReaderState(['A', 'B']);
      state.next();
      state.next(); // Completed

      let completedValue = true;
      state.subscribe((index, text, remaining, isCompleted) => {
        completedValue = isCompleted;
      });

      state.setParagraphs(['New1', 'New2']);
      expect(completedValue).toBe(false);
    });

    it('should reset session stats', () => {
      const state = new ReaderState(['A', 'B', 'C']);
      state.next();
      state.next();

      state.setParagraphs(['New1', 'New2']);

      const stats = state.getSessionStats();
      expect(stats.paragraphsRead).toBe(1); // Only the initial position
    });

    it('should notify listeners', () => {
      const state = new ReaderState(['Old']);
      const listener = vi.fn();
      state.subscribe(listener);
      listener.mockClear();

      state.setParagraphs(['New1', 'New2']);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Word Count and Reading Time', () => {
    it('should calculate remaining minutes correctly', () => {
      // At 225 WPM, 225 words = 1 minute
      const longParagraph = Array(225).fill('word').join(' ');
      const state = new ReaderState(['First', longParagraph]);

      const remaining = state.getRemainingMinutes();
      expect(remaining).toBe(1);
    });

    it('should return 0 when completed', () => {
      const state = new ReaderState(['First', 'Second']);
      state.next();
      state.next(); // Completed

      expect(state.getRemainingMinutes()).toBe(0);
    });

    it('should return 0 when at last paragraph', () => {
      const state = new ReaderState(['First', 'Second'], 1);
      expect(state.getRemainingMinutes()).toBe(0);
    });

    it('should calculate from current position to end', () => {
      const paragraph = Array(225).fill('word').join(' '); // 225 words = 1 minute
      const state = new ReaderState([paragraph, paragraph, paragraph]);

      // At index 0, remaining = paragraphs 1 and 2 = 2 minutes
      expect(state.getRemainingMinutes()).toBe(2);

      state.next();
      // At index 1, remaining = paragraph 2 = 1 minute
      expect(state.getRemainingMinutes()).toBe(1);
    });

    it('should round up minutes', () => {
      const shortParagraph = Array(50).fill('word').join(' '); // ~50 words
      const state = new ReaderState(['First', shortParagraph]);

      // 50/225 = ~0.22 minutes, should round up to 1
      expect(state.getRemainingMinutes()).toBe(1);
    });

    it('should handle empty text', () => {
      const state = new ReaderState(['', '', '']);
      expect(state.getRemainingMinutes()).toBe(0);
    });
  });

  describe('Session Statistics', () => {
    it('should track time spent', async () => {
      const state = new ReaderState(['A', 'B']);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const stats = state.getSessionStats();
      expect(stats.timeSpentMs).toBeGreaterThan(0);
    });

    it('should track paragraphs read', () => {
      const state = new ReaderState(['A', 'B', 'C', 'D']);

      state.next();
      state.next();
      state.prev();
      state.next();

      const stats = state.getSessionStats();
      // Viewed: 0 (initial), 1, 2 = 3 unique paragraphs
      expect(stats.paragraphsRead).toBe(3);
    });

    it('should track total paragraphs', () => {
      const state = new ReaderState(['A', 'B', 'C', 'D', 'E']);

      const stats = state.getSessionStats();
      expect(stats.totalParagraphs).toBe(5);
    });

    it('should not double-count revisited paragraphs', () => {
      const state = new ReaderState(['A', 'B', 'C']);

      state.next(); // View B
      state.prev(); // Back to A
      state.next(); // View B again
      state.next(); // View C
      state.prev(); // Back to B

      const stats = state.getSessionStats();
      expect(stats.paragraphsRead).toBe(3); // A, B, C - each counted once
    });
  });

  describe('Edge Cases', () => {
    it('should handle single paragraph', () => {
      const state = new ReaderState(['Only one']);

      expect(state.getCurrentText()).toBe('Only one');
      expect(state.getPreviousText()).toBeNull();
      expect(state.getNextText()).toBeNull();
      expect(state.getRemainingMinutes()).toBe(0);

      state.next(); // Should complete

      let completed = false;
      state.subscribe((i, t, r, c) => {
        completed = c;
      });
      expect(completed).toBe(true);
    });

    it('should handle paragraphs with special characters', () => {
      const paragraphs = [
        'Paragraph with "quotes" and \'apostrophes\'',
        'Paragraph with <html> tags & entities',
        'Paragraph with unicode: 你好世界 🎉',
      ];
      const state = new ReaderState(paragraphs);

      expect(state.getCurrentText()).toBe(paragraphs[0]);
      state.next();
      expect(state.getCurrentText()).toBe(paragraphs[1]);
      state.next();
      expect(state.getCurrentText()).toBe(paragraphs[2]);
    });

    it('should handle paragraphs with only whitespace', () => {
      const state = new ReaderState(['  ', '\t\n', '   ']);

      // Whitespace-only paragraphs still count as 1 word each (split on /\s+/)
      // 2 remaining paragraphs with 1 word each = 2 words / 225 WPM = rounds up to 1 min
      expect(state.getRemainingMinutes()).toBe(1);
    });

    it('should handle very long paragraphs', () => {
      const longText = 'word '.repeat(10000);
      const state = new ReaderState([longText, 'Short']);

      // 10000 words at 225 WPM = ~44.4 minutes, rounded up
      const remaining = state.getRemainingMinutes();
      expect(remaining).toBe(1); // Only "Short" remaining = 1 word, rounds up
    });

    it('should handle rapid navigation', () => {
      const paragraphs = Array(100)
        .fill(null)
        .map((_, i) => `Paragraph ${i}`);
      const state = new ReaderState(paragraphs);

      // Navigate rapidly
      for (let i = 0; i < 50; i++) {
        state.next();
      }

      expect(state.getCurrentIndex()).toBe(50);
      expect(state.getCurrentText()).toBe('Paragraph 50');
    });
  });

  describe('Listener Notification Details', () => {
    it('should include all parameters in notification', () => {
      const state = new ReaderState([
        'First paragraph here',
        'Second paragraph with more words here',
        'Third',
      ]);
      const listener = vi.fn();

      state.subscribe(listener);

      const call = listener.mock.calls[0];
      expect(call[0]).toBe(0); // index
      expect(call[1]).toBe('First paragraph here'); // text
      expect(typeof call[2]).toBe('number'); // remainingMinutes
      expect(call[3]).toBe(false); // isCompleted
    });

    it('should update remaining minutes as user progresses', () => {
      const words = Array(450).fill('word').join(' '); // 2 minutes worth
      const state = new ReaderState(['First', words, 'Last']);

      const remainingValues: number[] = [];
      state.subscribe((i, t, remaining) => {
        remainingValues.push(remaining);
      });

      state.next();
      state.next();

      // Should have captured different remaining values
      expect(remainingValues.length).toBe(3);
      expect(remainingValues[0]).toBeGreaterThan(remainingValues[1]);
    });
  });
});
