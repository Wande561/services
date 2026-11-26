import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, Prisma } from '@prisma/client';
import { bookingOwnership } from './booking-ownership';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

const pageSize = 40;
const newestFirst = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.MessageOrderByWithRelationInput[];
const threadFields = {
  id: true,
  serviceTitle: true,
  clientId: true,
  client: { select: { user: { select: { name: true } } } },
  slot: { select: { providerId: true, provider: { select: { businessName: true } } } },
} satisfies Prisma.BookingSelect;
const messageFields = {
  id: true, senderId: true, body: true, createdAt: true, readAt: true,
} satisfies Prisma.MessageSelect;

type Thread = Prisma.BookingGetPayload<{ select: typeof threadFields }>;
type Message = Prisma.MessageGetPayload<{ select: typeof messageFields }>;

function formatThread(booking: Thread, role: AccountRole) {
  return {
    bookingId: booking.id,
    serviceTitle: booking.serviceTitle,
    contactName: role === 'client' ? booking.slot.provider.businessName ?? 'Provider' : booking.client.user.name ?? 'Client',
  };
}

function formatMessage({ senderId, readAt, ...message }: Message, accountId: string) {
  return { ...message, mine: senderId === accountId, read: readAt !== null };
}

@Injectable()
export class MessagesService {
  constructor(private readonly db: PrismaService) {}

  async conversations(accountId: string, role: AccountRole) {
    const threads = await this.db.booking.findMany({
      where: { ...bookingOwnership(accountId, role), status: { not: 'Completed' }, messages: { some: {} } },
      select: {
        ...threadFields,
        messages: { orderBy: newestFirst, take: 1, select: messageFields },
        _count: { select: { messages: { where: { senderId: { not: accountId }, readAt: null } } } },
      },
    });
    return threads.map(thread => ({
      ...formatThread(thread, role),
      latest: formatMessage(thread.messages[0], accountId),
      unread: thread._count.messages,
    })).sort((left, right) => right.latest.createdAt.getTime() - left.latest.createdAt.getTime() ||
      right.latest.id.localeCompare(left.latest.id));
  }

  async thread(accountId: string, role: AccountRole, bookingId: string, before: unknown) {
    const booking = await this.requireThread(accountId, role, bookingId);
    let cursor: { id: string } | undefined;
    if (before !== undefined) {
      const id = requiredText(before, 'a message cursor', 128);
      if (!await this.db.message.findUnique({ where: { id, bookingId }, select: { id: true } })) {
        throw new NotFoundException('Message cursor not found');
      }
      cursor = { id };
    }
    const messages = await this.db.message.findMany({
      where: { bookingId },
      orderBy: newestFirst,
      select: messageFields,
      take: pageSize + 1,
      ...(cursor && { cursor, skip: 1 }),
    });
    const items = messages.slice(0, pageSize).map(message => formatMessage(message, accountId));
    return { ...formatThread(booking, role), items, nextCursor: messages.length > pageSize ? items[pageSize - 1].id : null };
  }

  async send(accountId: string, role: AccountRole, bookingId: string, value: unknown) {
    const body = requiredText(value, 'a message', 2000);
    const message = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(accountId, role), status: { not: 'Completed' } }, select: threadFields });
      if (!booking) throw new NotFoundException('Conversation is closed or unavailable');
      const recipientId = role === 'client' ? booking.slot.providerId : booking.clientId;
      const created = await tx.message.create({
        data: { bookingId, senderId: accountId, body },
        select: messageFields,
      });
      await tx.notification.create({
        data: { bookingId, recipientId, kind: 'MessageReceived', messageId: created.id },
      });
      return created;
    });
    return formatMessage(message, accountId);
  }

  async markRead(accountId: string, role: AccountRole, bookingId: string, ids: unknown) {
    await this.requireThread(accountId, role, bookingId);
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > pageSize ||
        ids.some(id => typeof id !== 'string' || !id || id.length > 128)) {
      throw new BadRequestException('Pass the messages that were displayed');
    }

    const time = new Date();
    const where = { id: { in: ids }, bookingId, senderId: { not: accountId }, readAt: null };
    await this.db.$transaction([
      this.db.message.updateMany({ where, data: { readAt: time } }),
      this.db.notification.updateMany({
        where: { recipientId: accountId, bookingId, kind: 'MessageReceived', messageId: { in: ids }, readAt: null },
        data: { readAt: time },
      }),
    ]);
    return { success: true };
  }

  private async requireThread(accountId: string, role: AccountRole, id: string) {
    const booking = await this.db.booking.findUnique({
      where: { id, ...bookingOwnership(accountId, role), status: { not: 'Completed' } },
      select: threadFields,
    });
    if (!booking) throw new NotFoundException('Conversation is closed or unavailable');
    return booking;
  }
}
