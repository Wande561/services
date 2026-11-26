import { Body, ConflictException, Controller, ForbiddenException, Get, Header, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { AuthService, type OnboardingInput } from './auth.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private cookieOptions(maxAge: number) {
    return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge, path: '/' };
  }

  private async signIn(userId: string, res: Response) {
    const token = await this.auth.createSession(userId);
    res.cookie('session', token, this.cookieOptions(7 * 24 * 60 * 60 * 1000));
    return this.auth.currentUser(token);
  }

  @Post('register')
  async register(@Body() body: any, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    checkFrontendOrigin(req.get('origin'));
    const user = await this.auth.register(body?.email, body?.password, body?.name);
    return this.signIn(user.id, res);
  }

  @Post('login')
  async login(@Body() body: any, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    checkFrontendOrigin(req.get('origin'));
    const user = await this.auth.login(body?.email, body?.password);
    return this.signIn(user.id, res);
  }

  @Get('me')
  me(@Req() req: Request) { return this.auth.currentUser(req.cookies?.session); }

  @Post('onboarding')
  completeOnboarding(@Body() body: OnboardingInput, @Req() req: Request) {
    checkFrontendOrigin(req.get('origin'));
    return this.auth.completeOnboarding(req.cookies?.session, body);
  }

  @Patch('profile')
  updateProfile(@Body() body: any, @Req() req: Request) {
    checkFrontendOrigin(req.get('origin'));
    return this.auth.updateProfile(req.cookies?.session, body);
  }

  @Post('password')
  changePassword(@Body() body: any, @Req() req: Request) {
    checkFrontendOrigin(req.get('origin'));
    return this.auth.changePassword(req.cookies?.session, body?.currentPassword, body?.newPassword);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    checkFrontendOrigin(req.get('origin'));
    await this.auth.logout(req.cookies?.session);
    res.clearCookie('session', this.cookieOptions(0));
    return { success: true };
  }

  private googleFailure(res: Response, code: string) {
    const url = new URL('/signin', process.env.FRONTEND_URL || 'http://localhost:3000');
    url.searchParams.set('google_error', code);
    return res.redirect(url.toString());
  }

  @Get('google/config')
  @Header('Cache-Control', 'no-store')
  googleConfig() {
    return { configured: this.auth.googleConfigured(), frontendOrigin: new URL(process.env.FRONTEND_URL || 'http://localhost:3000').origin };
  }

  @Get('google')
  async google(@Res() res: Response) {
    if (!this.auth.googleConfigured()) return this.googleFailure(res, 'not_configured');
    try {
      const client = this.auth.googleClient();
      const state = randomBytes(32).toString('base64url');
      const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
      res.cookie('oauth_state', state, this.cookieOptions(10 * 60 * 1000));
      res.cookie('oauth_verifier', codeVerifier, this.cookieOptions(10 * 60 * 1000));
      return res.redirect(client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, code_challenge: codeChallenge, code_challenge_method: 'S256' as any }));
    } catch {
      return this.googleFailure(res, 'unavailable');
    }
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response, @Query('error') providerError?: string) {
    const savedState = req.cookies?.oauth_state;
    const verifier = req.cookies?.oauth_verifier;
    res.clearCookie('oauth_state', this.cookieOptions(0));
    res.clearCookie('oauth_verifier', this.cookieOptions(0));
    if (typeof state !== 'string' || typeof savedState !== 'string' || typeof verifier !== 'string') return this.googleFailure(res, 'invalid_state');
    const actual = Buffer.from(state);
    const expected = Buffer.from(savedState);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return this.googleFailure(res, 'invalid_state');
    if (providerError) return this.googleFailure(res, providerError === 'access_denied' ? 'cancelled' : 'unavailable');
    if (typeof code !== 'string' || !code) return this.googleFailure(res, 'invalid_response');
    try {
      const user = await this.auth.googleUser(code, verifier);
      await this.signIn(user.id, res);
      return res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
    } catch (error) {
      if (error instanceof ConflictException) return this.googleFailure(res, 'existing_account');
      if (error instanceof ForbiddenException) return this.googleFailure(res, 'suspended');
      return this.googleFailure(res, 'unavailable');
    }
  }
}
