import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../../common/utils/mailer';
import { config } from '../../common/config/env';
import { BadRequestError, UnauthorizedError } from '../../common/utils/apiError';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  static async requestOTP(email: string, portal?: 'ADMIN' | 'STAFF' | 'STARTUP') {
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user && (portal === 'ADMIN' || portal === 'STAFF')) {
      throw new BadRequestError('Access Denied: You must be registered by an administrator to access this portal.');
    }

    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: { email, role: 'STARTUP' },
        });
        await tx.startupProfile.create({ data: { userId: newUser.id } });
        return newUser;
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { token: hashedOtp, type: 'EMAIL_OTP', userId: user.id, expiresAt },
    });

    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
        <h2 style="color: #2D3748;">Your Verification Code</h2>
        <p>Hello,</p>
        <p>Use the code below to sign in to the GTU Ventures Startup Portal. This code expires in 10 minutes.</p>
        <div style="background: #edf2f7; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #4A5568;">
          ${otp}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #718096;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `;

    await sendEmail(email, 'Your GTU Ventures Login Code', html);
    return { message: 'OTP sent successfully' };
  }

  static async verifyOTP(email: string, otp: string, deviceInfo?: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { startupProfile: true, adminProfile: true, startupApplication: true },
    });

    if (!user) throw new BadRequestError('User not found');

    const tokenRecord = await prisma.verificationToken.findFirst({
      where: { userId: user.id, type: 'EMAIL_OTP', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) throw new BadRequestError('OTP expired or not found');

    const isOtpValid = await bcrypt.compare(otp, tokenRecord.token);
    if (!isOtpValid) throw new BadRequestError('Invalid verification code');

    await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    return this.issueTokenPair(user, deviceInfo);
  }

  static async login(email: string, password: string, deviceInfo?: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { startupApplication: true },
    });

    if (!user || !user.password) {
      throw new UnauthorizedError('Invalid credentials or password not set');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedError('Invalid credentials');

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    return this.issueTokenPair(user, deviceInfo);
  }

  static async setPassword(userId: string, password: string, deviceInfo?: string) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, isSetupComplete: true },
      include: { startupApplication: true },
    });

    return this.issueTokenPair(user, deviceInfo);
  }

  static async refresh(refreshToken: string, deviceInfo?: string) {
    // 1. Verify the refresh token signature
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(refreshToken);

    // 2. Atomically claim the token — prevents race condition where two simultaneous
    //    requests both see isRevoked=false and both try to rotate
    const claimed = await prisma.userSession.updateMany({
      where: { tokenHash, isRevoked: false, expiresAt: { gt: new Date() } },
      data: { isRevoked: true, lastUsedAt: new Date() },
    });

    if (claimed.count === 0) {
      // Token either doesn't exist, already used, or expired
      // Check if it exists at all to distinguish reuse from unknown token
      const existing = await prisma.userSession.findUnique({ where: { tokenHash } });
      if (existing?.isRevoked) {
        // Genuine reuse — revoke entire family as security measure
        await prisma.userSession.updateMany({
          where: { family: existing.family },
          data: { isRevoked: true },
        });
        throw new UnauthorizedError('Session expired. Please log in again.');
      }
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 4. Issue new token pair under same family
    const session = await prisma.userSession.findUnique({ where: { tokenHash } });
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { startupApplication: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive');

    return this.issueTokenPair(user, deviceInfo, session!.family);
  }

  static async logout(refreshToken: string) {
    try {
      const tokenHash = hashToken(refreshToken);
      await prisma.userSession.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    } catch {
      // Silently ignore — token may already be invalid
    }
    return { message: 'Logged out successfully' };
  }

  static async logoutAll(userId: string) {
    await prisma.userSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    return { message: 'All sessions terminated' };
  }

  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    // Invalidate any previous reset tokens
    await prisma.verificationToken.deleteMany({ where: { userId: user.id, type: 'PASSWORD_RESET' } });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.verificationToken.create({
      data: { token: hashedToken, type: 'PASSWORD_RESET', userId: user.id, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendEmail(
      email,
      'Reset your password – GU Venture Portal',
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#4f46e5">Reset Your Password</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your account (<strong>${email}</strong>).</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Reset Password →
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280">This link expires in 1 hour. If you did not request this, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="font-size:12px;color:#6b7280">GU Incubation & Venture Portal · GTU Ventures, Ahmedabad</p>
      </div>`
    );

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  static async resetPassword(rawToken: string, newPassword: string, deviceInfo?: string) {
    const hashedToken = hashToken(rawToken);

    const tokenRecord = await prisma.verificationToken.findFirst({
      where: { token: hashedToken, type: 'PASSWORD_RESET', expiresAt: { gt: new Date() } },
    });

    if (!tokenRecord) throw new BadRequestError('Reset link is invalid or has expired.');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { password: hashedPassword, isSetupComplete: true },
      include: { startupApplication: true },
    });

    await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });

    return this.issueTokenPair(user, deviceInfo);
  }

  // Also expose a token-based set-password for VC first-login link
  static async generateSetPasswordToken(userId: string): Promise<string> {
    await prisma.verificationToken.deleteMany({ where: { userId, type: 'PASSWORD_RESET' } });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for first login
    await prisma.verificationToken.create({
      data: { token: hashedToken, type: 'PASSWORD_RESET', userId, expiresAt },
    });
    return rawToken;
  }

  static async requestApplicationEmailOTP(email: string, userId: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.verificationToken.create({
      data: { token: hashedOtp, type: 'APP_EMAIL_OTP', userId, expiresAt },
    });

    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
        <h2 style="color: #2D3748;">Application Verification Code</h2>
        <p>Hello,</p>
        <p>Use the code below to verify your email for your GTU Ventures Startup Application. This code expires in 10 minutes.</p>
        <div style="background: #edf2f7; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #4A5568;">
          ${otp}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #718096;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `;

    if (config.NODE_ENV === 'development') {
      console.log(`[DEBUG] OTP for ${email}: ${otp}`);
    }

    await sendEmail(email, 'Your GTU Ventures Application Verification Code', html);
    return { message: 'Verification OTP sent successfully' };
  }

  static async verifyApplicationEmailOTP(userId: string, otp: string) {
    const tokenRecord = await prisma.verificationToken.findFirst({
      where: { userId, type: 'APP_EMAIL_OTP', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) throw new BadRequestError('OTP expired or not found');

    const isOtpValid = await bcrypt.compare(otp, tokenRecord.token);
    if (!isOtpValid) throw new BadRequestError('Invalid verification code');

    await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });
    return { message: 'Email verified successfully' };
  }

  // ── Core: issue JWT (15 min) + refresh token (30 days) ──────────────────────

  private static async issueTokenPair(user: any, deviceInfo?: string, existingFamily?: string) {
    const accessToken = await this.generateAccessToken(user);
    const { refreshToken, tokenHash, family, expiresAt } = this.generateRefreshToken(user.id, existingFamily);

    // Jitter expiry by 0–5 minutes to avoid thundering herd
    const jitterMs = Math.floor(Math.random() * 5 * 60 * 1000);
    const jitteredExpiry = new Date(expiresAt.getTime() + jitterMs);

    // Truncate deviceInfo to prevent storage abuse from oversized User-Agent strings
    const safeDeviceInfo = deviceInfo ? deviceInfo.slice(0, 500) : undefined;

    // On fresh login (no existing family), clean up expired sessions for this user
    if (!existingFamily) {
      await prisma.userSession.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
      });
    }

    await prisma.userSession.create({
      data: { userId: user.id, tokenHash, family, deviceInfo: safeDeviceInfo, expiresAt: jitteredExpiry },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSetupComplete: user.isSetupComplete,
        applicationStatus: user.startupApplication?.status || 'DRAFT',
      },
      accessToken,
      refreshToken,
    };
  }

  private static async generateAccessToken(user: any) {
    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: { include: { permissions: { include: { module: true } } } },
          },
        },
      },
    });

    const roles = userWithRoles?.userRoles.map((ur: any) => ur.role.code) || [];
    const permissions: Record<string, string[]> = {};

    userWithRoles?.userRoles.forEach((ur: any) => {
      ur.role.permissions.forEach((p: any) => {
        const key = p.module.key;
        if (!permissions[key]) permissions[key] = [];
        p.actions.forEach((action: string) => {
          if (!permissions[key].includes(action)) permissions[key].push(action);
        });
      });
    });

    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, roles, permissions },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as any }
    );
  }

  private static generateRefreshToken(userId: string, existingFamily?: string) {
    const family = existingFamily || crypto.randomUUID();

    const expiresIn = config.REFRESH_TOKEN_EXPIRES_IN;
    // Parse "30d" → 30 days. Requires format: "<number>d"
    const days = Number(expiresIn.replace(/[^0-9]/g, ''));
    if (!days) throw new Error(`Invalid REFRESH_TOKEN_EXPIRES_IN format: "${expiresIn}". Use e.g. "30d"`);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Sign the JWT — the full signed token string is what we hash for DB lookup
    const refreshToken = jwt.sign(
      { userId, family, jti: crypto.randomBytes(16).toString('hex') },
      config.REFRESH_TOKEN_SECRET,
      { expiresIn: expiresIn as any }
    );

    // Hash the full token string — this is what we store and look up
    const tokenHash = hashToken(refreshToken);

    return { refreshToken, tokenHash, family, expiresAt };
  }
}
