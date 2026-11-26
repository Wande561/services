import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, Prisma } from '@prisma/client';
import { bookingOwnership } from './booking-ownership';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

const pageSize = 30;

@Injectable()
export class NotificationsService {
  constructor(private readonly db: PrismaService) {}

  async unread(accountId: string, role: AccountRole) {
    const [notifications, messages] = await this.db.$transaction([
      this.db.notification.count({ where: { recipientId: accountId, readAt: null, NOT: { kind: 'MessageReceived', booking: { status: 'Completed' } } } }),
      this.db.message.count({
        where: { senderId: { not: accountId }, readAt: null, booking: { ...bookingOwnership(accountId, role), status: { not: 'Completed' } } },
      }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { notifications, messages };
  }

  async list(recipientId: string, before: unknown) {
    let cursor: { id: string } | undefined;
    if (before !== undefined) {
      const id = requiredText(before, 'a notification cursor', 128);
      if (!await this.db.notification.findUnique({ where: { id, recipientId }, select: { id: true } })) {
        throw new NotFoundException('Notification cursor not found');
      }
      cursor = { id };
    }
    const records = await this.db.notification.findMany({
      where: { recipientId, NOT: { kind: 'MessageReceived', booking: { status: 'Completed' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      ...(cursor && { cursor, skip: 1 }),
      select: {
        id: true, bookingId: true, kind: true, bookingStatus: true, createdAt: true, readAt: true,
        booking: { select: { serviceTitle: true } },
      },
    });
    const items = records.slice(0, pageSize).map(({ booking, readAt, ...record }) => ({
      ...record, serviceTitle: booking.serviceTitle, read: readAt !== null,
    }));
    return { items, nextCursor: records.length > pageSize ? items[pageSize - 1].id : null };
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
}
