import { recordAnalyticsEvent } from '@rummy/database';

class AnalyticsService {
  /**
   * Record a platform event asynchronously without blocking requests.
   */
  trackEvent(
    eventType: string,
    userId?: string | null,
    metadata?: Record<string, unknown> | null,
    ipAddress?: string | null
  ): void {
    recordAnalyticsEvent(eventType, userId, metadata, ipAddress).catch((err) => {
      console.error('[ANALYTICS] Failed to record event:', err);
    });
  }
}

export const analyticsService = new AnalyticsService();
