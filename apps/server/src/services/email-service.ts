import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Ensure environment variables are loaded regardless of ESM evaluation order or cwd
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(currentDir, '../../../../.env'),
  path.resolve(process.cwd(), '../../.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured = false;
  private initializingPromise: Promise<void> | null = null;

  constructor() {
    this.initTransporter();
  }

  private async initTransporter(): Promise<void> {
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = (async () => {
      const service = process.env['SMTP_SERVICE']; // e.g. 'gmail', 'SendGrid', 'Brevo'
      const host = process.env['SMTP_HOST'];
      const user = process.env['SMTP_USER'];
      const pass = process.env['SMTP_PASS'];

      if ((service || host) && user && pass) {
        const port = process.env['SMTP_PORT'] ? parseInt(process.env['SMTP_PORT'], 10) : 587;
        const secure = process.env['SMTP_SECURE'] === 'true' || port === 465;

        if (service) {
          this.transporter = nodemailer.createTransport({
            service,
            auth: { user, pass }
          });
          this.isConfigured = true;
          console.log(`📧 [EMAIL SERVICE] Initialized SMTP transport using service "${service}" (${user})`);
        } else if (host) {
          this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass }
          });
          this.isConfigured = true;
          console.log(`📧 [EMAIL SERVICE] Initialized SMTP transport via ${host}:${port} (${user})`);
        }
      } else {
        // In dev/test when SMTP is not configured, provision an Ethereal test account
        try {
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });
          this.isConfigured = false;
          console.log(`📧 [EMAIL SERVICE] Real SMTP not configured in .env. Ethereal dev mailbox active (${testAccount.user})`);
          console.log(`ℹ️ [EMAIL SERVICE] To send to real inboxes, configure SMTP_USER, SMTP_PASS, and SMTP_HOST (or SMTP_SERVICE=gmail) in .env`);
        } catch (err) {
          console.warn('[EMAIL SERVICE] Could not create Ethereal test account; emails will log to console:', err);
        }
      }
    })();

    return this.initializingPromise;
  }

  /**
   * Generates a casino-grade branded HTML email template for 6-digit OTP verification.
   */
  private generateOtpEmailHtml(code: string, purpose: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06090e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-height: 100vh; background-color: #06090e; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: linear-gradient(180deg, #111827 0%, #0b0f19 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="font-size: 28px; line-height: 1; margin-bottom: 8px;">🂡</div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.05em; color: #d4af37; text-transform: uppercase;">
                Rummy Master
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase;">
                Authentic 13-Card Indian Rummy
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                ${purpose === 'SIGNUP' ? 'Verify Your Account' : 'Security Verification Code'}
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Use the 6-digit verification code below to complete your ${purpose === 'SIGNUP' ? 'registration' : 'sign-in request'}. This code is valid for <strong>10 minutes</strong>.
              </p>

              <!-- Code Box -->
              <div style="background: rgba(212, 175, 55, 0.06); border: 1.5px solid #d4af37; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #f8fafc; font-variant-numeric: tabular-nums;">
                  ${code}
                </div>
                <div style="margin-top: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #d4af37; font-weight: 600;">
                  One-Time Passcode
                </div>
              </div>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 14px; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 12px; line-height: 1.5; color: #cbd5e1;">
                    🔒 <strong>Security Warning:</strong> Never share this code with anyone. Our support team will never ask for your verification code. If you did not request this email, you can safely ignore it.
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; color: #64748b;">
                Thank you for playing with Rummy Master.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                © ${new Date().getFullYear()} Rummy Master. All rights reserved. Zero chips, pure skill.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Sends an OTP verification code to an email address.
   */
  async sendOtpEmail(toEmail: string, code: string, purpose = 'SIGNUP'): Promise<{ sent: boolean; previewUrl?: string }> {
    await this.initTransporter();

    const fromAddress = process.env['SMTP_FROM'] || '"Rummy Master" <noreplyrummymaster@gmail.com>';
    const subject = `Your Verification Code is ${code} — Rummy Master`;
    const text = `Your Rummy Master verification code is: ${code}\n\nThis code will expire in 10 minutes. Never share this code with anyone.`;
    const html = this.generateOtpEmailHtml(code, purpose);

    if (!this.transporter) {
      console.log(`\n==================================================`);
      console.log(`📧 [FALLBACK EMAIL] To: ${toEmail} | Code: ${code}`);
      console.log(`==================================================\n`);
      return { sent: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text,
        html
      });

      let previewUrl: string | undefined;
      if (!this.isConfigured) {
        previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
        if (previewUrl) {
          console.log(`📬 [EMAIL SERVICE] Email delivered to Ethereal! Preview URL:\n${previewUrl}\n`);
        }
      } else {
        console.log(`📧 [EMAIL SERVICE] OTP email sent successfully to ${toEmail} (MessageId: ${info.messageId})`);
      }

      return { sent: true, previewUrl };
    } catch (err) {
      console.error(`[EMAIL SERVICE] Failed to send email to ${toEmail}:`, err);
      return { sent: false };
    }
  }
}

export const emailService = new EmailService();
