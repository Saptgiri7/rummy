import { eq, and, gt, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { otpVerifications, OtpVerification } from '../schema/otp';

export async function createOtpRecord(
  identifier: string,
  otpHash: string,
  expiresAt: Date,
  purpose = 'SIGNUP'
): Promise<OtpVerification> {
  const [record] = await db
    .insert(otpVerifications)
    .values({
      identifier,
      otpHash,
      expiresAt,
      purpose,
      attempts: 0,
      isUsed: false
    })
    .returning();

  if (!record) {
    throw new Error('Failed to create OTP verification record');
  }

  return record;
}

export async function findLatestValidOtp(
  identifier: string,
  purpose = 'SIGNUP'
): Promise<OtpVerification | null> {
  const [record] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.identifier, identifier),
        eq(otpVerifications.purpose, purpose),
        eq(otpVerifications.isUsed, false),
        gt(otpVerifications.expiresAt, new Date())
      )
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  return record ?? null;
}

export async function incrementOtpAttempts(id: string): Promise<void> {
  await db
    .update(otpVerifications)
    .set({
      attempts: sql`${otpVerifications.attempts} + 1`
    })
    .where(eq(otpVerifications.id, id));
}

export async function markOtpUsed(id: string): Promise<void> {
  await db
    .update(otpVerifications)
    .set({
      isUsed: true
    })
    .where(eq(otpVerifications.id, id));
}
