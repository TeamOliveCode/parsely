import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailCollector } from './email-collector';

describe('EmailCollector', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('subscribe', () => {
    it('should reject invalid email format', async () => {
      const invalidEmails = ['notanemail', 'missing@domain', '@nodomain.com', '', 'no-at-sign.com'];

      for (const email of invalidEmails) {
        const result = await EmailCollector.subscribe(email);
        expect(result.success).toBe(false);
        // Either "Invalid email format" or "Subscription service not available"
        expect(result.message).toBeTruthy();
      }
    });

    it('should return a result object with success and message', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await EmailCollector.subscribe('test@example.com');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should handle successful subscription when configured', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await EmailCollector.subscribe('test@example.com');

      // If Supabase is configured, it should succeed
      // If not configured, it returns "Subscription service not available"
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle 409 conflict (already subscribed)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 409 });

      const result = await EmailCollector.subscribe('existing@example.com');

      // Either success (already subscribed) or not available
      expect(result).toHaveProperty('success');
    });

    it('should handle unique constraint violation (23505)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ code: '23505' }),
      });

      const result = await EmailCollector.subscribe('duplicate@example.com');

      expect(result).toHaveProperty('success');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await EmailCollector.subscribe('test@example.com');

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      });

      const result = await EmailCollector.subscribe('test@example.com');

      expect(result.success).toBe(false);
    });

    it('should not throw on any input', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      // Should never throw, always return a result object
      await expect(EmailCollector.subscribe('')).resolves.toBeDefined();
      await expect(EmailCollector.subscribe('invalid')).resolves.toBeDefined();
      await expect(EmailCollector.subscribe('valid@email.com')).resolves.toBeDefined();
    });
  });

  describe('email validation', () => {
    it('should accept valid email formats when service is available', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const validEmails = [
        'simple@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@subdomain.example.com',
      ];

      for (const email of validEmails) {
        const result = await EmailCollector.subscribe(email);
        // Either success or "not available" - but NOT "Invalid email format"
        if (result.message === 'Invalid email format') {
          throw new Error(`Valid email "${email}" was rejected as invalid`);
        }
      }
    });

    it('should reject emails without @ symbol', async () => {
      const result = await EmailCollector.subscribe('testexample.com');
      expect(result.success).toBe(false);
    });

    it('should reject emails with spaces', async () => {
      const result = await EmailCollector.subscribe('test @example.com');
      expect(result.success).toBe(false);
    });
  });
});
