import * as pdfjsLib from 'pdfjs-dist';
import { PdfExtractor } from '../../core/extraction/pdf-extractor';
import { PDFReaderUI } from '../../components/reader/pdf-reader-ui';
import { ReaderState } from '../../core/state/reader-state';
import { KeyboardController } from '../../core/navigation/keyboard-controller';
import { ScrollController } from '../../core/navigation/scroll-controller';
import { ProgressStorage } from '../../features/storage/progress-storage';
import type { ParagraphMetadata, Bookmark } from '../../types';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL('/pdf.worker.min.mjs');

// DOM Elements for loading/error states
const loadingEl = document.getElementById('loading')!;
const loadingText = document.getElementById('loadingText')!;
const errorEl = document.getElementById('error')!;
const errorMessage = document.getElementById('errorMessage')!;
const retryBtn = document.getElementById('retryBtn')!;

// State
let pdfUrl = '';
let ui: PDFReaderUI | null = null;
let unsubscribe: (() => void) | null = null;

function showLoading(message: string) {
  loadingEl.style.display = 'flex';
  errorEl.style.display = 'none';
  loadingText.textContent = message;
}

function showError(message: string) {
  loadingEl.style.display = 'none';
  errorEl.style.display = 'flex';
  errorMessage.textContent = message;
}

function hideLoading() {
  loadingEl.style.display = 'none';
  errorEl.style.display = 'none';
}

function extractTitle(url: string): string {
  try {
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split('/').pop() || 'PDF Document';
    return decodeURIComponent(filename.replace('.pdf', ''));
  } catch {
    return 'PDF Document';
  }
}

async function loadPdf(url: string) {
  pdfUrl = url;
  showLoading('Loading PDF...');

  try {
    const title = extractTitle(url);

    // Load PDF document
    loadingText.textContent = 'Loading PDF document...';
    const pdfDoc = await pdfjsLib.getDocument(url).promise;

    // Extract text with positions
    const extractionResult = await PdfExtractor.extractWithPositions(url, (page, total) => {
      loadingText.textContent = `Extracting page ${page} of ${total}...`;
    });

    if (extractionResult.paragraphs.length === 0) {
      throw new Error('No text content found in PDF');
    }

    // Create paragraph text array and metadata
    const paragraphs = extractionResult.paragraphs.map((p) => p.text);
    const metadata: ParagraphMetadata[] = extractionResult.paragraphs.map((p) => ({
      pageNum: p.pageNum,
      startY: p.startY,
      endY: p.endY,
      x: p.x,
      width: p.width,
    }));

    // Create UI (wraps ReaderUI with PDF preview)
    ui = new PDFReaderUI();
    await ui.initialize(pdfDoc, extractionResult);

    // Create state and controllers
    const state = new ReaderState(paragraphs, 0);
    const keyboardController = new KeyboardController(state);
    const scrollController = new ScrollController(state);

    ui.setKeyboardController(keyboardController);
    ui.setScrollController(scrollController);
    ui.setParagraphs(title, paragraphs, metadata);

    // Apply saved preferences
    const prefs = await ProgressStorage.getPreferences();
    ui.applyPreferences(
      prefs.fontFamily,
      prefs.opacityLevel,
      prefs.fontSize,
      prefs.paragraphCount,
      prefs.paragraphSpacing
    );

    // Helper to update paragraph state
    const updateParagraphState = async (index: number, text: string) => {
      const memo = await ProgressStorage.getMemo(url, index);
      const isBookmarked = await ProgressStorage.isBookmarked(url, index);
      ui?.setCurrentParagraphState(index, text, memo?.text || '', isBookmarked);
    };

    // Initialize first paragraph state
    await updateParagraphState(0, paragraphs[0] || '');
    ui.updateMinimap(0);

    // Helper to refresh bookmarks and notes lists
    const refreshLists = async () => {
      const bookmarks = await ProgressStorage.getBookmarks();
      const notes = await ProgressStorage.getHighlightNotes(url);
      ui?.updateBookmarksList(bookmarks, url);
      ui?.updateNotesList(notes);
    };

    // Initial list refresh
    await refreshLists();

    // Setup callbacks
    ui.onMemoSave(async (paragraphIndex, text) => {
      await ProgressStorage.saveMemo(url, paragraphIndex, text);
    });

    ui.onBookmarkToggle(async (paragraphIndex, paragraphText) => {
      const isBookmarked = await ProgressStorage.isBookmarked(url, paragraphIndex);
      if (isBookmarked) {
        await ProgressStorage.removeBookmark(url, paragraphIndex);
        ui?.setBookmarkState(false);
      } else {
        const bookmark: Bookmark = {
          url,
          title,
          paragraphIndex,
          paragraphPreview: paragraphText.slice(0, 100),
          createdAt: Date.now(),
        };
        await ProgressStorage.addBookmark(bookmark);
        ui?.setBookmarkState(true);
      }
      await refreshLists();
    });

    ui.onFontChange(async (fontFamily) => {
      const currentPrefs = await ProgressStorage.getPreferences();
      await ProgressStorage.savePreferences({ ...currentPrefs, fontFamily });
    });

    ui.onOpacityChange(async (level) => {
      const currentPrefs = await ProgressStorage.getPreferences();
      await ProgressStorage.savePreferences({ ...currentPrefs, opacityLevel: level });
    });

    ui.onFontSizeChange(async (fontSize) => {
      const currentPrefs = await ProgressStorage.getPreferences();
      await ProgressStorage.savePreferences({ ...currentPrefs, fontSize });
    });

    ui.onParagraphCountChange(async (count) => {
      const currentPrefs = await ProgressStorage.getPreferences();
      await ProgressStorage.savePreferences({ ...currentPrefs, paragraphCount: count });
    });

    ui.onParagraphSpacingChange(async (spacing) => {
      const currentPrefs = await ProgressStorage.getPreferences();
      await ProgressStorage.savePreferences({ ...currentPrefs, paragraphSpacing: spacing });
    });

    ui.onHighlightNote(async (paragraphIndex, selectedText, note) => {
      await ProgressStorage.saveHighlightNote(url, paragraphIndex, selectedText, note);
      await refreshLists();
    });

    ui.onGoToParagraph((index) => {
      state.goTo(index);
    });

    // Check onboarding
    const shouldShowOnboarding = await ProgressStorage.shouldShowOnboarding();
    if (shouldShowOnboarding) {
      ui.onOnboardingComplete(async () => {
        await ProgressStorage.setOnboardingCompleted();
      });
      ui.showOnboarding();
    }

    // Subscribe to state changes
    unsubscribe = state.subscribe(async (index, text, remaining, isCompleted) => {
      if (isCompleted) {
        const stats = state.getSessionStats();
        ui?.showCompletion(stats);
      } else {
        const prevText = state.getPreviousText();
        const nextText = state.getNextText();
        const prev2Text = state.getPrev2Text();
        const next2Text = state.getNext2Text();
        await ui?.updateParagraph(text, prevText, nextText, prev2Text, next2Text);
        ui?.setTimeLeft(remaining);
        ui?.updateMinimap(index);
        await updateParagraphState(index, text);
      }
      ui?.setProgressBar(index, state.getTotal(), isCompleted);
      await ProgressStorage.saveProgress(url, index);
    });

    // Handle exit
    ui.onExitRequested(() => {
      if (unsubscribe) unsubscribe();
      ui?.unmount();
      ui = null;
      window.close();
    });

    // Mount and show
    hideLoading();
    ui.mount();
    ui.setVisible(true);
  } catch (error) {
    console.error('PDF load error:', error);
    showError(error instanceof Error ? error.message : 'Failed to load PDF');
  }
}

// Get PDF URL from query params
function getPdfUrlFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('url');
}

// Retry button
retryBtn.addEventListener('click', () => {
  if (pdfUrl) {
    loadPdf(pdfUrl);
  }
});

// Initialize
const urlFromQuery = getPdfUrlFromQuery();
if (urlFromQuery) {
  loadPdf(urlFromQuery);
} else {
  showError('No PDF URL provided. Use ?url=<pdf-url> parameter.');
}
