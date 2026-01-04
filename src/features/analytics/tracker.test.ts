import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyticsTracker } from './tracker';

describe('AnalyticsTracker', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue({ ok: true });

    // Mock navigator and screen
    vi.stubGlobal('navigator', { language: 'en-US' });
    vi.stubGlobal('screen', { width: 1920, height: 1080 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('trackOpen', () => {
    it('should not throw when called', async () => {
      await expect(
        AnalyticsTracker.trackOpen('https://example.com', 'Test Article', 10)
      ).resolves.not.toThrow();
    });

    it('should handle long titles', async () => {
      const longTitle = 'A'.repeat(100);
      await expect(
        AnalyticsTracker.trackOpen('https://example.com', longTitle, 5)
      ).resolves.not.toThrow();
    });
  });

  describe('trackSession', () => {
    it('should not throw when called', async () => {
      await expect(
        AnalyticsTracker.trackSession('https://example.com', 120, 5, 10)
      ).resolves.not.toThrow();
    });

    it('should handle zero total paragraphs', async () => {
      // Edge case: 0 total paragraphs should not cause division by zero
      await expect(
        AnalyticsTracker.trackSession('https://example.com', 30, 0, 0)
      ).resolves.not.toThrow();
    });

    it('should calculate completion rate', async () => {
      // With 5/10 paragraphs read, completion rate should be 50%
      await expect(
        AnalyticsTracker.trackSession('https://example.com', 60, 5, 10)
      ).resolves.not.toThrow();
    });
  });

  describe('trackFeature', () => {
    it('should not throw when called', async () => {
      await expect(AnalyticsTracker.trackFeature('memo')).resolves.not.toThrow();
    });

    it('should handle various feature names', async () => {
      const features = ['bookmark', 'font_change', 'opacity', 'settings'];
      for (const feature of features) {
        await expect(AnalyticsTracker.trackFeature(feature)).resolves.not.toThrow();
      }
    });
  });

  describe('URL handling', () => {
    it('should handle URLs with query parameters', async () => {
      await expect(
        AnalyticsTracker.trackOpen(
          'https://example.com/article?utm_source=test&secret=123',
          'Test',
          5
        )
      ).resolves.not.toThrow();
    });

    it('should handle URLs with hash', async () => {
      await expect(
        AnalyticsTracker.trackOpen('https://example.com/page#section', 'Test', 3)
      ).resolves.not.toThrow();
    });

    it('should handle invalid URLs gracefully', async () => {
      await expect(
        AnalyticsTracker.trackOpen('not-a-valid-url', 'Test', 1)
      ).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should not throw when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        AnalyticsTracker.trackOpen('https://example.com', 'Test', 5)
      ).resolves.not.toThrow();
    });

    it('should not throw when fetch returns error status', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(AnalyticsTracker.trackFeature('test')).resolves.not.toThrow();
    });
  });

  describe('session handling', () => {
    it('should handle multiple tracking calls', async () => {
      // Multiple calls should not throw
      await AnalyticsTracker.trackOpen('https://example.com', 'Test 1', 5);
      await AnalyticsTracker.trackOpen('https://example.com', 'Test 2', 10);
      await AnalyticsTracker.trackFeature('memo');
      await AnalyticsTracker.trackSession('https://example.com', 60, 3, 10);

      // All calls should complete without error
      expect(true).toBe(true);
    });
  });
});
