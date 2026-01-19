/**
 * Storage for analytics-related data
 * Handles anonymous user identification and activity tracking
 */

export interface AnalyticsData {
  userId: string;
  installDate: number;
  lastActiveDate: string; // YYYY-MM-DD format for daily tracking
  lastActiveWeek: string; // YYYY-WW format for weekly tracking
}

export class AnalyticsStorage {
  private static readonly ANALYTICS_KEY = 'parsely_analytics';

  /**
   * Generate a random UUID v4
   */
  private static generateUserId(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  private static getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current week in YYYY-WW format
   */
  private static getCurrentWeek(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Get or create analytics data
   */
  static async getAnalyticsData(): Promise<AnalyticsData> {
    const result = await browser.storage.local.get(this.ANALYTICS_KEY);
    const data = result[this.ANALYTICS_KEY] as AnalyticsData | undefined;

    if (data?.userId) {
      return data;
    }

    // First time - create new user
    const newData: AnalyticsData = {
      userId: this.generateUserId(),
      installDate: Date.now(),
      lastActiveDate: '',
      lastActiveWeek: '',
    };
    await browser.storage.local.set({ [this.ANALYTICS_KEY]: newData });
    return newData;
  }

  /**
   * Get user ID (creates one if not exists)
   */
  static async getUserId(): Promise<string> {
    const data = await this.getAnalyticsData();
    return data.userId;
  }

  /**
   * Check if this is a new daily active user (first use today)
   * Returns true if this is the first activity today
   */
  static async checkAndUpdateDailyActive(): Promise<boolean> {
    const data = await this.getAnalyticsData();
    const today = this.getCurrentDate();

    if (data.lastActiveDate === today) {
      return false; // Already tracked today
    }

    // Update last active date
    data.lastActiveDate = today;
    await browser.storage.local.set({ [this.ANALYTICS_KEY]: data });
    return true;
  }

  /**
   * Check if this is a new weekly active user (first use this week)
   * Returns true if this is the first activity this week
   */
  static async checkAndUpdateWeeklyActive(): Promise<boolean> {
    const data = await this.getAnalyticsData();
    const currentWeek = this.getCurrentWeek();

    if (data.lastActiveWeek === currentWeek) {
      return false; // Already tracked this week
    }

    // Update last active week
    data.lastActiveWeek = currentWeek;
    await browser.storage.local.set({ [this.ANALYTICS_KEY]: data });
    return true;
  }

  /**
   * Get install date timestamp
   */
  static async getInstallDate(): Promise<number> {
    const data = await this.getAnalyticsData();
    return data.installDate;
  }

  /**
   * Check if this is the first time the extension is being used
   * (installDate was just created in this session)
   */
  static async isFirstInstall(): Promise<boolean> {
    const result = await browser.storage.local.get(this.ANALYTICS_KEY);
    return !result[this.ANALYTICS_KEY];
  }
}
