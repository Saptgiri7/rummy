import { desc } from 'drizzle-orm';
import { db } from '../db';
import { analyticsEvents, AnalyticsEvent } from '../schema/analytics';

export async function recordAnalyticsEvent(
  eventType: string,
  userId?: string | null,
  metadata?: Record<string, unknown> | null,
  ipAddress?: string | null
): Promise<AnalyticsEvent> {
  const [event] = await db
    .insert(analyticsEvents)
    .values({
      eventType,
      userId: userId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: ipAddress ?? null
    })
    .returning();

  if (!event) {
    throw new Error('Failed to record analytics event');
  }

  return event;
}

export async function getRecentAnalyticsEvents(limit = 50): Promise<AnalyticsEvent[]> {
  return await db
    .select()
    .from(analyticsEvents)
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(limit);
}
