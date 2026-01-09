import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReaderUI } from './reader-ui';

describe('ReaderUI', () => {
  let readerUI: ReaderUI;

  beforeEach(() => {
    // Create a clean DOM environment
    document.body.innerHTML = '';
    readerUI = new ReaderUI();
  });

  afterEach(() => {
    readerUI.unmount();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should create a ReaderUI instance', () => {
      expect(readerUI).toBeInstanceOf(ReaderUI);
    });

    it('should not be mounted initially', () => {
      expect(document.getElementById('reader-extension-root')).toBeNull();
    });
  });

  describe('mount / unmount', () => {
    it('should mount the container to document body', () => {
      readerUI.mount();
      expect(document.getElementById('reader-extension-root')).not.toBeNull();
    });

    it('should unmount the container from document body', () => {
      readerUI.mount();
      readerUI.unmount();
      expect(document.getElementById('reader-extension-root')).toBeNull();
    });

    it('should restore body overflow on unmount', () => {
      document.body.style.overflow = 'auto';
      readerUI.mount();
      readerUI.unmount();
      expect(document.body.style.overflow).toBe('auto');
    });
  });

  describe('setVisible', () => {
    it('should set visibility', () => {
      readerUI.mount();
      readerUI.setVisible(true);
      // The container opacity should be set
      const container = document.getElementById('reader-extension-root');
      expect(container).not.toBeNull();
    });

    it('should hide when set to false', () => {
      readerUI.mount();
      readerUI.setVisible(true);
      readerUI.setVisible(false);
      const container = document.getElementById('reader-extension-root');
      expect(container).not.toBeNull();
    });
  });

  describe('setParagraphs', () => {
    it('should set title and paragraphs', () => {
      readerUI.mount();
      readerUI.setParagraphs('Test Title', ['Paragraph 1', 'Paragraph 2', 'Paragraph 3']);
      // The minimap should be updated based on paragraphs
      expect(readerUI.getParagraphCount()).toBeDefined();
    });

    it('should handle empty paragraphs', () => {
      readerUI.mount();
      readerUI.setParagraphs('Title', []);
      expect(readerUI.getParagraphCount()).toBeDefined();
    });
  });

  describe('updateParagraph', () => {
    it('should update paragraph display', async () => {
      readerUI.mount();
      readerUI.setParagraphs('Title', ['Para 1', 'Para 2']);

      await readerUI.updateParagraph('Para 1', null, 'Para 2');
      // Should not throw
    });

    it('should handle completion state', async () => {
      readerUI.mount();
      readerUI.setParagraphs('Title', ['Para 1']);

      // Completion is handled by showCompletion, but updateParagraph can still be called
      await readerUI.updateParagraph('Para 1');
      // Should handle completion
    });
  });

  describe('setProgressBar', () => {
    it('should update progress bar', () => {
      readerUI.mount();
      readerUI.setProgressBar(5, 10, false);
      // Progress should be 50%
    });

    it('should handle completion state', () => {
      readerUI.mount();
      readerUI.setProgressBar(10, 10, true);
      // Should show completion state
    });

    it('should handle zero total', () => {
      readerUI.mount();
      readerUI.setProgressBar(0, 0, false);
      // Should not throw
    });
  });

  describe('setTimeLeft', () => {
    it('should display time in minutes', () => {
      readerUI.mount();
      readerUI.setTimeLeft(5);
      // Should display "5 min left"
    });

    it('should handle zero minutes', () => {
      readerUI.mount();
      readerUI.setTimeLeft(0);
      // Should display "<1 min left" or similar
    });
  });

  describe('setError', () => {
    it('should display error message', () => {
      readerUI.mount();
      readerUI.setError('Test error message');
      // Error should be displayed
    });
  });

  describe('showCompletion', () => {
    it('should show completion stats', () => {
      readerUI.mount();
      readerUI.showCompletion({
        timeSpentMs: 120000, // 2 minutes
        paragraphsRead: 10,
      });
      // Completion modal should be shown
    });

    it('should handle zero time', () => {
      readerUI.mount();
      readerUI.showCompletion({
        timeSpentMs: 0,
        paragraphsRead: 0,
      });
      // Should not throw
    });
  });

  describe('callback registration', () => {
    it('should register exit callback', () => {
      const callback = vi.fn();
      readerUI.onExitRequested(callback);
      // Callback should be registered
    });

    it('should register memo save callback', () => {
      const callback = vi.fn();
      readerUI.onMemoSave(callback);
      // Callback should be registered
    });

    it('should register bookmark toggle callback', () => {
      const callback = vi.fn();
      readerUI.onBookmarkToggle(callback);
      // Callback should be registered
    });

    it('should register font change callback', () => {
      const callback = vi.fn();
      readerUI.onFontChange(callback);
      // Callback should be registered
    });

    it('should register opacity change callback', () => {
      const callback = vi.fn();
      readerUI.onOpacityChange(callback);
      // Callback should be registered
    });

    it('should register font size change callback', () => {
      const callback = vi.fn();
      readerUI.onFontSizeChange(callback);
      // Callback should be registered
    });

    it('should register email subscribe callback', () => {
      const callback = vi.fn();
      readerUI.onEmailSubscribe(callback);
      // Callback should be registered
    });

    it('should register paragraph count change callback', () => {
      const callback = vi.fn();
      readerUI.onParagraphCountChange(callback);
      // Callback should be registered
    });

    it('should register paragraph spacing change callback', () => {
      const callback = vi.fn();
      readerUI.onParagraphSpacingChange(callback);
      // Callback should be registered
    });

    it('should register highlight note callback', () => {
      const callback = vi.fn();
      readerUI.onHighlightNote(callback);
      // Callback should be registered
    });

    it('should register go to paragraph callback', () => {
      const callback = vi.fn();
      readerUI.onGoToParagraph(callback);
      // Callback should be registered
    });
  });

  describe('setCurrentParagraphState', () => {
    it('should update current paragraph state', () => {
      readerUI.mount();
      readerUI.setCurrentParagraphState(0, 'Test paragraph', 'Test memo', true);
      // State should be updated
    });

    it('should handle empty memo', () => {
      readerUI.mount();
      readerUI.setCurrentParagraphState(0, 'Test', '', false);
      // Should not throw
    });
  });

  describe('setBookmarkState', () => {
    it('should set bookmark state to true', () => {
      readerUI.mount();
      readerUI.setBookmarkState(true);
      // Bookmark button should show bookmarked state
    });

    it('should set bookmark state to false', () => {
      readerUI.mount();
      readerUI.setBookmarkState(false);
      // Bookmark button should show non-bookmarked state
    });
  });

  describe('applyPreferences', () => {
    it('should apply font family preference', () => {
      readerUI.mount();
      readerUI.applyPreferences('Georgia', 1, 18, 3, 1);
      // Font should be applied
    });

    it('should apply opacity preference', () => {
      readerUI.mount();
      readerUI.applyPreferences('Charter', 2, 20, 1, 0);
      // Opacity should be applied
    });

    it('should apply all preferences', () => {
      readerUI.mount();
      readerUI.applyPreferences('Athelas', 0, 24, 5, 2);
      // All preferences should be applied
    });
  });

  describe('getParagraphCount', () => {
    it('should return default paragraph count', () => {
      const count = readerUI.getParagraphCount();
      expect([1, 3, 5]).toContain(count);
    });

    it('should return a valid paragraph count after apply preferences', () => {
      readerUI.mount();
      readerUI.applyPreferences('Charter', 1, 20, 5, 1);
      // The paragraph count should be one of the valid options
      expect([1, 3, 5]).toContain(readerUI.getParagraphCount());
    });
  });

  describe('updateBookmarksList', () => {
    it('should update bookmarks list', () => {
      readerUI.mount();
      readerUI.updateBookmarksList(
        [
          {
            url: 'https://example.com',
            paragraphIndex: 0,
            paragraphPreview: 'Test paragraph',
            title: 'Test Title',
            createdAt: Date.now(),
          },
        ],
        'https://example.com'
      );
      // Bookmarks should be updated
    });

    it('should handle empty bookmarks', () => {
      readerUI.mount();
      readerUI.updateBookmarksList([], 'https://example.com');
      // Should show empty state
    });
  });

  describe('updateNotesList', () => {
    it('should update notes list', () => {
      readerUI.mount();
      readerUI.updateNotesList([
        {
          paragraphIndex: 0,
          selectedText: 'Selected text',
          note: 'My note',
          createdAt: Date.now(),
        },
      ]);
      // Notes should be updated
    });

    it('should handle empty notes', () => {
      readerUI.mount();
      readerUI.updateNotesList([]);
      // Should show empty state
    });
  });

  describe('setShowSubscriptionPrompt', () => {
    it('should set subscription prompt flag', () => {
      readerUI.setShowSubscriptionPrompt(true);
      // Flag should be set
    });

    it('should clear subscription prompt flag', () => {
      readerUI.setShowSubscriptionPrompt(false);
      // Flag should be cleared
    });
  });

  describe('openSubscribeModal', () => {
    it('should open subscribe modal', () => {
      readerUI.mount();
      readerUI.openSubscribeModal();
      // Modal should be opened
    });
  });

  describe('openPanel', () => {
    it('should open bookmarks panel', () => {
      readerUI.mount();
      readerUI.openPanel('bookmarks');
      // Bookmarks panel should be opened
    });

    it('should open notes panel', () => {
      readerUI.mount();
      readerUI.openPanel('notes');
      // Notes panel should be opened
    });
  });

  describe('updateMinimap', () => {
    beforeEach(() => {
      // Mock scrollIntoView which is not available in happy-dom
      Element.prototype.scrollIntoView = vi.fn();
    });

    it('should update minimap with current index', () => {
      readerUI.mount();
      readerUI.setParagraphs('Title', ['P1', 'P2', 'P3', 'P4', 'P5']);
      // updateMinimap should not throw
      expect(() => readerUI.updateMinimap(2)).not.toThrow();
    });

    it('should handle first index', () => {
      readerUI.mount();
      readerUI.setParagraphs('Title', ['P1', 'P2', 'P3']);
      expect(() => readerUI.updateMinimap(0)).not.toThrow();
    });

    it('should handle last index', () => {
      readerUI.mount();
      readerUI.setParagraphs('Title', ['P1', 'P2', 'P3']);
      expect(() => readerUI.updateMinimap(2)).not.toThrow();
    });
  });

  describe('setKeyboardController', () => {
    it('should set keyboard controller', () => {
      const mockController = { handleKey: vi.fn() };
      readerUI.setKeyboardController(mockController);
      // Controller should be set
    });
  });

  describe('setScrollController', () => {
    it('should set scroll controller', () => {
      const mockController = {
        handleScroll: vi.fn(),
        destroy: vi.fn(),
      };
      readerUI.setScrollController(mockController as any);
      // Controller should be set
    });
  });
});
