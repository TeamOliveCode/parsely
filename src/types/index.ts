// Extracted article from page
export interface ExtractedArticle {
  title: string;
  content: string;
  textContent: string;
  byline: string | null;
  excerpt: string | null;
  siteName: string | null;
}

// User memo on a paragraph
export interface Memo {
  paragraphIndex: number;
  text: string;
  createdAt: number;
}

// User bookmark
export interface Bookmark {
  url: string;
  title: string;
  paragraphIndex: number;
  paragraphPreview: string;
  createdAt: number;
}

// Highlight annotation
export interface HighlightNote {
  paragraphIndex: number;
  selectedText: string;
  note: string;
  createdAt: number;
}

// User preferences
export interface UserPreferences {
  fontFamily: string;
  opacityLevel: number;
  fontSize: number;
  paragraphCount: 1 | 3 | 5;
  paragraphSpacing: 0 | 1 | 2; // 0: compact, 1: normal, 2: relaxed
}

// Subscription status
export interface SubscriptionStatus {
  useCount: number;
  hasSubscribed: boolean;
  dismissedAt?: number;
}

// State change listener type
export type StateChangeListener = (
  index: number,
  text: string,
  remainingMinutes: number,
  isCompleted: boolean
) => void;

// UI callback types
export type MemoCallback = (paragraphIndex: number, text: string) => void;
export type BookmarkCallback = (paragraphIndex: number, paragraphText: string) => void;
export type FontChangeCallback = (fontFamily: string) => void;
export type OpacityChangeCallback = (level: number) => void;
export type FontSizeChangeCallback = (fontSize: number) => void;
export type ParagraphCountChangeCallback = (count: 1 | 3 | 5) => void;
export type ParagraphSpacingChangeCallback = (spacing: 0 | 1 | 2) => void;
export type EmailSubscribeCallback = (
  email: string
) => Promise<{ success: boolean; message: string }>;
export type HighlightNoteCallback = (
  paragraphIndex: number,
  selectedText: string,
  note: string
) => void;
export type GoToParagraphCallback = (paragraphIndex: number) => void;
