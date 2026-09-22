import crypto from 'node:crypto';
import {
  createOtpRecord,
  findLatestValidOtp,
  incrementOtpAttempts,
  markOtpUsed
} from '@rummy/database';
import { ErrorCode } from '@rummy/shared';
import { emailService } from './email-service.js';

export interface OtpSendResult {
  success: boolean;
  message: string;
  cooldownSeconds?: number;
  devOtpCode?: string;
  previewUrl?: string;
}

export interface OtpVerifyResult {
  success: boolean;
  message?: string;
  code?: ErrorCode;
}

class OtpService {
  private lastSentMap = new Map<string, number>();
  private readonly COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
  private readonly EXPIRY_MINUTES = 10; // 10 minutes valid

  /**
   * Send a 6-digit OTP to either an email address or a phone number.
   */
  async sendOtp(identifier: string, type: 'EMAIL' | 'PHONE', purpose = 'SIGNUP'): Promise<OtpSendResult> {
    const cleanIdentifier = identifier.trim();
    const now = Date.now();
    const lastSent = this.lastSentMap.get(cleanIdentifier);

    if (lastSent && now - lastSent < this.COOLDOWN_MS) {
      const remainingSec = Math.ceil((this.COOLDOWN_MS - (now - lastSent)) / 1000);
      return {
        success: false,
        cooldownSeconds: remainingSec,
        message: `Please wait ${remainingSec}s before requesting a new code.`
      };
    }

    // Generate secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(now + this.EXPIRY_MINUTES * 60 * 1000);

    // Persist to database
    await createOtpRecord(cleanIdentifier, otpHash, expiresAt, purpose);
    this.lastSentMap.set(cleanIdentifier, now);

    // Deliver OTP via Email if type is EMAIL
    let deliveryMessage = `Verification code sent to ${cleanIdentifier}`;
    let previewUrl: string | undefined;
    if (type === 'EMAIL') {
      const emailResult = await emailService.sendOtpEmail(cleanIdentifier, rawOtp, purpose);
      previewUrl = emailResult.previewUrl;
      deliveryMessage = emailResult.previewUrl
        ? `Verification code sent to ${cleanIdentifier}. (Dev preview: ${emailResult.previewUrl})`
        : `Verification code dispatched to ${cleanIdentifier}. Please check your inbox.`;
    } else {
      console.log(`\n==================================================`);
      console.log(`📱 [SMS/PHONE OTP] Code for [${cleanIdentifier}]: ${rawOtp}`);
      console.log(`==================================================\n`);
    }

    return {
      success: true,
      message: deliveryMessage,
      previewUrl,
      devOtpCode: process.env['NODE_ENV'] === 'test' ? rawOtp : (type === 'PHONE' && process.env['NODE_ENV'] !== 'production' ? rawOtp : undefined)
    };
  }

  /**
   * Verify an OTP submitted by the user.
   */
  async verifyOtp(identifier: string, submittedOtp: string, purpose = 'SIGNUP'): Promise<OtpVerifyResult> {
    const cleanIdentifier = identifier.trim();
    const record = await findLatestValidOtp(cleanIdentifier, purpose);

    if (!record) {
      return {
        success: false,
        code: ErrorCode.OTP_EXPIRED,
        message: 'Verification code has expired or is invalid. Please request a new code.'
      };
    }

    if (record.attempts >= 3) {
      await markOtpUsed(record.id); // Invalidate locked OTP
      return {
        success: false,
        code: ErrorCode.INVALID_OTP,
        message: 'Maximum verification attempts exceeded. Please request a new code.'
      };
    }

    const hashedInput = crypto.createHash('sha256').update(submittedOtp.trim()).digest('hex');

    if (hashedInput !== record.otpHash) {
      await incrementOtpAttempts(record.id);
      return {
        success: false,
        code: ErrorCode.INVALID_OTP,
        message: 'Incorrect verification code.'
      };
    }

    // Success: mark used
    await markOtpUsed(record.id);
    this.lastSentMap.delete(cleanIdentifier);

    return { success: true };
  }
}

export const otpService = new OtpService();
