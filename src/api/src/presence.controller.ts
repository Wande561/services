import { BadRequestException, Controller, Get, Header, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('presence')
export class PresenceController {
  constructor(private readonly auth: AuthService, private readonly db: PrismaService) {}

  @Post('heartbeat')
  async heartbeat(@Req() req: Request) {
    checkFrontendOrigin(req.get('origin'));
    return this.auth.recordPresence(req.cookies?.session);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async statuses(@Req() req: Request, @Query('ids') raw: unknown) {
    const viewer = await this.auth.requireProfile(req.cookies?.session);
    if (typeof raw !== 'string' || raw.length > 7000) throw new BadRequestException('Choose accounts to look up');
    const ids = [...new Set(raw.split(',').filter(Boolean))];
    if (!ids.length || ids.length > 50 || ids.some(id => id.length > 128)) throw new BadRequestException('Choose up to 50 accounts');
    const [providers, quotes, bookings] = await Promise.all([
      this.db.profile.findMany({ where: { userId: { in: ids }, providerEnabled: true, listings: { some: { isPublished: true } } }, select: { userId: true } }),
      this.db.quoteRequest.findMany({ where: { OR: [{ clientId: viewer.id, providerId: { in: ids } }, { providerId: viewer.id, clientId: { in: ids } }] }, select: { clientId: true, providerId: true }, distinct: ['clientId', 'providerId'] }),
      this.db.booking.findMany({ where: { OR: [{ clientId: viewer.id, slot: { providerId: { in: ids } } }, { clientId: { in: ids }, slot: { providerId: viewer.id } }] }, select: { clientId: true, slot: { select: { providerId: true } } } }),
    ]);
    const allowed = new Set(providers.map(provider => provider.userId));
    for (const quote of quotes) allowed.add(quote.clientId === viewer.id ? quote.providerId : quote.clientId);
    for (const booking of bookings) allowed.add(booking.clientId === viewer.id ? booking.slot.providerId : booking.clientId);
    allowed.delete(viewer.id);
    const now = new Date();
    const users = await this.db.user.findMany({ where: { id: { in: ids.filter(id => allowed.has(id)) }, isSuspended: false }, select: { id: true, lastSeenAt: true, sessions: { where: { expiresAt: { gt: now }, lastActiveAt: { gt: new Date(now.getTime() - 90_000) } }, select: { id: true }, take: 1 } } });
    return Object.fromEntries(users.map(user => [user.id, { online: user.sessions.length > 0, lastSeenAt: user.lastSeenAt }]));
  }
}
