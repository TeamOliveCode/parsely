import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressStorage } from './progress-storage';

// Mock browser.storage.local
const mockStorage: Record<string, unknown> = {};
const mockBrowser = {
  storage: {
    local: {
      get: vi.fn((key: string) => {
        if (typeof key === 'string') {
          return Promise.resolve({ [key]: mockStorage[key] });
        }
        return Promise.resolve(mockStorage);
      }),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
    },
  },
};

vi.stubGlobal('browser', mockBrowser);

describe('ProgressStorage', () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe('saveProgress / getProgress', () => {
    it('should save and retrieve progress', async () => {
      await ProgressStorage.saveProgress('https://example.com/article', 5);

      const progress = await ProgressStorage.getProgress('https://example.com/article');
      expect(progress).toBe(5);
    });

    it('should return null for non-existent progress', async () => {
      const progress = await ProgressStorage.getProgress('https://nonexistent.com');
      expect(progress).toBeNull();
    });

    it('should overwrite existing progress', async () => {
      await ProgressStorage.saveProgress('https://example.com', 3);
      await ProgressStorage.saveProgress('https://example.com', 10);

      const progress = await ProgressStorage.getProgress('https://example.com');
      expect(progress).toBe(10);
    });

    it('should handle progress of 0', async () => {
      await ProgressStorage.saveProgress('https://example.com', 0);

      const progress = await ProgressStorage.getProgress('https://example.com');
      expect(progress).toBe(0);
    });
  });

  describe('Memos', () => {
    const testUrl = 'https://example.com/article';

    it('should save and retrieve a memo', async () => {
      await ProgressStorage.saveMemo(testUrl, 0, 'This is a test memo');

      const memo = await ProgressStorage.getMemo(testUrl, 0);
      expect(memo).not.toBeNull();
      expect(memo?.text).toBe('This is a test memo');
      expect(memo?.paragraphIndex).toBe(0);
    });

    it('should get all memos for a URL', async () => {
      await ProgressStorage.saveMemo(testUrl, 0, 'Memo 1');
      await ProgressStorage.saveMemo(testUrl, 2, 'Memo 2');
      await ProgressStorage.saveMemo(testUrl, 5, 'Memo 3');

      const memos = await ProgressStorage.getMemos(testUrl);
      expect(memos).toHaveLength(3);
    });

    it('should update existing memo', async () => {
      await ProgressStorage.saveMemo(testUrl, 0, 'Original');
      await ProgressStorage.saveMemo(testUrl, 0, 'Updated');

      const memo = await ProgressStorage.getMemo(testUrl, 0);
      expect(memo?.text).toBe('Updated');

      const memos = await ProgressStorage.getMemos(testUrl);
      expect(memos).toHaveLength(1);
    });

    it('should delete memo when saving empty text', async () => {
      await ProgressStorage.saveMemo(testUrl, 0, 'To be deleted');
      await ProgressStorage.saveMemo(testUrl, 0, '');

      const memo = await ProgressStorage.getMemo(testUrl, 0);
      expect(memo).toBeNull();
    });

    it('should return null for non-existent memo', async () => {
      const memo = await ProgressStorage.getMemo(testUrl, 999);
      expect(memo).toBeNull();
    });

    it('should return empty array for URL with no memos', async () => {
      const memos = await ProgressStorage.getMemos('https://no-memos.com');
      expect(memos).toEqual([]);
    });
  });

  describe('Bookmarks', () => {
    it('should add and retrieve a bookmark', async () => {
      const bookmark = {
        url: 'https://example.com',
        paragraphIndex: 5,
        paragraphPreview: 'Test paragraph',
        title: 'Test Article',
        createdAt: Date.now(),
      };

      await ProgressStorage.addBookmark(bookmark);

      const bookmarks = await ProgressStorage.getBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].url).toBe('https://example.com');
    });

    it('should check if paragraph is bookmarked', async () => {
      await ProgressStorage.addBookmark({
        url: 'https://example.com',
        paragraphIndex: 3,
        paragraphPreview: 'Text',
        title: 'Title',
        createdAt: Date.now(),
      });

      expect(await ProgressStorage.isBookmarked('https://example.com', 3)).toBe(true);
      expect(await ProgressStorage.isBookmarked('https://example.com', 5)).toBe(false);
      expect(await ProgressStorage.isBookmarked('https://other.com', 3)).toBe(false);
    });

    it('should remove a bookmark', async () => {
      await ProgressStorage.addBookmark({
        url: 'https://example.com',
        paragraphIndex: 2,
        paragraphPreview: 'Text',
        title: 'Title',
        createdAt: Date.now(),
      });

      await ProgressStorage.removeBookmark('https://example.com', 2);

      expect(await ProgressStorage.isBookmarked('https://example.com', 2)).toBe(false);
    });

    it('should update existing bookmark', async () => {
      const original = {
        url: 'https://example.com',
        paragraphIndex: 1,
        paragraphPreview: 'Original',
        title: 'Title',
        createdAt: Date.now(),
      };

      const updated = {
        ...original,
        paragraphPreview: 'Updated',
      };

      await ProgressStorage.addBookmark(original);
      await ProgressStorage.addBookmark(updated);

      const bookmarks = await ProgressStorage.getBookmarks();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].paragraphPreview).toBe('Updated');
    });
  });

  describe('Highlight Notes', () => {
    const testUrl = 'https://example.com';

    it('should save and retrieve highlight notes', async () => {
      await ProgressStorage.saveHighlightNote(testUrl, 0, 'selected text', 'my note');

      const notes = await ProgressStorage.getHighlightNotes(testUrl);
      expect(notes).toHaveLength(1);
      expect(notes[0].selectedText).toBe('selected text');
      expect(notes[0].note).toBe('my note');
    });

    it('should update existing highlight note', async () => {
      await ProgressStorage.saveHighlightNote(testUrl, 0, 'text', 'original note');
      await ProgressStorage.saveHighlightNote(testUrl, 0, 'text', 'updated note');

      const notes = await ProgressStorage.getHighlightNotes(testUrl);
      expect(notes).toHaveLength(1);
      expect(notes[0].note).toBe('updated note');
    });

    it('should delete note when saving empty text', async () => {
      await ProgressStorage.saveHighlightNote(testUrl, 0, 'text', 'to delete');
      await ProgressStorage.saveHighlightNote(testUrl, 0, 'text', '');

      const notes = await ProgressStorage.getHighlightNotes(testUrl);
      expect(notes).toHaveLength(0);
    });

    it('should delete highlight note', async () => {
      await ProgressStorage.saveHighlightNote(testUrl, 0, 'text', 'note');
      await ProgressStorage.deleteHighlightNote(testUrl, 0, 'text');

      const notes = await ProgressStorage.getHighlightNotes(testUrl);
      expect(notes).toHaveLength(0);
    });
  });

  describe('Preferences', () => {
    it('should return default preferences', async () => {
      const prefs = await ProgressStorage.getPreferences();

      expect(prefs.fontFamily).toBe('Charter');
      expect(prefs.fontSize).toBe(21);
      expect(prefs.opacityLevel).toBe(1);
      expect(prefs.paragraphCount).toBe(3);
      expect(prefs.paragraphSpacing).toBe(1);
    });

    it('should save and merge preferences', async () => {
      await ProgressStorage.savePreferences({ fontSize: 24 });

      const prefs = await ProgressStorage.getPreferences();
      expect(prefs.fontSize).toBe(24);
      expect(prefs.fontFamily).toBe('Charter'); // Default preserved
    });

    it('should save multiple preferences', async () => {
      await ProgressStorage.savePreferences({
        fontSize: 18,
        fontFamily: 'Arial',
        opacityLevel: 0.8,
      });

      const prefs = await ProgressStorage.getPreferences();
      expect(prefs.fontSize).toBe(18);
      expect(prefs.fontFamily).toBe('Arial');
      expect(prefs.opacityLevel).toBe(0.8);
    });
  });

  describe('Subscription', () => {
    it('should return default subscription status', async () => {
      const status = await ProgressStorage.getSubscriptionStatus();

      expect(status.useCount).toBe(0);
      expect(status.hasSubscribed).toBe(false);
    });

    it('should increment use count', async () => {
      await ProgressStorage.incrementUseCount();
      await ProgressStorage.incrementUseCount();
      await ProgressStorage.incrementUseCount();

      const status = await ProgressStorage.getSubscriptionStatus();
      expect(status.useCount).toBe(3);
    });

    it('should set subscribed status', async () => {
      await ProgressStorage.setSubscribed();

      const status = await ProgressStorage.getSubscriptionStatus();
      expect(status.hasSubscribed).toBe(true);
    });

    it('should set dismissed timestamp', async () => {
      const before = Date.now();
      await ProgressStorage.setDismissed();
      const after = Date.now();

      const status = await ProgressStorage.getSubscriptionStatus();
      expect(status.dismissedAt).toBeGreaterThanOrEqual(before);
      expect(status.dismissedAt).toBeLessThanOrEqual(after);
    });

    describe('shouldShowSubscriptionPrompt', () => {
      it('should not show on first 2 uses', async () => {
        await ProgressStorage.incrementUseCount();
        expect(await ProgressStorage.shouldShowSubscriptionPrompt()).toBe(false);

        await ProgressStorage.incrementUseCount();
        expect(await ProgressStorage.shouldShowSubscriptionPrompt()).toBe(false);
      });

      it('should show on 3rd use', async () => {
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();

        expect(await ProgressStorage.shouldShowSubscriptionPrompt()).toBe(true);
      });

      it('should not show if already subscribed', async () => {
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.setSubscribed();

        expect(await ProgressStorage.shouldShowSubscriptionPrompt()).toBe(false);
      });

      it('should not show if recently dismissed', async () => {
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.setDismissed();

        expect(await ProgressStorage.shouldShowSubscriptionPrompt()).toBe(false);
      });

      it('should show again after 7 days from dismissal', async () => {
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();
        await ProgressStorage.incrementUseCount();

        // Set dismissed 8 days ago
        const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
        mockStorage['reader_subscription'] = {
          useCount: 3,
          hasSubscribed: false,
          dismissedAt: eightDaysAgo,
        };

        expect(await ProgressStorage.shouldShowSubscriptionPrompt()).toBe(true);
      });
    });
  });
});
