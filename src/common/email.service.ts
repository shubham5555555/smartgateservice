import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

interface BrevoEmailPayload {
  subject: string;
  htmlContent: string;
  sender: { name: string; email: string | undefined };
  to: Array<{ email: string }>;
}

interface BrevoApiClient {
  transactionalEmails: {
    sendTransacEmail(payload: BrevoEmailPayload): Promise<unknown>;
  };
}

interface BrevoApiError {
  message?: string;
  response?: {
    data?: unknown;
    body?: unknown;
    status?: number;
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiInstance: BrevoApiClient;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');

    if (!apiKey) {
      this.logger.error('❌ BREVO_API_KEY is not configured');
      throw new Error('BREVO_API_KEY is not configured');
    }

    const trimmedKey = apiKey.trim();
    this.logger.log(
      `🔑 Brevo API Key loaded: ${trimmedKey.substring(0, 20)}...${trimmedKey.substring(trimmedKey.length - 10)}`,
    );

    const ClientClass = BrevoClient as unknown as new (opts: {
      apiKey: string;
    }) => BrevoApiClient;
    this.apiInstance = new ClientClass({ apiKey: trimmedKey });

    this.logger.log('✅ Email service configured successfully with Brevo API');
  }

  /**
   * Send OTP email for registration
   */
  async sendRegistrationOtp(email: string, otp: string): Promise<void> {
    try {
      const senderEmail = this.configService.get<string>(
        'BREVO_SENDER_EMAIL',
        'ershubhamkaushik05@gmail.com',
      );

      await this.apiInstance.transactionalEmails.sendTransacEmail({
        subject: 'Verify Your Email - Smart Gate',
        htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Smart Gate</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Digital Gatekeeper</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
            <p>Thank you for registering with Smart Gate! Please use the OTP below to verify your email address:</p>
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 0;">${otp}</p>
            </div>
            <p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Smart Gate. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
        sender: { name: 'Smart Gate', email: senderEmail },
        to: [{ email }],
      });
      this.logger.log(`✅ Registration OTP email sent to ${email}`);
    } catch (error: unknown) {
      const err = error as BrevoApiError;
      const errorMessage = err.message ?? 'Unknown error';
      this.logger.error(
        `❌ Failed to send registration OTP email: ${errorMessage}`,
      );
      if (err.response) {
        this.logger.error(
          `❌ Brevo API Response: ${JSON.stringify(err.response.data ?? err.response.body)}`,
        );
        this.logger.error(`❌ Status Code: ${err.response.status}`);
      }
      throw new Error(`Failed to send email: ${errorMessage}`);
    }
  }

  /**
   * Send OTP email for password reset
   */
  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    try {
      const senderEmail = this.configService.get<string>(
        'BREVO_SENDER_EMAIL',
        'noreply@smartgate.com',
      );

      await this.apiInstance.transactionalEmails.sendTransacEmail({
        subject: 'Reset Your Password - Smart Gate',
        htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Smart Gate</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            <p>We received a request to reset your password. Please use the OTP below to verify your identity:</p>
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 0;">${otp}</p>
            </div>
            <p style="color: #666; font-size: 14px;">This OTP will expire in 10 minutes.</p>
            <p style="color: #ff6b6b; font-size: 14px;"><strong>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</strong></p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Smart Gate. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
        sender: { name: 'Smart Gate', email: senderEmail },
        to: [{ email }],
      });
      this.logger.log(`✅ Password reset OTP email sent to ${email}`);
    } catch (error: unknown) {
      const err = error as BrevoApiError;
      const errorMessage = err.message ?? 'Unknown error';
      this.logger.error(
        `❌ Failed to send password reset OTP email: ${errorMessage}`,
      );
      if (err.response) {
        this.logger.error(
          `❌ Brevo API Response: ${JSON.stringify(err.response.data ?? err.response.body)}`,
        );
        this.logger.error(`❌ Status Code: ${err.response.status}`);
      }
      throw new Error(`Failed to send email: ${errorMessage}`);
    }
  }

  /**
   * Send welcome email after admin approval
   */
  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    try {
      const senderEmail = this.configService.get<string>(
        'BREVO_SENDER_EMAIL',
        'ershubhamkaushik05@gmail.com',
      );

      await this.apiInstance.transactionalEmails.sendTransacEmail({
        subject: 'Welcome to Smart Gate!',
        htmlContent: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to Smart Gate!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Hello ${fullName}!</h2>
            <p>Your account has been approved by the administrator. You can now log in to the Smart Gate app using your email and password.</p>
            <div style="background: white; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>What's Next?</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Download the Smart Gate mobile app</li>
                <li>Log in with your email and password</li>
                <li>Start managing your gate access, visitors, and more!</li>
              </ul>
            </div>
            <p>If you have any questions, please contact your building administrator.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Smart Gate. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
        sender: { name: 'Smart Gate', email: senderEmail },
        to: [{ email }],
      });
      this.logger.log(`✅ Welcome email sent to ${email}`);
    } catch (error: unknown) {
      const err = error as BrevoApiError;
      const errorMessage = err.message ?? 'Unknown error';
      this.logger.error(`❌ Failed to send welcome email: ${errorMessage}`);
      // Don't throw error for welcome email, just log it
    }
  }
}
