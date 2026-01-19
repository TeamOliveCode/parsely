import type {
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
  ParagraphMetadata,
  OnParagraphChangeCallback,
} from '../../types';
import type { ScrollController } from '../../core/navigation/scroll-controller';
import { OnboardingGuide } from './onboarding-guide';

export class ReaderUI {
  private container: HTMLElement;
  private shadowRoot: ShadowRoot;
  private originalOverflow: string = '';
  private exitRequestedCallback: (() => void) | null = null;
  private memoCallback: MemoCallback | null = null;
  private bookmarkCallback: BookmarkCallback | null = null;
  private fontChangeCallback: FontChangeCallback | null = null;
  private opacityChangeCallback: OpacityChangeCallback | null = null;
  private fontSizeChangeCallback: FontSizeChangeCallback | null = null;
  private paragraphCountChangeCallback: ParagraphCountChangeCallback | null = null;
  private paragraphSpacingChangeCallback: ParagraphSpacingChangeCallback | null = null;
  private emailSubscribeCallback: EmailSubscribeCallback | null = null;
  private highlightNoteCallback: HighlightNoteCallback | null = null;
  private goToParagraphCallback: GoToParagraphCallback | null = null;
  private paragraphChangeCallback: OnParagraphChangeCallback | null = null;

  private allBookmarks: Bookmark[] = [];
  private paragraphMetadata: ParagraphMetadata[] = [];
  private allHighlightNotes: HighlightNote[] = [];
  private currentUrl: string = '';

  private onboardingGuide: OnboardingGuide;
  private onboardingCompleteCallback: (() => void) | null = null;

  private currentOpacityLevel: number = 1;
  private showSubscriptionPrompt: boolean = false;
  private currentFontIndex: number = 0;
  private currentParagraphIndex: number = 0;
  private currentParagraphText: string = '';
  private isCurrentBookmarked: boolean = false;
  private currentMemo: string = '';

  private opacityLevels = [
    { opacity: 0.5, blur: 2, label: 'Light' },
    { opacity: 0.75, blur: 3, label: 'Medium' },
    { opacity: 0.9, blur: 4, label: 'Dark' },
  ];

  private fontOptions = [
    { family: "'Charter', 'Georgia', serif", label: 'Charter' },
    { family: "'Iowan Old Style', 'Palatino Linotype', Palatino, serif", label: 'Iowan' },
    { family: "'Athelas', 'Georgia', serif", label: 'Athelas' },
    { family: "'Georgia', serif", label: 'Georgia' },
    { family: "'Seravek', 'Gill Sans', sans-serif", label: 'Seravek' },
  ];

  private fontSizeOptions = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
  private currentFontSizeIndex: number = 5; // Default to 22px (closest to 21)

  private paragraphCountOptions: (1 | 3 | 5)[] = [1, 3, 5];
  private currentParagraphCount: 1 | 3 | 5 = 3;

  private paragraphSpacingOptions: (0 | 1 | 2)[] = [0, 1, 2];
  private currentParagraphSpacing: 0 | 1 | 2 = 1;
  private spacingLabels = ['Compact', 'Normal', 'Relaxed'];
  private spacingValues = [8, 24, 48]; // margin in pixels

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'reader-extension-root';
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483647',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(3px)',
      WebkitBackdropFilter: 'blur(3px)',
      transition: 'opacity 0.2s ease-out',
      opacity: '0',
      pointerEvents: 'auto',
      outline: 'none',
    });
    this.container.tabIndex = -1;

    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });
    this.onboardingGuide = new OnboardingGuide(this.shadowRoot);
    this.renderInitial();
    this.setupEvents();
  }

  private renderInitial() {
    const style = document.createElement('style');
    style.textContent = this.getStyles();
    this.shadowRoot.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.innerHTML = this.getOverlayHTML();
    this.shadowRoot.appendChild(overlay);

    this.setupMemoModalEvents();
    this.setupSubscribeModalEvents();
    this.setupPanelEvents();
    this.setupHighlightModalEvents();
    this.setupTextSelection();
    this.setupToolbarButtons();
    this.setupSettingsPanel();
    this.setupOnboarding();
  }

  private getStyles(): string {
    return `
      :host { display: block; }
      ${this.onboardingGuide.getStyles()}
      #reader-extension-slot-left {
        position: fixed;
        left: 60px;
        top: 50%;
        transform: translateY(-50%);
        max-width: 350px;
        max-height: 70vh;
        pointer-events: auto;
        z-index: 10;
      }
      @media (max-width: 1100px) {
        #reader-extension-slot-left { display: none; }
      }
      #overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        color: #e0e0e0; font-family: 'Inter', sans-serif;
        padding: 60px; box-sizing: border-box; overflow: hidden;
      }
      #status {
        position: fixed; top: 40px; left: 60px; right: 60px;
        display: flex; justify-content: space-between; align-items: center;
        font-size: 0.9rem; font-weight: 500; opacity: 0.5; pointer-events: none;
      }
      #title-indicator { max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #right-header { display: flex; align-items: center; gap: 20px; }
      #time-left { font-variant-numeric: tabular-nums; }
      #exit-hint { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; }
      #focus-card {
        max-width: 680px; width: 100%; max-height: 70vh;
        font-family: 'Charter', 'Georgia', serif; font-size: 21px; line-height: 1.65;
        text-align: left; opacity: 1; transition: opacity 0.1s ease-in-out, transform 0.1s ease-out;
        cursor: default; user-select: text; will-change: opacity, transform;
        overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none;
      }
      #focus-card::-webkit-scrollbar { display: none; }
      #focus-card a {
        color: #7dd3fc; text-decoration: underline; text-decoration-color: rgba(125, 211, 252, 0.4);
        text-underline-offset: 2px; transition: all 0.15s ease; cursor: pointer;
      }
      #focus-card a:hover { color: #a5f3fc; text-decoration-color: rgba(165, 243, 252, 0.6); }
      #focus-card a:visited { color: #c4b5fd; text-decoration-color: rgba(196, 181, 253, 0.4); }
      #paragraph-container {
        max-width: 680px; width: 100%; max-height: 70vh; overflow-y: auto;
        scrollbar-width: none; -ms-overflow-style: none;
      }
      #paragraph-container::-webkit-scrollbar { display: none; }
      .context-paragraph {
        font-family: 'Charter', 'Georgia', serif; font-size: 21px; line-height: 1.65;
        text-align: left; color: #e0e0e0; pointer-events: none;
        user-select: none; max-height: 4.95em; overflow-y: auto; position: relative;
        scrollbar-width: none; -ms-overflow-style: none;
      }
      .context-paragraph::-webkit-scrollbar { display: none; }
      .context-paragraph.level-1 { opacity: 0.25; }
      .context-paragraph.level-2 { opacity: 0.12; }
      .context-paragraph.prev {
        margin-bottom: 24px;
        mask-image: linear-gradient(to bottom, transparent 0%, black 50%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 50%);
      }
      .context-paragraph.next {
        margin-top: 24px;
        mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%);
      }
      .context-paragraph.prev2 {
        margin-bottom: 16px;
        mask-image: linear-gradient(to bottom, transparent 0%, black 70%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 70%);
      }
      .context-paragraph.next2 {
        margin-top: 16px;
        mask-image: linear-gradient(to bottom, black 30%, transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, black 30%, transparent 100%);
      }
      .paragraph-divider { height: 1px; background: rgba(255, 255, 255, 0.1); margin: 0; }
      #completion-card {
        display: none; flex-direction: column; align-items: center;
        text-align: center; animation: fadeIn 0.5s ease-out;
      }
      #completion-card.visible { display: flex; }
      .success-icon { font-size: 4rem; color: #00ff9f; margin-bottom: 20px; text-shadow: 0 0 20px rgba(0, 255, 159, 0.4); }
      .completion-title { font-size: 2rem; font-weight: 700; margin-bottom: 30px; color: #fff; }
      .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
      .stat-item { display: flex; flex-direction: column; gap: 8px; }
      .stat-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; opacity: 0.5; }
      .stat-value { font-size: 1.5rem; font-weight: 600; color: #00ff9f; }
      @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      .card-hidden { opacity: 0; transform: translateY(5px); }
      #progress-bar-container {
        position: fixed; bottom: 0; left: 0; width: 100%; height: 2px;
        background: rgba(255, 255, 255, 0.05); pointer-events: none;
      }
      #progress-bar { height: 100%; width: 0%; background: #00ff9f; box-shadow: 0 0 10px #00ff9f; transition: width 0.3s ease; }
      .error { color: #ff5555; opacity: 1 !important; }
      #minimap {
        position: fixed; right: 24px; top: 50%; transform: translateY(-50%);
        display: flex; flex-direction: column; gap: 3px; padding: 8px 6px;
        background: rgba(255, 255, 255, 0.05); border-radius: 8px; max-height: 60vh; overflow: hidden;
      }
      .minimap-item {
        width: 4px; min-height: 4px; background: rgba(255, 255, 255, 0.2);
        border-radius: 2px; transition: all 0.2s ease;
      }
      .minimap-item.active { background: #00ff9f; box-shadow: 0 0 6px #00ff9f; transform: scaleX(1.5); }
      .minimap-item.read { background: rgba(255, 255, 255, 0.4); }
      #minimap-counter {
        position: fixed; right: 44px; top: 50%; transform: translateY(-50%);
        font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); font-variant-numeric: tabular-nums; pointer-events: none;
      }
      #settings-btn {
        position: fixed; bottom: 24px; right: 24px; width: 48px; height: 48px;
        border: none; background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6);
        font-size: 1.4rem; cursor: pointer; border-radius: 50%; backdrop-filter: blur(10px);
        transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;
      }
      #settings-btn:hover { background: rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.9); }
      #bottom-left-controls {
        position: fixed; bottom: 24px; left: 24px; display: flex; flex-direction: column; gap: 8px;
      }
      .bottom-left-row {
        display: flex; gap: 2px; background: rgba(40, 40, 40, 0.95); padding: 4px;
        border-radius: 8px; backdrop-filter: blur(10px);
      }
      .bottom-left-row .opacity-btn {
        padding: 6px 10px; border: none; background: transparent;
        color: rgba(255, 255, 255, 0.5); font-size: 0.7rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer;
        border-radius: 6px; transition: all 0.2s ease; white-space: nowrap;
      }
      .bottom-left-row .opacity-btn:hover {
        color: rgba(255, 255, 255, 0.8);
      }
      .bottom-left-row .opacity-btn.active {
        background: rgba(0, 255, 159, 0.25); color: #00ff9f;
      }
      .bottom-left-row .size-label {
        padding: 6px 8px; color: rgba(255, 255, 255, 0.4); font-size: 0.65rem;
        font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        display: flex; align-items: center;
      }
      .bottom-left-row .font-size-btn {
        width: 28px; height: 28px; border: none; background: transparent;
        color: rgba(255, 255, 255, 0.5); font-size: 1rem; font-weight: 400;
        cursor: pointer; border-radius: 6px; transition: all 0.2s ease;
        display: flex; align-items: center; justify-content: center;
      }
      .bottom-left-row .font-size-btn:hover { color: rgba(255, 255, 255, 0.9); }
      .bottom-left-row .font-size-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .bottom-left-row .font-size-value {
        padding: 0 4px; color: rgba(255, 255, 255, 0.8); font-size: 0.85rem;
        font-weight: 500; font-variant-numeric: tabular-nums; min-width: 28px;
        text-align: center; display: flex; align-items: center; justify-content: center;
      }
      #settings-panel {
        display: none; position: fixed; bottom: 84px; right: 24px; width: 280px;
        background: rgba(30, 30, 30, 0.95); border-radius: 12px; padding: 16px;
        backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }
      #settings-panel.visible { display: block; }
      .settings-header {
        font-size: 0.85rem; font-weight: 600; color: rgba(255, 255, 255, 0.9);
        margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1px;
      }
      .settings-section { margin-bottom: 16px; }
      .settings-section:last-child { margin-bottom: 0; }
      .settings-label {
        font-size: 0.7rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase;
        letter-spacing: 0.5px; margin-bottom: 8px;
        display: flex; align-items: center; justify-content: space-between;
      }
      .shortcut-key {
        font-family: system-ui, -apple-system, sans-serif;
        background: rgba(255, 255, 255, 0.1); padding: 2px 6px; border-radius: 4px;
        font-size: 0.65rem; text-transform: none;
      }
      .settings-btn-group { display: flex; gap: 4px; }
      .settings-action-btn {
        width: 100%; padding: 8px 12px; border: none; background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7); font-size: 0.75rem; cursor: pointer; border-radius: 6px;
        transition: all 0.2s ease;
      }
      .settings-action-btn:hover { background: rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.9); }
      .opacity-btn, .count-btn, .spacing-btn {
        flex: 1; padding: 8px 8px; border: none; background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.5); font-size: 0.7rem; font-weight: 500;
        text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer;
        border-radius: 6px; transition: all 0.2s ease;
      }
      .opacity-btn:hover, .count-btn:hover, .spacing-btn:hover {
        background: rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.8);
      }
      .opacity-btn.active, .count-btn.active, .spacing-btn.active {
        background: rgba(0, 255, 159, 0.2); color: #00ff9f;
      }
      .font-size-group { justify-content: center; align-items: center; }
      .font-size-btn {
        width: 36px; height: 36px; border: none; background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.6); font-size: 1.1rem; font-weight: 600;
        cursor: pointer; border-radius: 6px; transition: all 0.2s ease;
        display: flex; align-items: center; justify-content: center;
      }
      .font-size-btn:hover { background: rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.9); }
      .font-size-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .font-size-value {
        padding: 0 16px; color: rgba(255, 255, 255, 0.8); font-size: 0.9rem;
        font-variant-numeric: tabular-nums; min-width: 48px; text-align: center;
      }
      #font-options { display: flex; flex-direction: column; gap: 4px; }
      .font-option {
        padding: 8px 12px; border: none; background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.6); font-size: 0.85rem; cursor: pointer;
        border-radius: 6px; transition: all 0.2s ease; text-align: left;
      }
      .font-option:hover { background: rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.8); }
      .font-option.active { background: rgba(0, 255, 159, 0.2); color: #00ff9f; }
      #toolbar {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        display: flex; gap: 8px; background: rgba(255, 255, 255, 0.1);
        padding: 8px 12px; border-radius: 12px; backdrop-filter: blur(10px);
      }
      .toolbar-btn {
        padding: 8px 12px; height: 40px; border: none; background: transparent;
        color: rgba(255, 255, 255, 0.6); font-size: 0.8rem; font-weight: 500;
        text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer;
        border-radius: 8px; transition: all 0.2s ease; display: flex;
        align-items: center; justify-content: center; white-space: nowrap;
        text-decoration: none; box-sizing: border-box;
      }
      .toolbar-btn:hover { background: rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.9); }
      .toolbar-btn.active { background: rgba(0, 255, 159, 0.2); color: #00ff9f; }
      .toolbar-btn.has-content { color: #ffd700; }
      .toolbar-divider { width: 1px; background: rgba(255, 255, 255, 0.2); margin: 4px 4px; }
      #memo-modal, #subscribe-modal, #highlight-modal {
        display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); justify-content: center; align-items: center; z-index: 100;
      }
      #memo-modal.visible, #subscribe-modal.visible, #highlight-modal.visible { display: flex; }
      .memo-content, .subscribe-content, .highlight-modal-content {
        background: #1a1a1a; border-radius: 12px; padding: 24px; width: 90%; max-width: 500px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      }
      .memo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .memo-title { font-size: 1.1rem; font-weight: 600; color: #fff; }
      .memo-close { background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 1.5rem; cursor: pointer; padding: 0; line-height: 1; }
      .memo-close:hover { color: #fff; }
      .memo-textarea, .highlight-textarea {
        width: 100%; height: 150px; background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; padding: 12px;
        color: #fff; font-size: 1rem; font-family: inherit; resize: none; box-sizing: border-box;
      }
      .memo-textarea:focus, .highlight-textarea:focus { outline: none; border-color: #00ff9f; }
      .memo-actions, .highlight-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; }
      .memo-btn, .highlight-btn {
        padding: 10px 20px; border: none; border-radius: 6px; font-size: 0.9rem;
        font-weight: 500; cursor: pointer; transition: all 0.2s ease;
      }
      .memo-btn-save, .highlight-btn-save { background: #00ff9f; color: #000; }
      .memo-btn-save:hover, .highlight-btn-save:hover { background: #00cc7f; }
      .memo-btn-cancel, .highlight-btn-cancel { background: rgba(255, 255, 255, 0.1); color: #fff; }
      .memo-btn-cancel:hover, .highlight-btn-cancel:hover { background: rgba(255, 255, 255, 0.2); }
      #font-dropdown, #feedback-dropdown {
        display: none; position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: #1a1a1a; border-radius: 8px; padding: 8px 0; box-shadow: 0 5px 20px rgba(0, 0, 0, 0.4); z-index: 50;
      }
      #font-dropdown.visible, #feedback-dropdown.visible { display: block; }
      .font-option {
        padding: 10px 20px; color: rgba(255, 255, 255, 0.7); cursor: pointer;
        transition: all 0.15s ease; white-space: nowrap;
      }
      .font-option:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      .font-option.active { color: #00ff9f; }
      .feedback-option {
        display: flex; align-items: center; gap: 10px; padding: 12px 20px;
        color: rgba(255, 255, 255, 0.7); cursor: pointer; transition: all 0.15s ease; text-decoration: none;
      }
      .feedback-option:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      #toast {
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
        background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 8px;
        font-size: 0.9rem; opacity: 0; transition: all 0.3s ease; pointer-events: none; z-index: 200;
      }
      #toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
      .subscribe-content { max-width: 420px; text-align: center; background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); border-radius: 16px; padding: 32px; }
      .subscribe-title { font-size: 1.4rem; font-weight: 700; color: #fff; margin-bottom: 12px; }
      .subscribe-desc { font-size: 0.95rem; color: rgba(255, 255, 255, 0.7); margin-bottom: 24px; line-height: 1.5; }
      .subscribe-input {
        width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff;
        font-size: 1rem; box-sizing: border-box; margin-bottom: 16px;
      }
      .subscribe-input:focus { outline: none; border-color: #00ff9f; }
      .subscribe-input::placeholder { color: rgba(255, 255, 255, 0.4); }
      .subscribe-btn {
        width: 100%; padding: 14px; background: #00ff9f; color: #000; border: none;
        border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
      }
      .subscribe-btn:hover { background: #00cc7f; }
      .subscribe-btn:disabled { background: rgba(255, 255, 255, 0.2); color: rgba(255, 255, 255, 0.5); cursor: not-allowed; }
      .subscribe-skip { margin-top: 16px; background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 0.85rem; cursor: pointer; padding: 8px; }
      .subscribe-skip:hover { color: rgba(255, 255, 255, 0.8); }
      .subscribe-error { color: #ff6b6b; font-size: 0.85rem; margin-top: -8px; margin-bottom: 12px; }
      .subscribe-success { color: #00ff9f; font-size: 0.95rem; margin-top: 8px; }
      #panel-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 160; }
      #panel-overlay.visible { display: block; }
      #side-panel {
        position: fixed; top: 0; right: -400px; width: 380px; max-width: 90vw; height: 100vh;
        background: #1a1a1a; box-shadow: -5px 0 30px rgba(0, 0, 0, 0.5); transition: right 0.3s ease;
        z-index: 170; display: flex; flex-direction: column;
      }
      #side-panel.visible { right: 0; }
      .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
      .panel-tabs { display: flex; gap: 8px; }
      .panel-tab {
        padding: 8px 16px; background: transparent; border: none; color: rgba(255, 255, 255, 0.5);
        font-size: 0.9rem; font-weight: 500; cursor: pointer; border-radius: 6px; transition: all 0.2s ease;
      }
      .panel-tab:hover { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); }
      .panel-tab.active { background: rgba(0, 255, 159, 0.2); color: #00ff9f; }
      .panel-close { background: none; border: none; color: rgba(255, 255, 255, 0.5); font-size: 1.5rem; cursor: pointer; padding: 4px 8px; line-height: 1; }
      .panel-close:hover { color: #fff; }
      .panel-content { flex: 1; overflow-y: auto; padding: 16px; }
      .panel-empty { text-align: center; color: rgba(255, 255, 255, 0.4); padding: 40px 20px; font-size: 0.9rem; }
      .bookmark-item, .note-item {
        background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 14px 16px;
        margin-bottom: 10px; cursor: pointer; transition: all 0.2s ease;
      }
      .bookmark-item:hover, .note-item:hover { background: rgba(255, 255, 255, 0.1); }
      .bookmark-title { font-size: 0.85rem; color: rgba(255, 255, 255, 0.5); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bookmark-preview, .note-highlight { font-size: 0.95rem; color: #e0e0e0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .note-highlight { background: rgba(255, 213, 0, 0.15); padding: 8px 10px; border-left: 3px solid #ffd500; border-radius: 0 6px 6px 0; margin-bottom: 8px; font-style: italic; }
      .note-text { font-size: 0.9rem; color: rgba(255, 255, 255, 0.7); line-height: 1.5; }
      .bookmark-meta, .note-meta { font-size: 0.75rem; color: rgba(255, 255, 255, 0.3); margin-top: 8px; }
      .bookmark-delete, .note-delete {
        float: right; background: none; border: none; color: rgba(255, 255, 255, 0.3);
        font-size: 1rem; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: all 0.2s ease;
      }
      .bookmark-delete:hover, .note-delete:hover { background: rgba(255, 100, 100, 0.2); color: #ff6b6b; }
      .highlight-modal-content { max-width: 450px; }
      .highlight-preview {
        background: rgba(255, 213, 0, 0.15); padding: 12px 14px; border-left: 3px solid #ffd500;
        border-radius: 0 8px 8px 0; margin-bottom: 16px; font-size: 0.95rem; color: #e0e0e0;
        line-height: 1.5; font-style: italic; max-height: 120px; overflow-y: auto;
      }
      .highlight-textarea { height: 100px; }
      .highlight-textarea:focus { border-color: #ffd500; }
      .highlight-btn-save { background: #ffd500; }
      .highlight-btn-save:hover { background: #e6c000; }
    `;
  }

  private getOverlayHTML(): string {
    return `
      <div id="reader-extension-slot-left"></div>
      <div id="status">
        <div id="title-indicator">Initializing...</div>
        <div id="right-header">
          <div id="time-left"></div>
          <div id="exit-hint">Esc to Exit</div>
        </div>
      </div>
      <div id="paragraph-container">
        <div id="prev2-paragraph" class="context-paragraph prev2 level-2"></div>
        <div id="prev-paragraph" class="context-paragraph prev level-1"></div>
        <div id="focus-card"></div>
        <div id="next-paragraph" class="context-paragraph next level-1"></div>
        <div id="next2-paragraph" class="context-paragraph next2 level-2"></div>
      </div>
      <div id="completion-card">
        <div class="success-icon">✓</div>
        <div class="completion-title">Article Finished</div>
        <div class="stats-grid">
          <div class="stat-item"><span class="stat-label">Time Spent</span><span id="stat-time" class="stat-value">-</span></div>
          <div class="stat-item"><span class="stat-label">Paragraphs</span><span id="stat-count" class="stat-value">-</span></div>
        </div>
      </div>
      <div id="progress-bar-container"><div id="progress-bar"></div></div>
      <div id="minimap"></div>
      <div id="minimap-counter"></div>
      <div id="toolbar">
        <button class="toolbar-btn" id="memo-btn" title="Add memo (M)">Memo</button>
        <button class="toolbar-btn" id="bookmark-btn" title="Toggle bookmark (B)">Bookmark</button>
        <button class="toolbar-btn" id="library-btn" title="View bookmarks & notes (L)">Library</button>
        <div class="toolbar-divider"></div>
        <a class="toolbar-btn" id="feedback-btn" href="mailto:contact@olive-labs.com?subject=Parsely Feedback" title="Send feedback">Feedback</a>
      </div>
      <div id="bottom-left-controls">
        <div class="bottom-left-row">
          <button class="opacity-btn" data-level="0">Light</button>
          <button class="opacity-btn active" data-level="1">Medium</button>
          <button class="opacity-btn" data-level="2">Dark</button>
        </div>
        <div class="bottom-left-row">
          <span class="size-label">Size</span>
          <button class="font-size-btn" id="font-size-decrease">−</button>
          <span class="font-size-value" id="font-size-value">22</span>
          <button class="font-size-btn" id="font-size-increase">+</button>
        </div>
      </div>
      <button id="settings-btn" title="Settings">⚙</button>
      <div id="settings-panel">
        <div class="settings-header">Settings</div>
        <div class="settings-section">
          <div class="settings-label">Shortcut <span class="shortcut-key">${navigator.userAgent.includes('Mac') ? '⌃⇧R' : 'Alt+R'}</span></div>
          <button class="settings-action-btn" id="shortcuts-btn">Change</button>
        </div>
        <div class="settings-section">
          <div class="settings-label">Paragraphs</div>
          <div class="settings-btn-group">
            <button class="count-btn" data-count="1">1</button>
            <button class="count-btn active" data-count="3">3</button>
            <button class="count-btn" data-count="5">5</button>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-label">Spacing</div>
          <div class="settings-btn-group">
            <button class="spacing-btn" data-spacing="0">Compact</button>
            <button class="spacing-btn active" data-spacing="1">Normal</button>
            <button class="spacing-btn" data-spacing="2">Relaxed</button>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-label">Font</div>
          <div id="font-options"></div>
        </div>
      </div>
      <div id="memo-modal">
        <div class="memo-content">
          <div class="memo-header"><span class="memo-title">Add Memo</span><button class="memo-close">&times;</button></div>
          <textarea class="memo-textarea" placeholder="Write your note here..."></textarea>
          <div class="memo-actions"><button class="memo-btn memo-btn-cancel">Cancel</button><button class="memo-btn memo-btn-save">Save</button></div>
        </div>
      </div>
      <div id="toast"></div>
      <div id="subscribe-modal">
        <div class="subscribe-content">
          <div class="subscribe-title">Get Your Monthly Reading Report</div>
          <div class="subscribe-desc">Subscribe to receive personalized insights about your reading habits, tips to read more effectively, and early access to new features.</div>
          <input type="email" class="subscribe-input" placeholder="Enter your email" />
          <div class="subscribe-error" style="display: none;"></div>
          <button class="subscribe-btn">Subscribe</button>
          <button class="subscribe-skip">Maybe later</button>
        </div>
      </div>
      <div id="panel-overlay"></div>
      <div id="side-panel">
        <div class="panel-header">
          <div class="panel-tabs">
            <button class="panel-tab active" data-tab="bookmarks">Bookmarks</button>
            <button class="panel-tab" data-tab="notes">Notes</button>
          </div>
          <button class="panel-close">&times;</button>
        </div>
        <div class="panel-content" id="panel-bookmarks"><div class="panel-empty"><div>No bookmarks yet</div></div></div>
        <div class="panel-content" id="panel-notes" style="display: none;"><div class="panel-empty"><div>No notes yet</div><div style="margin-top: 8px; font-size: 0.8rem;">Select text and add a note</div></div></div>
      </div>
      <div id="highlight-modal">
        <div class="highlight-modal-content">
          <div class="highlight-preview" id="highlight-preview-text"></div>
          <textarea class="highlight-textarea" placeholder="Add your note..."></textarea>
          <div class="highlight-actions"><button class="highlight-btn highlight-btn-cancel">Cancel</button><button class="highlight-btn highlight-btn-save">Save Note</button></div>
        </div>
      </div>
      ${this.onboardingGuide.getHTML()}
    `;
  }

  private changeFontSize(delta: number): void {
    const newIndex = this.currentFontSizeIndex + delta;
    if (newIndex < 0 || newIndex >= this.fontSizeOptions.length) return;
    this.currentFontSizeIndex = newIndex;
    this.applyFontSize();
    this.updateFontSizeButtons();
    if (this.fontSizeChangeCallback) {
      this.fontSizeChangeCallback(this.fontSizeOptions[newIndex]);
    }
  }

  private applyFontSize(): void {
    const fontSize = this.fontSizeOptions[this.currentFontSizeIndex];
    const card = this.shadowRoot.getElementById('focus-card');
    const prev = this.shadowRoot.getElementById('prev-paragraph');
    const next = this.shadowRoot.getElementById('next-paragraph');
    if (card) card.style.fontSize = `${fontSize}px`;
    if (prev) prev.style.fontSize = `${fontSize}px`;
    if (next) next.style.fontSize = `${fontSize}px`;
  }

  private updateFontSizeButtons(): void {
    const value = this.shadowRoot.getElementById('font-size-value');
    const decreaseBtn = this.shadowRoot.getElementById('font-size-decrease') as HTMLButtonElement;
    const increaseBtn = this.shadowRoot.getElementById('font-size-increase') as HTMLButtonElement;
    if (value) value.textContent = `${this.fontSizeOptions[this.currentFontSizeIndex]}`;
    if (decreaseBtn) decreaseBtn.disabled = this.currentFontSizeIndex === 0;
    if (increaseBtn)
      increaseBtn.disabled = this.currentFontSizeIndex === this.fontSizeOptions.length - 1;
  }

  private setupToolbarButtons(): void {
    this.shadowRoot
      .getElementById('memo-btn')
      ?.addEventListener('click', () => this.openMemoModal());
    this.shadowRoot
      .getElementById('bookmark-btn')
      ?.addEventListener('click', () => this.toggleBookmark());
    this.shadowRoot
      .getElementById('library-btn')
      ?.addEventListener('click', () => this.openPanel('bookmarks'));
  }

  private setupSettingsPanel(): void {
    const settingsBtn = this.shadowRoot.getElementById('settings-btn');
    const settingsPanel = this.shadowRoot.getElementById('settings-panel');

    // Toggle settings panel
    settingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSettingsPanel();
    });

    // Prevent clicks inside panel from closing it
    settingsPanel?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close panel when clicking outside
    this.container.addEventListener('click', () => {
      settingsPanel?.classList.remove('visible');
    });

    // Shortcuts button
    this.shadowRoot.getElementById('shortcuts-btn')?.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'OPEN_SHORTCUTS_PAGE' });
    });

    // Paragraph count buttons
    this.shadowRoot.querySelectorAll('.count-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const count = parseInt((btn as HTMLElement).dataset.count || '3') as 1 | 3 | 5;
        this.setParagraphCount(count);
      });
    });

    // Spacing buttons
    this.shadowRoot.querySelectorAll('.spacing-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spacing = parseInt((btn as HTMLElement).dataset.spacing || '1') as 0 | 1 | 2;
        this.setParagraphSpacing(spacing);
      });
    });

    // Font options
    const fontOptions = this.shadowRoot.getElementById('font-options');
    if (fontOptions) {
      this.fontOptions.forEach((font, index) => {
        const option = document.createElement('div');
        option.className = 'font-option' + (index === this.currentFontIndex ? ' active' : '');
        option.textContent = font.label;
        option.style.fontFamily = font.family;
        option.addEventListener('click', () => this.setFont(index));
        fontOptions.appendChild(option);
      });
    }

    // Bottom-left controls: Font size buttons
    this.shadowRoot
      .getElementById('font-size-decrease')
      ?.addEventListener('click', () => this.changeFontSize(-1));
    this.shadowRoot
      .getElementById('font-size-increase')
      ?.addEventListener('click', () => this.changeFontSize(1));
    this.updateFontSizeButtons();

    // Bottom-left controls: Opacity buttons
    this.shadowRoot.querySelectorAll('.opacity-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const level = parseInt((btn as HTMLElement).dataset.level || '1');
        this.setOpacityLevel(level);
      });
    });

    // Prevent bottom-left controls from closing settings panel
    const bottomLeftControls = this.shadowRoot.getElementById('bottom-left-controls');
    bottomLeftControls?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  private toggleSettingsPanel(): void {
    const panel = this.shadowRoot.getElementById('settings-panel');
    panel?.classList.toggle('visible');
  }

  private setParagraphCount(count: 1 | 3 | 5): void {
    this.currentParagraphCount = count;
    this.shadowRoot.querySelectorAll('.count-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt((btn as HTMLElement).dataset.count || '3') === count);
    });
    this.updateParagraphVisibility();
    if (this.paragraphCountChangeCallback) {
      this.paragraphCountChangeCallback(count);
    }
  }

  private setParagraphSpacing(spacing: 0 | 1 | 2): void {
    this.currentParagraphSpacing = spacing;
    this.shadowRoot.querySelectorAll('.spacing-btn').forEach((btn) => {
      btn.classList.toggle(
        'active',
        parseInt((btn as HTMLElement).dataset.spacing || '1') === spacing
      );
    });
    this.applyParagraphSpacing();
    if (this.paragraphSpacingChangeCallback) {
      this.paragraphSpacingChangeCallback(spacing);
    }
  }

  private applyParagraphSpacing(): void {
    const margin = this.spacingValues[this.currentParagraphSpacing];
    const prev = this.shadowRoot.getElementById('prev-paragraph');
    const next = this.shadowRoot.getElementById('next-paragraph');
    if (prev) prev.style.marginBottom = `${margin}px`;
    if (next) next.style.marginTop = `${margin}px`;
  }

  private updateParagraphVisibility(): void {
    const prev = this.shadowRoot.getElementById('prev-paragraph');
    const next = this.shadowRoot.getElementById('next-paragraph');
    const prev2 = this.shadowRoot.getElementById('prev2-paragraph');
    const next2 = this.shadowRoot.getElementById('next2-paragraph');

    const showLevel1 = this.currentParagraphCount >= 3;
    const showLevel2 = this.currentParagraphCount >= 5;

    // Level 1: prev/next
    if (prev) prev.style.display = showLevel1 && prev.innerHTML.trim() ? 'block' : 'none';
    if (next) next.style.display = showLevel1 && next.innerHTML.trim() ? 'block' : 'none';

    // Level 2: prev2/next2
    if (prev2) prev2.style.display = showLevel2 && prev2.innerHTML.trim() ? 'block' : 'none';
    if (next2) next2.style.display = showLevel2 && next2.innerHTML.trim() ? 'block' : 'none';
  }

  private openMemoModal(): void {
    const modal = this.shadowRoot.getElementById('memo-modal');
    const textarea = this.shadowRoot.querySelector('.memo-textarea') as HTMLTextAreaElement;
    if (modal && textarea) {
      textarea.value = this.currentMemo;
      modal.classList.add('visible');
      textarea.focus();
    }
  }

  private closeMemoModal(): void {
    this.shadowRoot.getElementById('memo-modal')?.classList.remove('visible');
  }

  private setupMemoModalEvents(): void {
    const modal = this.shadowRoot.getElementById('memo-modal');
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closeMemoModal();
    });
    this.shadowRoot
      .querySelector('.memo-close')
      ?.addEventListener('click', () => this.closeMemoModal());
    this.shadowRoot
      .querySelector('.memo-btn-cancel')
      ?.addEventListener('click', () => this.closeMemoModal());
    this.shadowRoot
      .querySelector('.memo-btn-save')
      ?.addEventListener('click', () => this.saveMemo());
  }

  private saveMemo(): void {
    const textarea = this.shadowRoot.querySelector('.memo-textarea') as HTMLTextAreaElement;
    if (textarea && this.memoCallback) {
      this.currentMemo = textarea.value;
      this.memoCallback(this.currentParagraphIndex, textarea.value);
      this.updateMemoButtonState();
      this.closeMemoModal();
      this.showToast(textarea.value ? 'Memo saved' : 'Memo deleted');
    }
  }

  private setupSubscribeModalEvents(): void {
    const modal = this.shadowRoot.getElementById('subscribe-modal');
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closeSubscribeModal();
    });
    this.shadowRoot
      .querySelector('.subscribe-btn')
      ?.addEventListener('click', () => this.handleSubscribe());
    this.shadowRoot
      .querySelector('.subscribe-skip')
      ?.addEventListener('click', () => this.closeSubscribeModal());
    const input = this.shadowRoot.querySelector('.subscribe-input') as HTMLInputElement;
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSubscribe();
    });
  }

  private async handleSubscribe(): Promise<void> {
    const input = this.shadowRoot.querySelector('.subscribe-input') as HTMLInputElement;
    const btn = this.shadowRoot.querySelector('.subscribe-btn') as HTMLButtonElement;
    if (!input || !btn || !this.emailSubscribeCallback) return;
    const email = input.value.trim();
    if (!email) {
      this.showSubscribeError('Please enter your email');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Subscribing...';
    try {
      const result = await this.emailSubscribeCallback(email);
      if (result.success) {
        const content = this.shadowRoot.querySelector('.subscribe-content');
        if (content) {
          content.innerHTML = `<div class="subscribe-title">You're Subscribed!</div><div class="subscribe-desc">${result.message}</div><button class="subscribe-btn">Continue Reading</button>`;
          content
            .querySelector('.subscribe-btn')
            ?.addEventListener('click', () => this.closeSubscribeModal());
        }
      } else {
        this.showSubscribeError(result.message);
        btn.disabled = false;
        btn.textContent = 'Subscribe';
      }
    } catch {
      this.showSubscribeError('Something went wrong. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Subscribe';
    }
  }

  private showSubscribeError(message: string): void {
    const errorDiv = this.shadowRoot.querySelector('.subscribe-error') as HTMLElement;
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  public openSubscribeModal(): void {
    if (this.showSubscriptionPrompt) {
      this.shadowRoot.getElementById('subscribe-modal')?.classList.add('visible');
    }
  }

  private closeSubscribeModal(): void {
    this.shadowRoot.getElementById('subscribe-modal')?.classList.remove('visible');
  }

  private setupPanelEvents(): void {
    this.shadowRoot
      .getElementById('panel-overlay')
      ?.addEventListener('click', () => this.closePanel());
    this.shadowRoot
      .querySelector('.panel-close')
      ?.addEventListener('click', () => this.closePanel());
    this.shadowRoot.querySelectorAll('.panel-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        if (tabName) this.switchPanelTab(tabName);
      });
    });
  }

  private switchPanelTab(tabName: string): void {
    this.shadowRoot.querySelectorAll('.panel-tab').forEach((tab) => {
      tab.classList.toggle('active', (tab as HTMLElement).dataset.tab === tabName);
    });
    const bookmarksPanel = this.shadowRoot.getElementById('panel-bookmarks');
    const notesPanel = this.shadowRoot.getElementById('panel-notes');
    if (bookmarksPanel && notesPanel) {
      bookmarksPanel.style.display = tabName === 'bookmarks' ? 'block' : 'none';
      notesPanel.style.display = tabName === 'notes' ? 'block' : 'none';
    }
  }

  public openPanel(tab: 'bookmarks' | 'notes' = 'bookmarks'): void {
    this.shadowRoot.getElementById('side-panel')?.classList.add('visible');
    this.shadowRoot.getElementById('panel-overlay')?.classList.add('visible');
    this.switchPanelTab(tab);
  }

  private closePanel(): void {
    this.shadowRoot.getElementById('side-panel')?.classList.remove('visible');
    this.shadowRoot.getElementById('panel-overlay')?.classList.remove('visible');
  }

  public updateBookmarksList(bookmarks: Bookmark[], currentUrl: string): void {
    this.allBookmarks = bookmarks;
    this.currentUrl = currentUrl;
    const container = this.shadowRoot.getElementById('panel-bookmarks');
    if (!container) return;
    const currentBookmarks = bookmarks.filter((b) => b.url === currentUrl);
    if (currentBookmarks.length === 0) {
      container.innerHTML = `<div class="panel-empty"><div>No bookmarks yet</div></div>`;
      return;
    }
    container.innerHTML = currentBookmarks
      .sort((a, b) => a.paragraphIndex - b.paragraphIndex)
      .map(
        (bookmark) => `
        <div class="bookmark-item" data-index="${bookmark.paragraphIndex}">
          <button class="bookmark-delete" data-index="${bookmark.paragraphIndex}">&times;</button>
          <div class="bookmark-preview">${this.escapeHtml(bookmark.paragraphPreview)}</div>
          <div class="bookmark-meta">Paragraph ${bookmark.paragraphIndex + 1}</div>
        </div>
      `
      )
      .join('');
    container.querySelectorAll('.bookmark-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('bookmark-delete')) return;
        const index = parseInt((item as HTMLElement).dataset.index || '0');
        if (this.goToParagraphCallback) {
          this.goToParagraphCallback(index);
          this.closePanel();
        }
      });
    });
    container.querySelectorAll('.bookmark-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt((btn as HTMLElement).dataset.index || '0');
        if (this.bookmarkCallback) this.bookmarkCallback(index, '');
      });
    });
  }

  public updateNotesList(notes: HighlightNote[]): void {
    this.allHighlightNotes = notes;
    const container = this.shadowRoot.getElementById('panel-notes');
    if (!container) return;
    if (notes.length === 0) {
      container.innerHTML = `<div class="panel-empty"><div>No notes yet</div><div style="margin-top: 8px; font-size: 0.8rem;">Select text and add a note</div></div>`;
      return;
    }
    container.innerHTML = notes
      .sort((a, b) => a.paragraphIndex - b.paragraphIndex)
      .map(
        (note, idx) => `
        <div class="note-item" data-index="${note.paragraphIndex}" data-note-idx="${idx}">
          <button class="note-delete" data-note-idx="${idx}">&times;</button>
          <div class="note-highlight">"${this.escapeHtml(note.selectedText)}"</div>
          <div class="note-text">${this.escapeHtml(note.note)}</div>
          <div class="note-meta">Paragraph ${note.paragraphIndex + 1}</div>
        </div>
      `
      )
      .join('');
    container.querySelectorAll('.note-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('note-delete')) return;
        const index = parseInt((item as HTMLElement).dataset.index || '0');
        if (this.goToParagraphCallback) {
          this.goToParagraphCallback(index);
          this.closePanel();
        }
      });
    });
    container.querySelectorAll('.note-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteIdx = parseInt((btn as HTMLElement).dataset.noteIdx || '0');
        const note = notes[noteIdx];
        if (note && this.highlightNoteCallback)
          this.highlightNoteCallback(note.paragraphIndex, note.selectedText, '');
      });
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private selectedText: string = '';

  private setupHighlightModalEvents(): void {
    const modal = this.shadowRoot.getElementById('highlight-modal');
    modal?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === modal) this.closeHighlightModal();
    });
    this.shadowRoot.querySelector('.highlight-btn-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeHighlightModal();
    });
    this.shadowRoot.querySelector('.highlight-btn-save')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.saveHighlightNote();
    });
  }

  private setupTextSelection(): void {
    const card = this.shadowRoot.getElementById('focus-card');
    if (!card) return;
    card.addEventListener('mouseup', () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length >= 3) {
        this.selectedText = selection.toString().trim();
        this.openHighlightModal(this.selectedText);
      }
    });
  }

  private openHighlightModal(text: string): void {
    const modal = this.shadowRoot.getElementById('highlight-modal');
    const preview = this.shadowRoot.getElementById('highlight-preview-text');
    const textarea = this.shadowRoot.querySelector('.highlight-textarea') as HTMLTextAreaElement;
    if (modal && preview && textarea) {
      preview.textContent = `"${text}"`;
      textarea.value = '';
      modal.classList.add('visible');
      textarea.focus();
    }
  }

  private closeHighlightModal(): void {
    this.shadowRoot.getElementById('highlight-modal')?.classList.remove('visible');
    this.selectedText = '';
    window.getSelection()?.removeAllRanges();
  }

  private saveHighlightNote(): void {
    const textarea = this.shadowRoot.querySelector('.highlight-textarea') as HTMLTextAreaElement;
    if (textarea && this.highlightNoteCallback && this.selectedText) {
      const note = textarea.value.trim();
      if (note) {
        this.highlightNoteCallback(this.currentParagraphIndex, this.selectedText, note);
        this.showToast('Note saved');
      }
      this.closeHighlightModal();
    }
  }

  public onHighlightNote(callback: HighlightNoteCallback): void {
    this.highlightNoteCallback = callback;
  }
  public onGoToParagraph(callback: GoToParagraphCallback): void {
    this.goToParagraphCallback = callback;
  }
  public setShowSubscriptionPrompt(show: boolean): void {
    this.showSubscriptionPrompt = show;
  }

  private updateMemoButtonState(): void {
    const btn = this.shadowRoot.getElementById('memo-btn');
    if (btn) btn.classList.toggle('has-content', !!this.currentMemo);
  }

  private toggleBookmark(): void {
    if (this.bookmarkCallback)
      this.bookmarkCallback(this.currentParagraphIndex, this.currentParagraphText);
  }

  public setBookmarkState(isBookmarked: boolean): void {
    this.isCurrentBookmarked = isBookmarked;
    const btn = this.shadowRoot.getElementById('bookmark-btn');
    if (btn) btn.classList.toggle('active', isBookmarked);
    if (isBookmarked) this.showToast('Bookmark added');
  }

  private setFont(index: number): void {
    this.currentFontIndex = index;
    const font = this.fontOptions[index];
    const card = this.shadowRoot.getElementById('focus-card');
    const prev = this.shadowRoot.getElementById('prev-paragraph');
    const next = this.shadowRoot.getElementById('next-paragraph');
    if (card) card.style.fontFamily = font.family;
    if (prev) prev.style.fontFamily = font.family;
    if (next) next.style.fontFamily = font.family;
    this.shadowRoot
      .querySelectorAll('.font-option')
      .forEach((opt, i) => opt.classList.toggle('active', i === index));
    if (this.fontChangeCallback) this.fontChangeCallback(font.label);
  }

  private showToast(message: string): void {
    const toast = this.shadowRoot.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2000);
    }
  }

  private setOpacityLevel(level: number): void {
    this.currentOpacityLevel = level;
    const config = this.opacityLevels[level];
    this.container.style.background = `rgba(0, 0, 0, ${config.opacity})`;
    this.container.style.backdropFilter = `blur(${config.blur}px)`;
    (this.container.style as any).WebkitBackdropFilter = `blur(${config.blur}px)`;
    this.shadowRoot
      .querySelectorAll('.opacity-btn')
      .forEach((btn, i) => btn.classList.toggle('active', i === level));
    if (this.opacityChangeCallback) this.opacityChangeCallback(level);
  }

  private keyboardController: any = null;
  private scrollController: ScrollController | null = null;
  public setKeyboardController(controller: any) {
    this.keyboardController = controller;
  }
  public setScrollController(controller: ScrollController) {
    this.scrollController = controller;
  }

  private totalParagraphs: number = 0;

  public setParagraphs(title: string, paragraphs: string[], metadata?: ParagraphMetadata[]) {
    const titleIndicator = this.shadowRoot.getElementById('title-indicator');
    if (titleIndicator) titleIndicator.textContent = title;
    this.totalParagraphs = paragraphs.length;
    this.paragraphMetadata = metadata || [];
    const minimap = this.shadowRoot.getElementById('minimap');
    if (minimap) {
      minimap.innerHTML = '';
      const maxItems = Math.min(paragraphs.length, 100);
      const itemHeight = Math.max(3, Math.min(8, Math.floor(300 / maxItems)));
      for (let i = 0; i < paragraphs.length; i++) {
        const item = document.createElement('div');
        item.className = 'minimap-item';
        item.style.height = `${itemHeight}px`;
        item.dataset.index = i.toString();
        minimap.appendChild(item);
      }
    }
  }

  public updateMinimap(currentIndex: number) {
    const minimap = this.shadowRoot.getElementById('minimap');
    const counter = this.shadowRoot.getElementById('minimap-counter');
    if (minimap) {
      const items = minimap.querySelectorAll('.minimap-item');
      items.forEach((item, i) => {
        item.classList.remove('active');
        if (i < currentIndex) item.classList.add('read');
        else if (i === currentIndex) {
          item.classList.add('active');
          item.classList.remove('read');
        } else item.classList.remove('read');
      });
      const activeItem = minimap.querySelector('.minimap-item.active') as HTMLElement;
      if (activeItem) {
        const minimapRect = minimap.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const relativeTop = itemRect.top - minimapRect.top;
        if (relativeTop < 20 || relativeTop > minimap.clientHeight - 20) {
          activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }
    if (counter) counter.textContent = `${currentIndex + 1}/${this.totalParagraphs}`;
  }

  public setTimeLeft(minutes: number) {
    const timeLeft = this.shadowRoot.getElementById('time-left');
    if (!timeLeft) return;
    if (minutes <= 0) timeLeft.textContent = '';
    else if (minutes < 1) timeLeft.textContent = '< 1 min left';
    else timeLeft.textContent = `${minutes} min left`;
  }

  public setProgressBar(current: number, total: number, isCompleted: boolean = false) {
    const bar = this.shadowRoot.getElementById('progress-bar');
    if (bar && total > 0) {
      const percentage = isCompleted ? 100 : ((current + 1) / total) * 100;
      bar.style.width = `${percentage}%`;
    }
  }

  public async updateParagraph(
    text: string,
    prevText: string | null = null,
    nextText: string | null = null,
    prev2Text: string | null = null,
    next2Text: string | null = null
  ) {
    const card = this.shadowRoot.getElementById('focus-card');
    const completion = this.shadowRoot.getElementById('completion-card');
    const prevParagraph = this.shadowRoot.getElementById('prev-paragraph');
    const nextParagraph = this.shadowRoot.getElementById('next-paragraph');
    const prev2Paragraph = this.shadowRoot.getElementById('prev2-paragraph');
    const next2Paragraph = this.shadowRoot.getElementById('next2-paragraph');
    const container = this.shadowRoot.getElementById('paragraph-container');

    if (card && completion) {
      completion.classList.remove('visible');
      card.style.display = 'block';
      card.classList.add('card-hidden');
      await new Promise((r) => setTimeout(r, 100));
      // Use innerHTML to support clickable links (content is sanitized by Serializer)
      card.innerHTML = this.sanitizeHtml(text);

      // Show/hide context paragraphs based on paragraphCount setting
      const showLevel1 = this.currentParagraphCount >= 3;
      const showLevel2 = this.currentParagraphCount >= 5;

      if (prev2Paragraph) {
        prev2Paragraph.innerHTML = prev2Text ? this.sanitizeHtml(prev2Text) : '';
        prev2Paragraph.style.display = showLevel2 && prev2Text ? 'block' : 'none';
        // Scroll to bottom to show end of paragraph (natural reading flow)
        prev2Paragraph.scrollTop = prev2Paragraph.scrollHeight;
      }
      if (prevParagraph) {
        prevParagraph.innerHTML = prevText ? this.sanitizeHtml(prevText) : '';
        prevParagraph.style.display = showLevel1 && prevText ? 'block' : 'none';
        // Scroll to bottom to show end of paragraph (natural reading flow)
        prevParagraph.scrollTop = prevParagraph.scrollHeight;
      }
      if (nextParagraph) {
        nextParagraph.innerHTML = nextText ? this.sanitizeHtml(nextText) : '';
        nextParagraph.style.display = showLevel1 && nextText ? 'block' : 'none';
      }
      if (next2Paragraph) {
        next2Paragraph.innerHTML = next2Text ? this.sanitizeHtml(next2Text) : '';
        next2Paragraph.style.display = showLevel2 && next2Text ? 'block' : 'none';
      }

      // Scroll to center the focus card
      if (container) {
        let scrollOffset = 0;
        if (showLevel2 && prev2Paragraph) scrollOffset += prev2Paragraph.offsetHeight + 16;
        if (showLevel1 && prevParagraph) scrollOffset += prevParagraph.offsetHeight + 24;
        container.scrollTop = scrollOffset;
      }
      card.classList.remove('card-hidden');
    }
  }

  /**
   * Sanitize HTML to only allow safe anchor tags
   * This provides defense-in-depth even though Serializer already sanitizes
   */
  private sanitizeHtml(html: string): string {
    // Create a temporary element to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Process all elements, keeping only safe ones
    const processNode = (node: Node): Node | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.cloneNode(true);
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        // Only allow anchor tags with safe attributes
        if (tagName === 'a') {
          const newA = document.createElement('a');
          const href = el.getAttribute('href');
          if (href && !href.toLowerCase().startsWith('javascript:')) {
            newA.setAttribute('href', href);
            newA.setAttribute('target', '_blank');
            newA.setAttribute('rel', 'noopener noreferrer');
            // Recursively process children
            el.childNodes.forEach((child) => {
              const processed = processNode(child);
              if (processed) newA.appendChild(processed);
            });
            return newA;
          }
        }

        // For other elements, just process children and return as text
        const fragment = document.createDocumentFragment();
        el.childNodes.forEach((child) => {
          const processed = processNode(child);
          if (processed) fragment.appendChild(processed);
        });
        return fragment;
      }
      return null;
    };

    const result = document.createElement('div');
    temp.childNodes.forEach((child) => {
      const processed = processNode(child);
      if (processed) result.appendChild(processed);
    });

    return result.innerHTML;
  }

  public showCompletion(stats: { timeSpentMs: number; paragraphsRead: number }) {
    const card = this.shadowRoot.getElementById('focus-card');
    const completion = this.shadowRoot.getElementById('completion-card');
    const timeStat = this.shadowRoot.getElementById('stat-time');
    const countStat = this.shadowRoot.getElementById('stat-count');
    const timeLeft = this.shadowRoot.getElementById('time-left');
    if (card && completion && timeStat && countStat) {
      card.style.display = 'none';
      completion.classList.add('visible');
      const mins = Math.floor(stats.timeSpentMs / 60000);
      const secs = Math.floor((stats.timeSpentMs % 60000) / 1000);
      timeStat.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      countStat.textContent = stats.paragraphsRead.toString();
      if (timeLeft) timeLeft.textContent = '';
    }
  }

  public setError(message: string) {
    const status = this.shadowRoot.getElementById('status');
    const card = this.shadowRoot.getElementById('focus-card');
    if (status) status.textContent = '';
    if (card) {
      card.textContent = message;
      card.classList.add('error');
    }
  }

  private setupEvents() {
    this.container.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.scrollController) {
          this.scrollController.handleWheel(e.deltaY);
        }
      },
      { passive: false, capture: true }
    );
    this.container.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          if (this.exitRequestedCallback) this.exitRequestedCallback();
          return;
        }
        if (this.keyboardController) {
          const handled = this.keyboardController.handleKey(e.key);
          if (handled) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        if (
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown'].includes(
            e.key
          )
        ) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      { capture: true }
    );
    this.setupClickNavigation();
  }

  private setupClickNavigation(): void {
    const paragraphContainer = this.shadowRoot.getElementById('paragraph-container');
    if (!paragraphContainer) return;

    paragraphContainer.addEventListener('click', (e) => {
      // Ignore clicks on links
      if ((e.target as HTMLElement).tagName === 'A') return;

      // Ignore if highlight modal is open
      const highlightModal = this.shadowRoot.getElementById('highlight-modal');
      if (highlightModal?.classList.contains('visible')) return;

      // Ignore if text is selected (user is highlighting)
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) return;

      // Navigate to next paragraph
      if (this.keyboardController) {
        this.keyboardController.handleKey('ArrowRight');
      }
    });
  }

  public mount() {
    if (!document.body.contains(this.container)) {
      this.originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.appendChild(this.container);
      requestAnimationFrame(() => {
        this.container.style.opacity = '1';
        this.container.focus();
      });
    }
  }

  public unmount() {
    if (document.body.contains(this.container)) {
      document.body.style.overflow = this.originalOverflow;
      document.body.removeChild(this.container);
    }
    if (this.scrollController) {
      this.scrollController.destroy();
      this.scrollController = null;
    }
    this.keyboardController = null;
    this.exitRequestedCallback = null;
    this.container.innerHTML = '';
  }

  public onExitRequested(callback: () => void) {
    this.exitRequestedCallback = callback;
  }
  public setVisible(visible: boolean) {
    this.container.style.opacity = visible ? '1' : '0';
  }
  public onMemoSave(callback: MemoCallback): void {
    this.memoCallback = callback;
  }
  public onBookmarkToggle(callback: BookmarkCallback): void {
    this.bookmarkCallback = callback;
  }
  public onFontChange(callback: FontChangeCallback): void {
    this.fontChangeCallback = callback;
  }
  public onOpacityChange(callback: OpacityChangeCallback): void {
    this.opacityChangeCallback = callback;
  }
  public onFontSizeChange(callback: FontSizeChangeCallback): void {
    this.fontSizeChangeCallback = callback;
  }
  public onEmailSubscribe(callback: EmailSubscribeCallback): void {
    this.emailSubscribeCallback = callback;
  }

  public setCurrentParagraphState(
    index: number,
    text: string,
    memo: string,
    isBookmarked: boolean
  ): void {
    this.currentParagraphIndex = index;
    this.currentParagraphText = text;
    this.currentMemo = memo;
    this.isCurrentBookmarked = isBookmarked;
    this.updateMemoButtonState();
    this.setBookmarkButtonState(isBookmarked);

    // Notify paragraph change callback (for PDF preview updates)
    if (this.paragraphChangeCallback) {
      const metadata = this.paragraphMetadata[index] || null;
      this.paragraphChangeCallback(index, metadata);
    }
  }

  private setBookmarkButtonState(isBookmarked: boolean): void {
    const btn = this.shadowRoot.getElementById('bookmark-btn');
    if (btn) btn.classList.toggle('active', isBookmarked);
  }

  public applyPreferences(
    fontFamily: string,
    opacityLevel: number,
    fontSize: number = 22,
    paragraphCount: 1 | 3 | 5 = 3,
    paragraphSpacing: 0 | 1 | 2 = 1
  ): void {
    const fontIndex = this.fontOptions.findIndex((f) => f.label === fontFamily);
    if (fontIndex >= 0) this.setFont(fontIndex);
    if (opacityLevel >= 0 && opacityLevel < this.opacityLevels.length)
      this.setOpacityLevel(opacityLevel);

    // Find closest font size in options
    let fontSizeIndex = this.fontSizeOptions.indexOf(fontSize);
    if (fontSizeIndex < 0) {
      // Find closest match
      fontSizeIndex = this.fontSizeOptions.findIndex((size) => size >= fontSize);
      if (fontSizeIndex < 0) fontSizeIndex = this.fontSizeOptions.length - 1;
    }
    this.currentFontSizeIndex = fontSizeIndex;
    this.applyFontSize();
    this.updateFontSizeButtons();

    // Apply paragraph count
    this.currentParagraphCount = paragraphCount;
    this.shadowRoot.querySelectorAll('.count-btn').forEach((btn) => {
      btn.classList.toggle(
        'active',
        parseInt((btn as HTMLElement).dataset.count || '3') === paragraphCount
      );
    });
    this.updateParagraphVisibility();

    // Apply paragraph spacing
    this.currentParagraphSpacing = paragraphSpacing;
    this.shadowRoot.querySelectorAll('.spacing-btn').forEach((btn) => {
      btn.classList.toggle(
        'active',
        parseInt((btn as HTMLElement).dataset.spacing || '1') === paragraphSpacing
      );
    });
    this.applyParagraphSpacing();
  }

  public onParagraphCountChange(callback: ParagraphCountChangeCallback): void {
    this.paragraphCountChangeCallback = callback;
  }

  public onParagraphSpacingChange(callback: ParagraphSpacingChangeCallback): void {
    this.paragraphSpacingChangeCallback = callback;
  }

  public getParagraphCount(): 1 | 3 | 5 {
    return this.currentParagraphCount;
  }

  private setupOnboarding(): void {
    this.onboardingGuide.setup();
    this.onboardingGuide.onComplete(() => {
      if (this.onboardingCompleteCallback) {
        this.onboardingCompleteCallback();
      }
    });
  }

  public showOnboarding(): void {
    this.onboardingGuide.show();
  }

  public hideOnboarding(): void {
    this.onboardingGuide.hide();
  }

  public onOnboardingComplete(callback: () => void): void {
    this.onboardingCompleteCallback = callback;
  }

  // Extension point: get slot element for injecting custom content (e.g., PDF preview)
  public getExtensionSlot(position: 'left'): HTMLElement | null {
    return this.shadowRoot.getElementById(`reader-extension-slot-${position}`);
  }

  // Get current paragraph metadata (for PDF position tracking)
  public getCurrentParagraphMetadata(): ParagraphMetadata | null {
    return this.paragraphMetadata[this.currentParagraphIndex] || null;
  }

  // Register callback for paragraph changes (for PDF preview updates)
  public onParagraphChange(callback: OnParagraphChangeCallback): void {
    this.paragraphChangeCallback = callback;
  }
}
