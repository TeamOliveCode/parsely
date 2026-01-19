import { ReaderUI } from '../components/reader/reader-ui';
import { SourceHighlighter } from '../components/reader/source-highlighter';
import { ArticleExtractor } from '../core/extraction/article-extractor';
import { Serializer } from '../core/extraction/serializer';
import { TextSplitter } from '../core/extraction/text-splitter';
import { ReaderState } from '../core/state/reader-state';
import { KeyboardController } from '../core/navigation/keyboard-controller';
import { ScrollController } from '../core/navigation/scroll-controller';
import { ProgressStorage } from '../features/storage/progress-storage';
import { AnalyticsTracker } from '../features/analytics/tracker';
import { EmailCollector } from '../features/subscription/email-collector';
import type { Bookmark } from '../types';

// Helper to safely execute storage operations that may fail if extension context is invalidated
async function safeStorageOp<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Extension context invalidated - silently fail
    if (error instanceof Error && error.message.includes('Extension context invalidated')) {
      return fallback;
    }
    throw error;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Prevent duplicate content script execution (Safari issue)
    const PARSELY_INITIALIZED = '__parsely_initialized__';
    if ((window as unknown as Record<string, boolean>)[PARSELY_INITIALIZED]) {
      return; // Already initialized, silently exit
    }
    (window as unknown as Record<string, boolean>)[PARSELY_INITIALIZED] = true;

    let reader: ReaderUI | null = null;
    let highlighter: SourceHighlighter | null = null;
    let unsubscribe: (() => void) | null = null;

    browser.runtime.onMessage.addListener(async (message) => {
      if (message.type === 'TOGGLE_READER') {
        if (reader) {
          if (unsubscribe) unsubscribe();
          highlighter?.unmount();
          highlighter = null;
          reader.unmount();
          reader = null;
        } else {
          reader = new ReaderUI();
          highlighter = new SourceHighlighter();

          // Mount highlighter first (behind the overlay)
          highlighter.mount();
          reader.mount();
          reader.setVisible(true);

          const article = ArticleExtractor.extract(document);
          if (article) {
            const currentUrl = window.location.href;
            const articleTitle = article.title;
            const savedIndex = await ProgressStorage.getProgress(currentUrl);
            const prefs = await ProgressStorage.getPreferences();

            // We use article.content (HTML) instead of textContent because textContent
            // strips <br> tags and merges lines, causing "mashed" paragraphs.
            // Our Serializer now handles layout-aware text extraction from the HTML.
            const paragraphs = Serializer.serialize(article.content);

            // Map paragraphs to source DOM elements for highlighting
            highlighter.mapParagraphs(paragraphs);

            // Determine starting position:
            // 1. If user has text selected, start from that paragraph
            // 2. If saved progress exists, use that
            // 3. Otherwise, start from beginning
            let startingIndex = savedIndex ?? 0;
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();
            if (selectedText && selectedText.length > 0) {
              const selectionIndex = highlighter.findParagraphBySelection(selectedText);
              if (selectionIndex !== null) {
                startingIndex = selectionIndex;
              }
            }

            const state = new ReaderState(paragraphs, startingIndex);
            const controller = new KeyboardController(state);
            const scrollController = new ScrollController(state);

            reader.setKeyboardController(controller);
            reader.setScrollController(scrollController);
            reader.setParagraphs(articleTitle, paragraphs);

            // Apply saved preferences
            reader.applyPreferences(
              prefs.fontFamily,
              prefs.opacityLevel,
              prefs.fontSize,
              prefs.paragraphCount,
              prefs.paragraphSpacing
            );

            // Track daily/weekly active user and reader open
            AnalyticsTracker.trackActivity();
            AnalyticsTracker.trackOpen(currentUrl, articleTitle, paragraphs.length);

            // Initialize with starting position
            reader.updateMinimap(startingIndex);
            highlighter.highlight(startingIndex);

            // Helper to update paragraph state (memo + bookmark)
            const updateParagraphState = async (index: number, text: string) => {
              const memo = await ProgressStorage.getMemo(currentUrl, index);
              const isBookmarked = await ProgressStorage.isBookmarked(currentUrl, index);
              reader?.setCurrentParagraphState(index, text, memo?.text || '', isBookmarked);
            };

            // Initialize first paragraph state
            await updateParagraphState(startingIndex, paragraphs[startingIndex] || '');

            // Helper to refresh bookmarks and notes lists
            const refreshLists = async () => {
              const bookmarks = await safeStorageOp(() => ProgressStorage.getBookmarks(), []);
              const notes = await safeStorageOp(
                () => ProgressStorage.getHighlightNotes(currentUrl),
                []
              );
              reader?.updateBookmarksList(bookmarks, currentUrl);
              reader?.updateNotesList(notes);
            };

            // Setup memo callback
            reader.onMemoSave(async (paragraphIndex, text) => {
              await ProgressStorage.saveMemo(currentUrl, paragraphIndex, text);
              AnalyticsTracker.trackFeature('memo');
            });

            // Setup bookmark callback
            reader.onBookmarkToggle(async (paragraphIndex, paragraphText) => {
              const isBookmarked = await safeStorageOp(
                () => ProgressStorage.isBookmarked(currentUrl, paragraphIndex),
                false
              );
              if (isBookmarked) {
                await safeStorageOp(
                  () => ProgressStorage.removeBookmark(currentUrl, paragraphIndex),
                  undefined
                );
                reader?.setBookmarkState(false);
              } else {
                const bookmark: Bookmark = {
                  url: currentUrl,
                  title: articleTitle,
                  paragraphIndex,
                  paragraphPreview: paragraphText.slice(0, 100),
                  createdAt: Date.now(),
                };
                await safeStorageOp(() => ProgressStorage.addBookmark(bookmark), undefined);
                reader?.setBookmarkState(true);
                AnalyticsTracker.trackFeature('bookmark');
              }
              // Refresh bookmarks list
              await refreshLists();
            });

            // Setup font change callback
            reader.onFontChange(async (fontFamily) => {
              await ProgressStorage.savePreferences({ fontFamily });
              AnalyticsTracker.trackFeature('font_change');
            });

            // Setup opacity change callback
            reader.onOpacityChange(async (level) => {
              await ProgressStorage.savePreferences({ opacityLevel: level });
            });

            // Setup font size change callback
            reader.onFontSizeChange(async (fontSize) => {
              await ProgressStorage.savePreferences({ fontSize });
            });

            // Setup paragraph count change callback
            reader.onParagraphCountChange(async (count) => {
              await ProgressStorage.savePreferences({ paragraphCount: count });
            });

            // Setup paragraph spacing change callback
            reader.onParagraphSpacingChange(async (spacing) => {
              await ProgressStorage.savePreferences({ paragraphSpacing: spacing });
            });

            // Setup email subscription callback
            reader.onEmailSubscribe(async (email) => {
              const result = await EmailCollector.subscribe(email);
              if (result.success) {
                await ProgressStorage.setSubscribed();
                AnalyticsTracker.trackFeature('email_subscribe');
              }
              return result;
            });

            // Setup highlight note callback
            reader.onHighlightNote(async (paragraphIndex, selectedText, note) => {
              await safeStorageOp(
                () =>
                  ProgressStorage.saveHighlightNote(currentUrl, paragraphIndex, selectedText, note),
                undefined
              );
              // Refresh notes list
              await refreshLists();
              AnalyticsTracker.trackFeature('highlight_note');
            });

            // Setup go to paragraph callback
            reader.onGoToParagraph((index) => {
              state.goTo(index);
            });

            // Initial load of bookmarks and notes
            await refreshLists();

            // Check if we should show subscription prompt and increment use count
            const shouldShowPrompt = await ProgressStorage.shouldShowSubscriptionPrompt();
            reader.setShowSubscriptionPrompt(shouldShowPrompt);
            await ProgressStorage.incrementUseCount();

            // Show onboarding for first-time users
            const shouldShowOnboarding = await ProgressStorage.shouldShowOnboarding();
            if (shouldShowOnboarding) {
              reader.onOnboardingComplete(async () => {
                await ProgressStorage.setOnboardingCompleted();
              });
              reader.showOnboarding();
            }

            // Link state to UI and Storage
            unsubscribe = state.subscribe(async (index, text, remaining, isCompleted) => {
              if (isCompleted) {
                const stats = state.getSessionStats();
                reader?.showCompletion(stats);
                highlighter?.hide();
                // Track session completion
                AnalyticsTracker.trackSession(
                  currentUrl,
                  Math.round(stats.timeSpentMs / 1000),
                  stats.paragraphsRead,
                  paragraphs.length
                );
                // Show subscription prompt after completion (with delay)
                setTimeout(() => {
                  reader?.openSubscribeModal();
                }, 2000);
              } else {
                const prevText = state.getPreviousText();
                const nextText = state.getNextText();
                const prev2Text = state.getPrev2Text();
                const next2Text = state.getNext2Text();
                reader?.updateParagraph(text, prevText, nextText, prev2Text, next2Text);
                reader?.setTimeLeft(remaining);
                reader?.updateMinimap(index);
                highlighter?.highlight(index);
                await updateParagraphState(index, text);
              }
              reader?.setProgressBar(index, state.getTotal(), isCompleted);
              ProgressStorage.saveProgress(currentUrl, index);
            });
          } else {
            reader.setError('Text not found');
            setTimeout(() => {
              if (reader) {
                highlighter?.unmount();
                highlighter = null;
                reader.unmount();
                reader = null;
              }
            }, 1000);
          }

          // Handle exit from ESC key inside ReaderUI
          reader.onExitRequested(() => {
            if (unsubscribe) unsubscribe();
            highlighter?.unmount();
            highlighter = null;
            reader?.unmount();
            reader = null;
          });
        }
      }

      // Handle reading selected text from context menu
      if (message.type === 'READ_SELECTION') {
        // Get selection from the page
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();

        if (!selectedText) {
          return;
        }

        // Close existing reader if open
        if (reader) {
          if (unsubscribe) unsubscribe();
          highlighter?.unmount();
          highlighter = null;
          reader.unmount();
          reader = null;
        }

        // Try to extract HTML and use Serializer for better paragraph splitting
        let paragraphs: string[] = [];

        try {
          // Clone the range contents to get the HTML
          const fragment = range.cloneContents();
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(fragment);
          const html = tempDiv.innerHTML;

          // Try Serializer first (HTML-aware paragraphing)
          if (html && html.trim()) {
            paragraphs = Serializer.serialize(html);
          }
        } catch {
          // If HTML extraction fails, fall back to text
        }

        // Fall back to TextSplitter if Serializer didn't work
        if (paragraphs.length === 0) {
          paragraphs = TextSplitter.split(selectedText);
        }

        if (paragraphs.length === 0) {
          return;
        }

        reader = new ReaderUI();
        // No highlighter for selected text
        reader.mount();
        reader.setVisible(true);

        const prefs = await ProgressStorage.getPreferences();

        const state = new ReaderState(paragraphs, 0);
        const controller = new KeyboardController(state);
        const scrollController = new ScrollController(state);

        reader.setKeyboardController(controller);
        reader.setScrollController(scrollController);
        reader.setParagraphs('Selected Text', paragraphs);

        // Apply saved preferences
        reader.applyPreferences(
          prefs.fontFamily,
          prefs.opacityLevel,
          prefs.fontSize,
          prefs.paragraphCount,
          prefs.paragraphSpacing
        );

        // Initialize
        reader.updateMinimap(0);

        // Setup preference callbacks (no saving progress for selected text)
        reader.onFontChange(async (fontFamily) => {
          await ProgressStorage.savePreferences({ fontFamily });
        });

        reader.onOpacityChange(async (level) => {
          await ProgressStorage.savePreferences({ opacityLevel: level });
        });

        reader.onFontSizeChange(async (fontSize) => {
          await ProgressStorage.savePreferences({ fontSize });
        });

        reader.onParagraphCountChange(async (count) => {
          await ProgressStorage.savePreferences({ paragraphCount: count });
        });

        reader.onParagraphSpacingChange(async (spacing) => {
          await ProgressStorage.savePreferences({ paragraphSpacing: spacing });
        });

        // Link state to UI
        unsubscribe = state.subscribe(async (index, text, remaining, isCompleted) => {
          if (isCompleted) {
            const stats = state.getSessionStats();
            reader?.showCompletion(stats);
          } else {
            const prevText = state.getPreviousText();
            const nextText = state.getNextText();
            const prev2Text = state.getPrev2Text();
            const next2Text = state.getNext2Text();
            reader?.updateParagraph(text, prevText, nextText, prev2Text, next2Text);
            reader?.setTimeLeft(remaining);
            reader?.updateMinimap(index);
          }
          reader?.setProgressBar(index, state.getTotal(), isCompleted);
        });

        // Handle exit
        reader.onExitRequested(() => {
          if (unsubscribe) unsubscribe();
          reader?.unmount();
          reader = null;
        });
      }
    });
  },
});
