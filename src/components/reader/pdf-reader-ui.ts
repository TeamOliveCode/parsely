import * as pdfjsLib from 'pdfjs-dist';
import { ReaderUI } from './reader-ui';
import type { ExtractionResult, ParagraphInfo } from '../../core/extraction/pdf-extractor';
import type { ScrollController } from '../../core/navigation/scroll-controller';
import type { KeyboardController } from '../../core/navigation/keyboard-controller';
import type {
  ParagraphMetadata,
  MemoCallback,
  BookmarkCallback,
  FontChangeCallback,
  OpacityChangeCallback,
  FontSizeChangeCallback,
  ParagraphCountChangeCallback,
  ParagraphSpacingChangeCallback,
  EmailSubscribeCallback,
  HighlightNoteCallback,
  GoToParagraphCallback,
  Bookmark,
  HighlightNote,
} from '../../types';

/**
 * PDFReaderUI - Wraps ReaderUI to add PDF-specific features
 *
 * This component uses composition to extend ReaderUI with:
 * - PDF page canvas rendering
 * - Highlight overlay showing reading position
 * - Page indicator
 */
export class PDFReaderUI {
  private readerUI: ReaderUI;
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private extractionResult: ExtractionResult | null = null;
  private paragraphs: ParagraphInfo[] = [];
  private currentRenderedPage: number = 0;

  // PDF-specific elements (created in slot)
  private previewContainer: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;
  private pageIndicator: HTMLDivElement | null = null;

  constructor() {
    this.readerUI = new ReaderUI();
  }

  /**
   * Initialize with PDF document and extraction result
   */
  public async initialize(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    extractionResult: ExtractionResult
  ): Promise<void> {
    this.pdfDoc = pdfDoc;
    this.extractionResult = extractionResult;
    this.paragraphs = extractionResult.paragraphs;

    // Inject PDF preview into the left slot
    const slot = this.readerUI.getExtensionSlot('left');
    if (slot) {
      slot.innerHTML = this.getPdfPreviewHTML();
      this.setupPdfElements(slot);
      this.injectPdfStyles(slot);
    }

    // Listen for paragraph changes to update PDF preview
    this.readerUI.onParagraphChange(async (index, metadata) => {
      await this.updatePdfPreview(index, metadata);
    });
  }

  private getPdfPreviewHTML(): string {
    return `
      <div class="pdf-preview-container">
        <div class="pdf-preview-wrapper">
          <canvas class="pdf-canvas"></canvas>
          <div class="pdf-highlight-overlay"></div>
        </div>
        <div class="pdf-page-indicator">Page 1</div>
      </div>
    `;
  }

  private injectPdfStyles(slot: HTMLElement): void {
    const style = document.createElement('style');
    style.textContent = `
      .pdf-preview-container {
        width: 320px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      .pdf-preview-wrapper {
        position: relative;
        max-height: 60vh;
        overflow-y: auto;
        padding: 16px;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .pdf-preview-wrapper::-webkit-scrollbar {
        display: none;
      }
      .pdf-canvas {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 4px;
      }
      .pdf-highlight-overlay {
        position: absolute;
        background: rgba(0, 255, 159, 0.15);
        border: 2px solid rgba(0, 255, 159, 0.6);
        border-radius: 4px;
        pointer-events: none;
        transition: all 0.2s ease;
        display: none;
      }
      .pdf-page-indicator {
        text-align: center;
        padding: 8px;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
    `;
    slot.appendChild(style);
  }

  private setupPdfElements(slot: HTMLElement): void {
    this.previewContainer = slot.querySelector('.pdf-preview-container');
    this.canvas = slot.querySelector('.pdf-canvas');
    this.highlightOverlay = slot.querySelector('.pdf-highlight-overlay');
    this.pageIndicator = slot.querySelector('.pdf-page-indicator');
  }

  private async updatePdfPreview(
    index: number,
    metadata: ParagraphMetadata | null
  ): Promise<void> {
    if (!metadata?.pageNum || !this.pdfDoc) return;

    await this.renderPdfPage(metadata.pageNum);
    this.updateHighlight(index);

    // Update page indicator
    if (this.pageIndicator) {
      this.pageIndicator.textContent = `Page ${metadata.pageNum}`;
    }
  }

  private async renderPdfPage(pageNum: number): Promise<void> {
    if (!this.pdfDoc || !this.canvas || !this.extractionResult) return;
    if (pageNum === this.currentRenderedPage) return;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const ctx = this.canvas.getContext('2d');
      if (!ctx) return;

      // Scale to fit container
      const containerWidth = this.canvas.parentElement?.clientWidth || 300;
      const scale = containerWidth / this.extractionResult.pageWidth;
      const viewport = page.getViewport({ scale });

      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas: this.canvas,
      }).promise;

      this.currentRenderedPage = pageNum;
    } catch (err) {
      console.error('Failed to render PDF page:', err);
    }
  }

  private updateHighlight(index: number): void {
    if (!this.highlightOverlay || !this.canvas || !this.extractionResult) return;

    const currentPara = this.paragraphs[index];
    if (!currentPara) return;

    // Calculate canvas scale
    const scale = this.canvas.width / this.extractionResult.pageWidth;

    // PDF coordinate system: Y is inverted (bottom to top)
    const pageHeight = this.extractionResult.pageHeight;
    const startY = (pageHeight - currentPara.startY) * scale;
    const endY = (pageHeight - currentPara.endY) * scale;
    const height = Math.max(Math.abs(endY - startY), 20) + 10;

    // Calculate width (use default if 0)
    const paraWidth =
      currentPara.width > 0
        ? currentPara.width * scale
        : this.extractionResult.pageWidth * 0.4 * scale;

    // Position relative to wrapper padding
    const wrapperPadding = 16;
    const topPosition = Math.min(startY, endY) - 5 + wrapperPadding;
    const leftPosition = currentPara.x * scale + wrapperPadding;

    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.top = `${topPosition}px`;
    this.highlightOverlay.style.left = `${leftPosition}px`;
    this.highlightOverlay.style.width = `${paraWidth + 10}px`;
    this.highlightOverlay.style.height = `${height}px`;

    // Scroll highlight into view
    const wrapper = this.canvas.parentElement;
    if (wrapper) {
      const highlightCenter = topPosition + height / 2;
      const wrapperHeight = wrapper.clientHeight;
      const scrollTarget = highlightCenter - wrapperHeight / 2;
      wrapper.scrollTo({ top: scrollTarget, behavior: 'smooth' });
    }
  }

  // ========================================
  // Delegate all ReaderUI methods
  // ========================================

  public mount(): void {
    this.readerUI.mount();
  }

  public unmount(): void {
    this.readerUI.unmount();
  }

  public setVisible(visible: boolean): void {
    this.readerUI.setVisible(visible);
  }

  public setKeyboardController(controller: KeyboardController): void {
    this.readerUI.setKeyboardController(controller);
  }

  public setScrollController(controller: ScrollController): void {
    this.readerUI.setScrollController(controller);
  }

  public setParagraphs(
    title: string,
    paragraphs: string[],
    metadata?: ParagraphMetadata[]
  ): void {
    this.readerUI.setParagraphs(title, paragraphs, metadata);
  }

  public updateMinimap(currentIndex: number): void {
    this.readerUI.updateMinimap(currentIndex);
  }

  public setTimeLeft(minutes: number): void {
    this.readerUI.setTimeLeft(minutes);
  }

  public setProgressBar(current: number, total: number, isCompleted?: boolean): void {
    this.readerUI.setProgressBar(current, total, isCompleted);
  }

  public async updateParagraph(
    text: string,
    prevText?: string | null,
    nextText?: string | null,
    prev2Text?: string | null,
    next2Text?: string | null
  ): Promise<void> {
    await this.readerUI.updateParagraph(text, prevText, nextText, prev2Text, next2Text);
  }

  public showCompletion(stats: { timeSpentMs: number; paragraphsRead: number }): void {
    this.readerUI.showCompletion(stats);
  }

  public setError(message: string): void {
    this.readerUI.setError(message);
  }

  public setCurrentParagraphState(
    index: number,
    text: string,
    memo: string,
    isBookmarked: boolean
  ): void {
    this.readerUI.setCurrentParagraphState(index, text, memo, isBookmarked);
  }

  public applyPreferences(
    fontFamily: string,
    opacityLevel: number,
    fontSize?: number,
    paragraphCount?: 1 | 3 | 5,
    paragraphSpacing?: 0 | 1 | 2
  ): void {
    this.readerUI.applyPreferences(
      fontFamily,
      opacityLevel,
      fontSize,
      paragraphCount,
      paragraphSpacing
    );
  }

  public setBookmarkState(isBookmarked: boolean): void {
    this.readerUI.setBookmarkState(isBookmarked);
  }

  public updateBookmarksList(bookmarks: Bookmark[], currentUrl: string): void {
    this.readerUI.updateBookmarksList(bookmarks, currentUrl);
  }

  public updateNotesList(notes: HighlightNote[]): void {
    this.readerUI.updateNotesList(notes);
  }

  public openPanel(tab?: 'bookmarks' | 'notes'): void {
    this.readerUI.openPanel(tab);
  }

  public openSubscribeModal(): void {
    this.readerUI.openSubscribeModal();
  }

  public setShowSubscriptionPrompt(show: boolean): void {
    this.readerUI.setShowSubscriptionPrompt(show);
  }

  public showOnboarding(): void {
    this.readerUI.showOnboarding();
  }

  public hideOnboarding(): void {
    this.readerUI.hideOnboarding();
  }

  public getParagraphCount(): 1 | 3 | 5 {
    return this.readerUI.getParagraphCount();
  }

  // ========================================
  // Callback registrations
  // ========================================

  public onExitRequested(callback: () => void): void {
    this.readerUI.onExitRequested(callback);
  }

  public onMemoSave(callback: MemoCallback): void {
    this.readerUI.onMemoSave(callback);
  }

  public onBookmarkToggle(callback: BookmarkCallback): void {
    this.readerUI.onBookmarkToggle(callback);
  }

  public onFontChange(callback: FontChangeCallback): void {
    this.readerUI.onFontChange(callback);
  }

  public onOpacityChange(callback: OpacityChangeCallback): void {
    this.readerUI.onOpacityChange(callback);
  }

  public onFontSizeChange(callback: FontSizeChangeCallback): void {
    this.readerUI.onFontSizeChange(callback);
  }

  public onParagraphCountChange(callback: ParagraphCountChangeCallback): void {
    this.readerUI.onParagraphCountChange(callback);
  }

  public onParagraphSpacingChange(callback: ParagraphSpacingChangeCallback): void {
    this.readerUI.onParagraphSpacingChange(callback);
  }

  public onEmailSubscribe(callback: EmailSubscribeCallback): void {
    this.readerUI.onEmailSubscribe(callback);
  }

  public onHighlightNote(callback: HighlightNoteCallback): void {
    this.readerUI.onHighlightNote(callback);
  }

  public onGoToParagraph(callback: GoToParagraphCallback): void {
    this.readerUI.onGoToParagraph(callback);
  }

  public onOnboardingComplete(callback: () => void): void {
    this.readerUI.onOnboardingComplete(callback);
  }
}
