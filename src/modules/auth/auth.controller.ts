import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ApplicationsService } from '../applications/applications.service';
import asyncHandler from '../../common/utils/asyncHandler';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  path: '/',
};

function getRefreshToken(req: Request): string | undefined {
  // Parse cookie header manually (avoids cookie-parser dependency)
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions);
}

function clearRefreshCookie(res: Response) {
  // Must match the same attributes used when setting — browser won't clear otherwise
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? ('strict' as const) : ('lax' as const),
    path: '/',
  });
}

export class AuthController {
  static requestOTP = asyncHandler(async (req: Request, res: Response) => {
    const { email, portal } = req.body;
    const result = await AuthService.requestOTP(email, portal);
    res.status(200).json({ success: true, ...result });
  });

  static verifyOTP = asyncHandler(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const deviceInfo = req.headers['user-agent'];
    const result = await AuthService.verifyOTP(email, otp, deviceInfo);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ success: true, data: { user: result.user, token: result.accessToken } });
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const deviceInfo = req.headers['user-agent'];
    const result = await AuthService.login(email, password, deviceInfo);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ success: true, data: { user: result.user, token: result.accessToken } });
  });

  static setPassword = asyncHandler(async (req: Request, res: Response) => {
    const { userId, password } = req.body;
    const deviceInfo = req.headers['user-agent'];
    const result = await AuthService.setPassword(userId, password, deviceInfo);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ success: true, data: { user: result.user, token: result.accessToken, message: 'Password set successfully' } });
  });

  static refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = getRefreshToken(req);
    if (!refreshToken) {
      return res.status(200).json({ success: false, message: 'No refresh token provided' });
    }
    const deviceInfo = req.headers['user-agent'];
    const result = await AuthService.refresh(refreshToken, deviceInfo);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ success: true, data: { user: result.user, token: result.accessToken } });
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = getRefreshToken(req);
    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  });

  static logoutAll = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    await AuthService.logoutAll(userId);
    clearRefreshCookie(res);
    res.status(200).json({ success: true, message: 'All sessions terminated' });
  });

  static forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await AuthService.forgotPassword(email);
    res.status(200).json({ success: true, ...result });
  });

  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    const deviceInfo = req.headers['user-agent'];
    const result = await AuthService.resetPassword(token, password, deviceInfo);
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ success: true, data: { user: result.user, token: result.accessToken } });
  });

  static requestApplicationEmailOTP = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const userId = (req as any).user.id;
    const result = await AuthService.requestApplicationEmailOTP(email, userId);
    res.status(200).json({ success: true, ...result });
  });

  static verifyApplicationEmailOTP = asyncHandler(async (req: Request, res: Response) => {
    const { otp } = req.body;
    const userId = (req as any).user.id;
    await AuthService.verifyApplicationEmailOTP(userId, otp);
    await ApplicationsService.updateVerificationStatus(userId, { isEmailVerified: true });
    res.status(200).json({ success: true, message: 'Email verified successfully' });
  });
}
