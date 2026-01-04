/**
 * Umami Cloud Analytics Tracker for Parsely
 *
 * Uses Umami Cloud's official API endpoint.
 * Privacy-focused: No PII collected, GDPR/CCPA compliant.
 *
 * Setup instructions:
 * 1. Sign up at https://cloud.umami.is/signup (free tier available)
 * 2. Add a website in the Umami dashboard
 * 3. Copy the Website ID (UUID format) and paste it in WEBSITE_ID below
 *
 * @see https://umami.is/docs/api/sending-stats
 */

interface UmamiPayload {
  hostname: string;
  language: string;
  screen: string;
  url: string;
  website: string;
  name?: string; // event name
  data?: Record<string, unknown>; // custom event data
}

interface UmamiRequest {
  type: 'event';
  payload: UmamiPayload;
}

export class AnalyticsTracker {
  // Umami Cloud API endpoint
  private static readonly ENDPOINT = 'https://cloud.umami.is/api/send';

  // Your Umami Website ID (get this from Umami Cloud dashboard)
  // Set via VITE_UMAMI_WEBSITE_ID environment variable
  // Leave empty to disable analytics
  private static readonly WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID || '';

  private static sessionId: string = '';

  private static getSessionId(): string {
    if (!this.sessionId) {
      this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    return this.sessionId;
  }

  /**
   * Track when reader mode is opened
   */
  static async trackOpen(url: string, title: string, paragraphCount: number): Promise<void> {
    await this.send('reader_open', url, {
      title: this.truncate(title, 50),
      paragraphCount,
    });
  }

  /**
   * Track reading session completion
   */
  static async trackSession(
    url: string,
    readTimeSeconds: number,
    paragraphsRead: number,
    totalParagraphs: number
  ): Promise<void> {
    const completionRate =
      totalParagraphs > 0 ? Math.round((paragraphsRead / totalParagraphs) * 100) : 0;

    await this.send('reader_session', url, {
      readTime: readTimeSeconds,
      paragraphsRead,
      totalParagraphs,
      completionRate,
    });
  }

  /**
   * Track feature usage (memo, bookmark, font change, etc.)
   */
  static async trackFeature(feature: string): Promise<void> {
    await this.send(`feature_${feature}`);
  }

  /**
   * Send event to Umami Cloud
   * @see https://umami.is/docs/api/sending-stats
   */
  private static async send(
    eventName: string,
    pageUrl?: string,
    eventData?: Record<string, unknown>
  ): Promise<void> {
    if (!this.WEBSITE_ID) {
      // Analytics disabled - log locally for debugging
      console.debug('[Parsely Analytics]', { eventName, pageUrl, eventData });
      return;
    }

    try {
      const payload: UmamiPayload = {
        hostname: 'parsely-extension',
        language: navigator.language || 'en',
        screen: `${screen.width}x${screen.height}`,
        url: pageUrl ? this.anonymizeUrl(pageUrl) : '/extension',
        website: this.WEBSITE_ID,
        name: eventName,
      };

      // Add custom event data if provided
      if (eventData) {
        payload.data = {
          sessionId: this.getSessionId(),
          ...eventData,
        };
      }

      const request: UmamiRequest = {
        type: 'event',
        payload,
      };

      await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Parsely Extension/0.1.0',
        },
        body: JSON.stringify(request),
      });
    } catch (error) {
      // Silently fail - analytics should never break the extension
      console.debug('[Parsely Analytics] Failed to send:', error);
    }
  }

  /**
   * Remove sensitive parts from URL (query params, hash)
   * Only keeps protocol, hostname, and pathname
   */
  private static anonymizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Truncate string to max length (Umami limits event names to 50 chars)
   */
  private static truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
  }
}
