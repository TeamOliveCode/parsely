/**
 * Email Collector using Supabase
 *
 * Setup instructions:
 * 1. Create a Supabase project at https://supabase.com (free tier available)
 * 2. Create a table called "subscribers" with the following schema:
 *    - id: uuid (primary key, default: gen_random_uuid())
 *    - email: text (unique, not null)
 *    - source: text (default: 'parsely-extension')
 *    - created_at: timestamptz (default: now())
 * 3. Enable Row Level Security (RLS) and add policy for insert:
 *    CREATE POLICY "Allow anonymous insert" ON subscribers FOR INSERT WITH CHECK (true);
 * 4. Get your project URL and anon key from Settings > API
 * 5. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
 */

export class EmailCollector {
  // Your Supabase project URL - set via VITE_SUPABASE_URL environment variable
  private static readonly SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

  // Your Supabase anon/public key - set via VITE_SUPABASE_ANON_KEY environment variable
  private static readonly SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // Table name in Supabase
  private static readonly TABLE_NAME = 'subscribers';

  /**
   * Subscribe an email to receive monthly reports
   * @returns true if successful, false if already subscribed, throws on error
   */
  static async subscribe(email: string): Promise<{ success: boolean; message: string }> {
    if (!this.SUPABASE_URL || !this.SUPABASE_ANON_KEY) {
      console.debug('[EmailCollector] Supabase not configured');
      return { success: false, message: 'Subscription service not available' };
    }

    // Validate email format
    if (!this.isValidEmail(email)) {
      return { success: false, message: 'Invalid email format' };
    }

    try {
      const response = await fetch(`${this.SUPABASE_URL}/rest/v1/${this.TABLE_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${this.SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          source: 'parsely-extension',
        }),
      });

      if (response.ok) {
        return { success: true, message: 'Successfully subscribed!' };
      }

      // Handle duplicate email (409 Conflict or 23505 unique violation)
      if (response.status === 409) {
        return { success: true, message: 'You are already subscribed!' };
      }

      const errorData = await response.json().catch(() => ({}));

      // Supabase returns 400 with code 23505 for unique constraint violation
      if (errorData.code === '23505') {
        return { success: true, message: 'You are already subscribed!' };
      }

      console.debug('[EmailCollector] Error:', errorData);
      return { success: false, message: 'Failed to subscribe. Please try again.' };
    } catch (error) {
      console.debug('[EmailCollector] Network error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  /**
   * Basic email validation
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
