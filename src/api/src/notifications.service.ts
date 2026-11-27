import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit, BadRequestException } from '@nestjs/common';
import { AccountRole, Prisma } from '@prisma/client';
import { bookingOwnership } from './booking-ownership';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

const pageSize = 30;

const preferenceKeys = ['bookingUpdates', 'messages', 'reviews', 'payments', 'appointmentReminders', 'quoteReminders'] as const;
type PreferenceKey = typeof preferenceKeys[number];

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private reminderTimer?: ReturnType<typeof setInterval>;
  constructor(private readonly db: PrismaService) {}

  onModuleInit() {
    void this.sendUpcomingReminders();
    this.reminderTimer = setInterval(() => void this.sendUpcomingReminders(), 30 * 60 * 1000);
    this.reminderTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  async getPreferences(userId: string) {
    return this.db.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {}, select: Object.fromEntries(preferenceKeys.map(key => [key, true])) as any });
  }

  async updatePreferences(userId: string, input: Record<string, unknown> | undefined) {
    if (!input || !Object.keys(input).length || Object.keys(input).some(key => !preferenceKeys.includes(key as PreferenceKey)) || Object.values(input).some(value => typeof value !== 'boolean')) {
      throw new BadRequestException('Choose valid notification preferences');
    }
    const data: Partial<Record<PreferenceKey, boolean>> = {};
    for (const key of preferenceKeys) if (key in input) data[key] = input[key] as boolean;
    return this.db.notificationPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data, select: Object.fromEntries(preferenceKeys.map(key => [key, true])) as any });
  }

  private async enabledKinds(userId: string) {
    const prefs = await this.getPreferences(userId);
    const kinds: string[] = [];
    if (prefs.bookingUpdates) kinds.push('BookingRequested', 'BookingStatusChanged', 'ServiceCompletionConfirmation');
    if (prefs.messages) kinds.push('MessageReceived');
    if (prefs.reviews) kinds.push('ReviewReceived');
    if (prefs.payments) kinds.push('PaymentRecorded', 'PaymentVoided');
    if (prefs.appointmentReminders) kinds.push('AppointmentReminder');
    return kinds;
  }

  private async sendUpcomingReminders() {
    try {
      const now = new Date();
      const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const expiringQuotes = await this.db.quoteRequest.findMany({
        where: { status: 'Quoted', versions: { some: { expiresAt: { gt: now, lte: deadline } } } },
        select: { id: true, clientId: true, listing: { select: { title: true } }, versions: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true, expiresAt: true } } },
      });
      for (const quote of expiringQuotes) {
        const version = quote.versions[0];
        if (!version || version.expiresAt > deadline || version.expiresAt <= now) continue;
        const pref = await this.db.notificationPreference.findUnique({ where: { userId: quote.clientId }, select: { quoteReminders: true } });
        if (pref?.quoteReminders === false) continue;
        await this.db.quoteAlert.createMany({
          data: [{ recipientId: quote.clientId, requestId: quote.id, message: `Your quotation for ${quote.listing.title} expires within 24 hours.`, dedupeKey: `quote-expiry:${quote.id}:${version.id}` }],
          skipDuplicates: true,
        });
      }
      const upcoming = await this.db.booking.findMany({
        where: { status: 'Confirmed', slot: { startsAt: { gt: now, lte: deadline } } },
        select: { id: true, clientId: true, listing: { select: { providerId: true } } },
      });
      for (const booking of upcoming) {
        const recipients = [...new Set([booking.clientId, booking.listing.providerId])];
        const prefs = await this.db.notificationPreference.findMany({ where: { userId: { in: recipients } }, select: { userId: true, appointmentReminders: true } });
        const optedOut = new Set(prefs.filter(pref => !pref.appointmentReminders).map(pref => pref.userId));
        const data = recipients.filter(id => !optedOut.has(id)).map(recipientId => ({
          recipientId, bookingId: booking.id, kind: 'AppointmentReminder' as const,
          dedupeKey: `appointment-reminder:${booking.id}:${recipientId}`,
        }));
        if (data.length) await this.db.notification.createMany({ data, skipDuplicates: true });
      }
    } catch (error) {
      console.error('Scheduled reminder job failed.', error);
    }
  }

  async unread(accountId: string, role: AccountRole) {
    const kinds = await this.enabledKinds(accountId);
    const [notifications, messages] = await this.db.$transaction([
      this.db.notification.count({ where: { recipientId: accountId, readAt: null, kind: { in: kinds as any } } }),
      this.db.message.count({
        where: { senderId: { not: accountId }, readAt: null, OR: [{ booking: bookingOwnership(accountId, role) }, { quoteRequest: role === 'provider' ? { providerId: accountId } : { clientId: accountId } }] },
      }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { notifications, messages };
  }

  async list(recipientId: string, before: unknown) {
    const kinds = await this.enabledKinds(recipientId);
    let cursor: { id: string } | undefined;
    if (before !== undefined) {
      const id = requiredText(before, 'a notification cursor', 128);
      if (!await this.db.notification.findUnique({ where: { id, recipientId }, select: { id: true } })) {
        throw new NotFoundException('Notification cursor not found');
      }
      cursor = { id };
    }
    const records = await this.db.notification.findMany({
      where: { recipientId, kind: { in: kinds as any } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      ...(cursor && { cursor, skip: 1 }),
      select: {
        id: true, bookingId: true, quoteRequestId: true, kind: true, bookingStatus: true, createdAt: true, readAt: true,
        booking: { select: { serviceTitle: true } },
        quoteRequest: { select: { listing: { select: { title: true } } } },
      },
    });
    const items = records.slice(0, pageSize).map(({ booking, quoteRequest, readAt, ...record }) => ({
      ...record, serviceTitle: booking?.serviceTitle ?? quoteRequest?.listing.title ?? 'Service', read: readAt !== null,
    }));
    return { items, nextCursor: records.length > pageSize ? items[pageSize - 1].id : null };
  }

  /** Read-only assistant notification context. Does not create preferences or mark items read. */
  async assistantSummary(recipientId: string) {
    const [rows, quoteAlerts] = await Promise.all([
      this.db.notification.findMany({
        where: { recipientId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12,
        select: { id: true, kind: true, bookingStatus: true, createdAt: true, readAt: true, booking: { select: { serviceTitle: true } }, quoteRequest: { select: { listing: { select: { title: true } }, status: true } } },
      }),
      this.db.quoteAlert.findMany({
        where: { recipientId, request: { providerId: recipientId } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10,
        select: { id: true, message: true, createdAt: true, readAt: true, request: { select: { id: true, status: true, listing: { select: { title: true } } } } },
      }),
    ]);
    return {
      notifications: rows.map(row => ({ id: row.id, kind: row.kind, bookingStatus: row.bookingStatus, createdAt: row.createdAt, unread: row.readAt === null, service: row.booking?.serviceTitle ?? row.quoteRequest?.listing.title ?? 'Service', quoteStatus: row.quoteRequest?.status ?? null })),
      quoteAlerts: quoteAlerts.map(alert => ({ id: alert.id, requestId: alert.request.id, message: alert.message.slice(0, 300), createdAt: alert.createdAt, unread: alert.readAt === null, status: alert.request.status, service: alert.request.listing.title })),
    };
  }

  async markRead(recipientId: string, id: string) {
    const alert = await this.db.notification.findUnique({ where: { id, recipientId }, select: { id: true } });
    if (!alert) throw new NotFoundException('Notification not found');
    await this.markAllRead(recipientId, id);
    return { success: true };
  }

  async markAllRead(recipientId: string, id?: string) {
    await this.db.notification.updateMany({ where: { recipientId, id, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }

  async markViewed(recipientId: string, body: Record<string, unknown> | undefined) {
    const { quoteIds, bookingIds, before, scope } = body ?? {};
    const validIds = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length <= 100 && ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128);
    if (!validIds(quoteIds) || !validIds(bookingIds) || (scope !== 'quotes' && scope !== 'bookings') || typeof before !== 'string' || Number.isNaN(Date.parse(before))) throw new BadRequestException('Invalid viewed items');
    const cutoff = new Date(Math.min(Date.parse(before), Date.now()));
    const readAt = new Date();
    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (scope === 'quotes' && quoteIds.length) operations.push(this.db.quoteAlert.updateMany({ where: { recipientId, requestId: { in: quoteIds }, readAt: null, createdAt: { lte: cutoff } }, data: { readAt } }));
    if (bookingIds.length) operations.push(this.db.notification.updateMany({ where: { recipientId, bookingId: { in: bookingIds }, readAt: null, createdAt: { lte: cutoff }, kind: scope === 'quotes' ? { in: ['BookingRequested', 'BookingStatusChanged'] } : { not: 'MessageReceived' } }, data: { readAt } }));
    if (operations.length) await this.db.$transaction(operations);
    return { success: true };
  }
}
