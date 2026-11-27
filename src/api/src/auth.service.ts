import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountRole, Prisma, ServiceCategory } from '@prisma/client';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

const scrypt = promisify(scryptCallback);
export const sessionLifetime = 24 * 60 * 60 * 1000;
export const persistentSessionLifetime = 30 * sessionLifetime;
const supportedCategories = new Set<string>(Object.values(ServiceCategory));
const profileFields = {
  role: true,
  clientEnabled: true,
  providerEnabled: true,
  verificationTier: true,
  phone: true,
  location: true,
  businessName: true,
  serviceCategories: true,
  otherService: true,
} satisfies Prisma.ProfileSelect;

export interface OnboardingInput {
  role?: unknown;
  name?: unknown;
  phone?: unknown;
  location?: unknown;
  businessName?: unknown;
  serviceCategories?: unknown;
  otherService?: unknown;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService) {}

  private normalizeEmail(email: unknown): string {
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new BadRequestException('Enter a valid email address');
    }
    return email.trim().toLowerCase();
  }

  private validatePassword(password: unknown): asserts password is string {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new BadRequestException('Password must be between 8 and 128 characters');
    }
  }

  async register(email: unknown, password: unknown, name: unknown) {
    const normalized = this.normalizeEmail(email);
    this.validatePassword(password);
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new BadRequestException('Enter your name');
    const salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    try {
      return await this.db.user.create({ data: { email: normalized, name: name.trim(), passwordHash: `${salt}:${hash.toString('hex')}` } });
    } catch (error: any) {
      if (error.code === 'P2002') throw new ConflictException('An account with this email already exists');
      throw error;
    }
  }

  async login(email: unknown, password: unknown) {
    const normalized = this.normalizeEmail(email);
    this.validatePassword(password);
    const user = await this.db.user.findUnique({ where: { email: normalized } });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid email or password');
    const [salt, stored] = user.passwordHash.split(':');
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(stored, 'hex');
    if (hash.length !== expected.length || !timingSafeEqual(hash, expected)) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  async requestPasswordReset(email: unknown) {
    const normalized = this.normalizeEmail(email);
    const user = await this.db.user.findUnique({ where: { email: normalized }, select: { id: true, email: true, passwordHash: true, name: true } });
    const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
    if (!user?.passwordHash) return { success: true, emailConfigured };

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    await this.db.$transaction([
      this.db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.db.passwordResetToken.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } }),
    ]);
    await this.sendPasswordResetEmail(user.email, user.name, rawToken);
    return { success: true, emailConfigured };
  }

  private async sendPasswordResetEmail(email: string, name: string | null, token: string) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();
    if (!apiKey || !from) {
      console.warn('Password reset email not sent: configure RESEND_API_KEY and MAIL_FROM.');
      return;
    }
    const resetUrl = new URL('/reset-password', process.env.FRONTEND_URL || 'http://localhost:3000');
    resetUrl.searchParams.set('token', token);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [email],
          subject: 'Reset your ServiceConnect password',
          text: `Hi ${name?.trim() || 'there'},\n\nUse this link to choose a new password. It expires in 30 minutes and can only be used once.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        }),
      });
      if (!response.ok) console.error(`Password reset email provider returned ${response.status}.`);
    } catch {
      console.error('Password reset email could not be delivered.');
    }
  }

  async resetPassword(token: unknown, newPassword: unknown) {
    if (typeof token !== 'string' || token.length < 30 || token.length > 200) throw new BadRequestException('This password reset link is invalid or has expired');
    this.validatePassword(newPassword);
    const tokenHash = this.hashToken(token);
    const reset = await this.db.passwordResetToken.findUnique({ where: { tokenHash }, select: { userId: true, expiresAt: true } });
    if (!reset || reset.expiresAt <= new Date()) throw new BadRequestException('This password reset link is invalid or has expired');
    const salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(newPassword, salt, 64)) as Buffer;
    await this.db.$transaction(async tx => {
      const used = await tx.passwordResetToken.deleteMany({ where: { tokenHash, expiresAt: { gt: new Date() } } });
      if (used.count !== 1) throw new BadRequestException('This password reset link is invalid or has expired');
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash: `${salt}:${hash.toString('hex')}` } });
      await tx.session.deleteMany({ where: { userId: reset.userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId: reset.userId } });
    });
    return { success: true };
  }

  googleConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  }

  googleRedirectUri() {
    // The callback must use the same frontend host as the cookies set when sign-in starts.
    return process.env.GOOGLE_REDIRECT_URI?.trim() || new URL('/api/auth/google/callback', process.env.FRONTEND_URL || 'http://localhost:3000').toString();
  }

  googleClient() {
    if (!this.googleConfigured()) throw new BadRequestException('Google sign-in is not configured');
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID!.trim(), process.env.GOOGLE_CLIENT_SECRET!.trim(), this.googleRedirectUri());
  }

  async googleUser(code: string, verifier: string) {
    const client = this.googleClient();
    const { tokens } = await client.getToken({ code, codeVerifier: verifier });
    if (!tokens.id_token) throw new UnauthorizedException('Google did not provide an identity');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email || !profile.email_verified) throw new UnauthorizedException('Google account must have a verified email');
    const email = this.normalizeEmail(profile.email);
    const existing = await this.db.user.findUnique({ where: { googleId: profile.sub } });
    if (existing) return existing;
    if (await this.db.user.findUnique({ where: { email } })) throw new ConflictException('An account with this email already exists. Sign in with your password.');
    try {
      return await this.db.user.create({ data: { email, googleId: profile.sub, name: profile.name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const linked = await this.db.user.findUnique({ where: { googleId: profile.sub } });
        if (linked) return linked;
        throw new ConflictException('An account with this email already exists. Sign in with your password.');
      }
      throw error;
    }
  }

  async createSession(userId: string, keepSignedIn = false) {
    const account = await this.db.user.findUnique({ where: { id: userId }, select: { isSuspended: true } });
    if (!account || account.isSuspended) throw new ForbiddenException('This account is suspended. Please contact support.');
    const token = randomBytes(32).toString('base64url');
    await this.db.session.create({ data: { tokenHash: this.hashToken(token), userId, expiresAt: new Date(Date.now() + (keepSignedIn ? persistentSessionLifetime : sessionLifetime)) } });
    return token;
  }

  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async currentUser(token?: string) {
    if (!token) throw new UnauthorizedException();
    const session = await this.db.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      select: {
        expiresAt: true,
        user: {
          select: { id: true, email: true, name: true, isVerificationAdmin: true, isSuspended: true, createdAt: true, profile: { select: profileFields } },
        },
      },
    });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException();
    if (session.user.isSuspended) throw new ForbiddenException('This account is suspended. Please contact support.');
    const { isSuspended: _isSuspended, ...user } = session.user;
    return user;
  }

  async recordPresence(token?: string) {
    const account = await this.currentUser(token);
    const now = new Date();
    await this.db.$transaction([
      this.db.session.updateMany({ where: { tokenHash: this.hashToken(token!), userId: account.id, expiresAt: { gt: now } }, data: { lastActiveAt: now } }),
      this.db.user.update({ where: { id: account.id }, data: { lastSeenAt: now } }),
    ]);
    return { success: true };
  }

  async requireProfile(token?: string, requiredRole?: AccountRole) {
    const account = await this.currentUser(token);
    const role = account.profile?.role;
    const capability = requiredRole === AccountRole.client ? account.profile?.clientEnabled
      : requiredRole === AccountRole.provider ? account.profile?.providerEnabled
      : true;
    if (!role || role === AccountRole.admin || !capability) {
      throw new ForbiddenException(requiredRole ? `A ${requiredRole} profile is required` : 'A completed profile is required');
    }
    return { id: account.id, role: requiredRole ?? role };
  }

  async completeOnboarding(token: string | undefined, input: OnboardingInput | undefined) {
    const user = await this.currentUser(token);
    if (user.profile) throw new ConflictException('Your profile is already set up');

    if (!input || (input.role !== AccountRole.client && input.role !== AccountRole.provider)) {
      throw new BadRequestException('Choose a client or provider account');
    }
    const { role } = input;
    const name = requiredText(input.name, 'your name', 100);
    const location = requiredText(input.location, 'your city or town', 150);
    const phone = requiredText(input.phone, 'your phone number', 32);
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[\d.() -]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
      throw new BadRequestException('Enter a valid phone number');
    }

    let businessName: string | null = null;
    let serviceCategories: ServiceCategory[] = [];
    let otherService: string | null = null;
    if (role === AccountRole.provider) {
      businessName = requiredText(input.businessName, 'your business name', 120);
      const categories = input.serviceCategories;
      if (!Array.isArray(categories) || categories.length === 0 || categories.length > supportedCategories.size ||
          !categories.every(category => typeof category === 'string' && supportedCategories.has(category))) {
        throw new BadRequestException('Choose at least one valid service category');
      }
      serviceCategories = [...new Set<ServiceCategory>(categories)];
      if (serviceCategories.includes(ServiceCategory.Other)) otherService = requiredText(input.otherService, 'the service you provide', 150);
    }

    try {
      const [profile] = await this.db.$transaction([
        this.db.profile.create({
          data: { userId: user.id, role, clientEnabled: role === AccountRole.client, providerEnabled: role === AccountRole.provider, phone, location, businessName, serviceCategories, otherService },
          select: profileFields,
        }),
        this.db.user.update({ where: { id: user.id }, data: { name } }),
      ]);
      return { ...user, name, profile };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Your profile is already set up');
      }
      throw error;
    }
  }

  async switchRole(token: string | undefined, input: OnboardingInput | undefined) {
    const user = await this.currentUser(token);
    if (!user.profile) throw new ForbiddenException('Complete your profile first');
    if (!input || (input.role !== AccountRole.client && input.role !== AccountRole.provider)) throw new BadRequestException('Choose a client or provider account');
    const role = input.role;
    const profile = user.profile;
    if (role === AccountRole.provider && !profile.providerEnabled) {
      const businessName = requiredText(input.businessName, 'your business name', 120);
      const categories = input.serviceCategories;
      if (!Array.isArray(categories) || categories.length === 0 || categories.length > supportedCategories.size ||
          !categories.every(category => typeof category === 'string' && supportedCategories.has(category))) {
        throw new BadRequestException('Choose at least one valid service category');
      }
      const serviceCategories = [...new Set<ServiceCategory>(categories)];
      const otherService = serviceCategories.includes(ServiceCategory.Other) ? requiredText(input.otherService, 'the service you provide', 150) : null;
      const updated = await this.db.profile.update({ where: { userId: user.id }, data: { role, providerEnabled: true, businessName, serviceCategories, otherService }, select: profileFields });
      return { ...user, profile: updated };
    }
    if (role === AccountRole.client && !profile.clientEnabled) {
      const updated = await this.db.profile.update({ where: { userId: user.id }, data: { role, clientEnabled: true }, select: profileFields });
      return { ...user, profile: updated };
    }
    const updated = await this.db.profile.update({ where: { userId: user.id }, data: { role }, select: profileFields });
    return { ...user, profile: updated };
  }

  async updateProfile(token: string | undefined, input: OnboardingInput | undefined) {
    const user = await this.currentUser(token);
    if (!user.profile) throw new ForbiddenException('A completed profile is required');
    if (!input) throw new BadRequestException('Enter your profile details');
    const name = requiredText(input.name, 'your name', 100);
    const phone = requiredText(input.phone, 'your phone number', 32);
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[\d.() -]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
      throw new BadRequestException('Enter a valid phone number');
    }
    const location = requiredText(input.location, 'your city or town', 150);
    let businessName: string | null = user.profile.providerEnabled || user.profile.role === AccountRole.admin ? user.profile.businessName : null;
    let serviceCategories: ServiceCategory[] = user.profile.providerEnabled || user.profile.role === AccountRole.admin ? user.profile.serviceCategories : [];
    let otherService = user.profile.otherService;
    if (user.profile.role === AccountRole.provider) {
      businessName = requiredText(input.businessName, 'your business name', 120);
      const categories = input.serviceCategories;
      if (!Array.isArray(categories) || !categories.length || categories.length > supportedCategories.size ||
          !categories.every(category => typeof category === 'string' && supportedCategories.has(category))) {
        throw new BadRequestException('Choose at least one valid service category');
      }
      serviceCategories = [...new Set<ServiceCategory>(categories)];
      otherService = serviceCategories.includes(ServiceCategory.Other) ? requiredText(input.otherService, 'the service you provide', 150) : null;
    }
    return this.db.$transaction(async tx => {
      // Serialize profile edits and verification reviews so a stale badge cannot survive an edit.
      await tx.$queryRaw`SELECT "userId" FROM "Profile" WHERE "userId" = ${user.id} FOR UPDATE`;
      const current = await tx.profile.findUniqueOrThrow({ where: { userId: user.id }, select: { phone: true, businessName: true, user: { select: { name: true } } } });
      const mustReverify = current.user.name !== name || current.phone !== phone || (user.profile!.providerEnabled && current.businessName !== businessName);
      const profile = await tx.profile.update({ where: { userId: user.id }, data: { phone, location, ...(user.profile!.role === AccountRole.provider ? { businessName, serviceCategories, otherService } : {}), ...(mustReverify ? { verificationTier: 'Basic' as const } : {}) }, select: profileFields });
      await tx.user.update({ where: { id: user.id }, data: { name } });
      return { ...user, name, profile };
    });
  }

  async changePassword(token: string | undefined, currentPassword: unknown, newPassword: unknown) {
    const account = await this.currentUser(token);
    this.validatePassword(newPassword);
    const user = await this.db.user.findUnique({ where: { id: account.id }, select: { passwordHash: true } });
    if (!user?.passwordHash) throw new BadRequestException('This account uses Google sign-in and has no password to change');
    if (typeof currentPassword !== 'string' || currentPassword.length > 128) throw new UnauthorizedException('Current password is incorrect');
    const [salt, stored] = user.passwordHash.split(':');
    const hash = (await scrypt(currentPassword, salt, 64)) as Buffer;
    const expected = Buffer.from(stored, 'hex');
    if (hash.length !== expected.length || !timingSafeEqual(hash, expected)) throw new UnauthorizedException('Current password is incorrect');
    const newSalt = randomBytes(16).toString('hex');
    const newHash = (await scrypt(newPassword, newSalt, 64)) as Buffer;
    await this.db.$transaction([
      this.db.user.update({ where: { id: account.id }, data: { passwordHash: `${newSalt}:${newHash.toString('hex')}` } }),
      this.db.session.deleteMany({ where: { userId: account.id, tokenHash: { not: this.hashToken(token!) } } }),
    ]);
    return { success: true };
  }

  async logout(token?: string) {
    if (token) await this.db.session.deleteMany({ where: { tokenHash: this.hashToken(token) } });
  }
}
