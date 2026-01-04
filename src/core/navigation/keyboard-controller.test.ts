import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardController } from './keyboard-controller';
import { ReaderState } from '../state/reader-state';

describe('KeyboardController', () => {
  let state: ReaderState;
  let controller: KeyboardController;

  beforeEach(() => {
    state = new ReaderState(['First', 'Second', 'Third', 'Fourth']);
    controller = new KeyboardController(state);
  });

  describe('Forward Navigation Keys', () => {
    it('should navigate next on ArrowRight', () => {
      const result = controller.handleKey('ArrowRight');

      expect(result).toBe(true);
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should navigate next on Enter', () => {
      const result = controller.handleKey('Enter');

      expect(result).toBe(true);
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should navigate next on Space', () => {
      const result = controller.handleKey(' ');

      expect(result).toBe(true);
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should navigate next on ArrowDown', () => {
      const result = controller.handleKey('ArrowDown');

      expect(result).toBe(true);
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should handle multiple forward navigations', () => {
      controller.handleKey('ArrowRight');
      controller.handleKey('Enter');
      controller.handleKey(' ');

      expect(state.getCurrentIndex()).toBe(3);
    });
  });

  describe('Backward Navigation Keys', () => {
    beforeEach(() => {
      // Start from middle position
      state.goTo(2);
    });

    it('should navigate prev on ArrowLeft', () => {
      const result = controller.handleKey('ArrowLeft');

      expect(result).toBe(true);
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should navigate prev on Backspace', () => {
      const result = controller.handleKey('Backspace');

      expect(result).toBe(true);
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should navigate prev on ArrowUp', () => {
      const result = controller.handleKey('ArrowUp');

      expect(result).toBe(true);
      expect(state.getCurrentIndex()).toBe(1);
    });

    it('should handle multiple backward navigations', () => {
      controller.handleKey('ArrowLeft');
      controller.handleKey('Backspace');

      expect(state.getCurrentIndex()).toBe(0);
    });
  });

  describe('Unhandled Keys', () => {
    it('should return false for unhandled keys', () => {
      const unhandledKeys = [
        'a',
        'b',
        'c',
        '1',
        '2',
        '3',
        'Tab',
        'Escape',
        'Delete',
        'Home',
        'End',
        'PageUp',
        'PageDown',
        'F1',
        'F12',
        'Control',
        'Alt',
        'Shift',
        'Meta',
      ];

      unhandledKeys.forEach((key) => {
        const result = controller.handleKey(key);
        expect(result).toBe(false);
      });
    });

    it('should not change state for unhandled keys', () => {
      const initialIndex = state.getCurrentIndex();

      controller.handleKey('a');
      controller.handleKey('Tab');
      controller.handleKey('Escape');

      expect(state.getCurrentIndex()).toBe(initialIndex);
    });
  });

  describe('Boundary Conditions', () => {
    it('should not go below zero', () => {
      controller.handleKey('ArrowLeft');
      controller.handleKey('Backspace');
      controller.handleKey('ArrowLeft');

      expect(state.getCurrentIndex()).toBe(0);
    });

    it('should complete at end of content', () => {
      let completed = false;
      state.subscribe((i, t, r, c) => {
        completed = c;
      });

      controller.handleKey('ArrowRight'); // 1
      controller.handleKey('ArrowRight'); // 2
      controller.handleKey('ArrowRight'); // 3
      controller.handleKey('ArrowRight'); // Complete

      expect(completed).toBe(true);
    });

    it('should not navigate forward when completed', () => {
      // Navigate to end
      for (let i = 0; i < 5; i++) {
        controller.handleKey('ArrowRight');
      }

      const index = state.getCurrentIndex();
      controller.handleKey('ArrowRight');

      expect(state.getCurrentIndex()).toBe(index);
    });

    it('should reset completion with backward navigation', () => {
      // Navigate to completion
      for (let i = 0; i < 5; i++) {
        controller.handleKey('ArrowRight');
      }

      let completed = true;
      state.subscribe((i, t, r, c) => {
        completed = c;
      });

      controller.handleKey('ArrowLeft');

      expect(completed).toBe(false);
    });
  });

  describe('Mixed Navigation', () => {
    it('should handle mixed forward and backward navigation', () => {
      controller.handleKey('ArrowRight'); // 1
      controller.handleKey('ArrowRight'); // 2
      controller.handleKey('ArrowLeft'); // 1
      controller.handleKey(' '); // 2
      controller.handleKey('Backspace'); // 1
      controller.handleKey('Enter'); // 2

      expect(state.getCurrentIndex()).toBe(2);
    });

    it('should handle rapid key presses', () => {
      for (let i = 0; i < 20; i++) {
        controller.handleKey('ArrowRight');
      }
      for (let i = 0; i < 15; i++) {
        controller.handleKey('ArrowLeft');
      }

      // Started at 0, went right 20 times (capped at 3, then completed)
      // Then went back 15 times
      expect(state.getCurrentIndex()).toBe(0);
    });
  });

  describe('Single Paragraph Edge Case', () => {
    it('should handle single paragraph content', () => {
      const singleState = new ReaderState(['Only paragraph']);
      const singleController = new KeyboardController(singleState);

      expect(singleState.getCurrentIndex()).toBe(0);

      singleController.handleKey('ArrowRight'); // Should complete

      let completed = false;
      singleState.subscribe((i, t, r, c) => {
        completed = c;
      });

      expect(completed).toBe(true);
    });
  });

  describe('Empty Content Edge Case', () => {
    it('should handle empty content', () => {
      const emptyState = new ReaderState([]);
      const emptyController = new KeyboardController(emptyState);

      // Should not throw
      expect(() => {
        emptyController.handleKey('ArrowRight');
        emptyController.handleKey('ArrowLeft');
      }).not.toThrow();
    });
  });

  describe('Key Event Simulation', () => {
    it('should work with keyboard event key property', () => {
      // Simulate how it would be called from a real event handler
      const mockKeyboardEvent = (key: string) => {
        return controller.handleKey(key);
      };

      expect(mockKeyboardEvent('ArrowRight')).toBe(true);
      expect(mockKeyboardEvent('ArrowLeft')).toBe(true);
      expect(mockKeyboardEvent('Enter')).toBe(true);
      expect(mockKeyboardEvent(' ')).toBe(true);
      expect(mockKeyboardEvent('Backspace')).toBe(true);
      expect(mockKeyboardEvent('Escape')).toBe(false);
    });
  });
});
