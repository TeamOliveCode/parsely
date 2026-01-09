import type {
  Memo,
  Bookmark,
  HighlightNote,
  UserPreferences,
  SubscriptionStatus,
  OnboardingStatus,
} from '../../types';

export class ProgressStorage {
  private static readonly KEY_PREFIX = 'reader_progress:';
  private static readonly MEMO_PREFIX = 'reader_memos:';
  private static readonly NOTES_PREFIX = 'reader_notes:';
  private static readonly BOOKMARKS_KEY = 'reader_bookmarks';
  private static readonly PREFS_KEY = 'reader_preferences';
  private static readonly SUBSCRIPTION_KEY = 'reader_subscription';
  private static readonly ONBOARDING_KEY = 'reader_onboarding';

  public static async saveProgress(url: string, index: number): Promise<void> {
    const key = this.getKey(url);
    await browser.storage.local.set({ [key]: index });
  }

  public static async getProgress(url: string): Promise<number | null> {
    const key = this.getKey(url);
    const result = await browser.storage.local.get(key);
    const progress = result[key];
    return typeof progress === 'number' ? progress : null;
  }

  // Memo functions
  public static async saveMemo(url: string, paragraphIndex: number, text: string): Promise<void> {
    const memos = await this.getMemos(url);
    const existingIndex = memos.findIndex((m) => m.paragraphIndex === paragraphIndex);

    if (text.trim()) {
      const memo: Memo = { paragraphIndex, text, createdAt: Date.now() };
      if (existingIndex >= 0) {
        memos[existingIndex] = memo;
      } else {
        memos.push(memo);
      }
    } else if (existingIndex >= 0) {
      memos.splice(existingIndex, 1);
    }

    const key = `${this.MEMO_PREFIX}${url}`;
    await browser.storage.local.set({ [key]: memos });
  }

  public static async getMemos(url: string): Promise<Memo[]> {
    const key = `${this.MEMO_PREFIX}${url}`;
    const result = await browser.storage.local.get(key);
    return (result[key] as Memo[]) || [];
  }

  public static async getMemo(url: string, paragraphIndex: number): Promise<Memo | null> {
    const memos = await this.getMemos(url);
    return memos.find((m) => m.paragraphIndex === paragraphIndex) || null;
  }

  // Bookmark functions
  public static async addBookmark(bookmark: Bookmark): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const existingIndex = bookmarks.findIndex(
      (b) => b.url === bookmark.url && b.paragraphIndex === bookmark.paragraphIndex
    );

    if (existingIndex >= 0) {
      bookmarks[existingIndex] = bookmark;
    } else {
      bookmarks.push(bookmark);
    }

    await browser.storage.local.set({ [this.BOOKMARKS_KEY]: bookmarks });
  }

  public static async removeBookmark(url: string, paragraphIndex: number): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const filtered = bookmarks.filter(
      (b) => !(b.url === url && b.paragraphIndex === paragraphIndex)
    );
    await browser.storage.local.set({ [this.BOOKMARKS_KEY]: filtered });
  }

  public static async getBookmarks(): Promise<Bookmark[]> {
    const result = await browser.storage.local.get(this.BOOKMARKS_KEY);
    return (result[this.BOOKMARKS_KEY] as Bookmark[]) || [];
  }

  public static async isBookmarked(url: string, paragraphIndex: number): Promise<boolean> {
    const bookmarks = await this.getBookmarks();
    return bookmarks.some((b) => b.url === url && b.paragraphIndex === paragraphIndex);
  }

  // Highlight notes functions
  public static async saveHighlightNote(
    url: string,
    paragraphIndex: number,
    selectedText: string,
    note: string
  ): Promise<void> {
    const notes = await this.getHighlightNotes(url);
    const existingIndex = notes.findIndex(
      (n) => n.paragraphIndex === paragraphIndex && n.selectedText === selectedText
    );

    if (note.trim()) {
      const highlightNote: HighlightNote = {
        paragraphIndex,
        selectedText,
        note,
        createdAt: Date.now(),
      };
      if (existingIndex >= 0) {
        notes[existingIndex] = highlightNote;
      } else {
        notes.push(highlightNote);
      }
    } else if (existingIndex >= 0) {
      // Empty note means delete
      notes.splice(existingIndex, 1);
    }

    const key = `${this.NOTES_PREFIX}${url}`;
    await browser.storage.local.set({ [key]: notes });
  }

  public static async getHighlightNotes(url: string): Promise<HighlightNote[]> {
    const key = `${this.NOTES_PREFIX}${url}`;
    const result = await browser.storage.local.get(key);
    return (result[key] as HighlightNote[]) || [];
  }

  public static async deleteHighlightNote(
    url: string,
    paragraphIndex: number,
    selectedText: string
  ): Promise<void> {
    const notes = await this.getHighlightNotes(url);
    const filtered = notes.filter(
      (n) => !(n.paragraphIndex === paragraphIndex && n.selectedText === selectedText)
    );
    const key = `${this.NOTES_PREFIX}${url}`;
    await browser.storage.local.set({ [key]: filtered });
  }

  // Preferences functions
  public static async savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
    const current = await this.getPreferences();
    const updated = { ...current, ...prefs };
    await browser.storage.local.set({ [this.PREFS_KEY]: updated });
  }

  public static async getPreferences(): Promise<UserPreferences> {
    const result = await browser.storage.local.get(this.PREFS_KEY);
    const defaults: UserPreferences = {
      fontFamily: 'Charter',
      opacityLevel: 1,
      fontSize: 21,
      paragraphCount: 3,
      paragraphSpacing: 1,
    };
    return { ...defaults, ...(result[this.PREFS_KEY] as Partial<UserPreferences>) };
  }

  private static getKey(url: string): string {
    return `${this.KEY_PREFIX}${url}`;
  }

  // Subscription functions
  public static async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const result = await browser.storage.local.get(this.SUBSCRIPTION_KEY);
    return (
      (result[this.SUBSCRIPTION_KEY] as SubscriptionStatus) || { useCount: 0, hasSubscribed: false }
    );
  }

  public static async incrementUseCount(): Promise<number> {
    const status = await this.getSubscriptionStatus();
    status.useCount += 1;
    await browser.storage.local.set({ [this.SUBSCRIPTION_KEY]: status });
    return status.useCount;
  }

  public static async setSubscribed(): Promise<void> {
    const status = await this.getSubscriptionStatus();
    status.hasSubscribed = true;
    await browser.storage.local.set({ [this.SUBSCRIPTION_KEY]: status });
  }

  public static async setDismissed(): Promise<void> {
    const status = await this.getSubscriptionStatus();
    status.dismissedAt = Date.now();
    await browser.storage.local.set({ [this.SUBSCRIPTION_KEY]: status });
  }

  /**
   * Check if we should show the subscription prompt
   * Shows on 3rd use if not subscribed and not recently dismissed
   */
  public static async shouldShowSubscriptionPrompt(): Promise<boolean> {
    const status = await this.getSubscriptionStatus();

    // Already subscribed
    if (status.hasSubscribed) return false;

    // Show on 3rd use and beyond
    if (status.useCount < 3) return false;

    // If dismissed, wait 7 days before showing again
    if (status.dismissedAt) {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - status.dismissedAt < sevenDays) return false;
    }

    return true;
  }

  // Onboarding functions
  public static async getOnboardingStatus(): Promise<OnboardingStatus> {
    const result = await browser.storage.local.get(this.ONBOARDING_KEY);
    return (
      (result[this.ONBOARDING_KEY] as OnboardingStatus) || { hasSeenOnboarding: false }
    );
  }

  public static async setOnboardingCompleted(): Promise<void> {
    const status: OnboardingStatus = {
      hasSeenOnboarding: true,
      completedAt: Date.now(),
    };
    await browser.storage.local.set({ [this.ONBOARDING_KEY]: status });
  }

  public static async shouldShowOnboarding(): Promise<boolean> {
    const status = await this.getOnboardingStatus();
    return !status.hasSeenOnboarding;
  }
}
