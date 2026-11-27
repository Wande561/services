import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, Prisma } from '@prisma/client';
import { bookingOwnership } from './booking-ownership';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

const pageSize = 40;
const threadFields = {
  id: true, serviceTitle: true, clientId: true, status: true, createdAt: true, updatedAt: true,
  clientCompletedAt: true, providerCompletedAt: true,
  client: { select: { user: { select: { name: true } } } },
  slot: { select: { providerId: true, provider: { select: { businessName: true } } } },
} satisfies Prisma.BookingSelect;
const messageFields = { id: true, senderId: true, body: true, createdAt: true, readAt: true } satisfies Prisma.MessageSelect;
type Thread = Prisma.BookingGetPayload<{ select: typeof threadFields }>;
type Message = Prisma.MessageGetPayload<{ select: typeof messageFields }>;
type Item = { id: string; body: string; createdAt: Date; mine: boolean; read: boolean; kind: 'message' | 'booking-created' | 'booking-completed' };
const open = (booking: Thread) => booking.status === 'Pending' || booking.status === 'Confirmed';
const compare = (a: Item, b: Item) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1);
function formatMessage(message: Message, accountId: string): Item {
  return { id: message.id, body: message.body, createdAt: message.createdAt, mine: message.senderId === accountId, read: message.readAt !== null, kind: 'message' };
}
function events(bookings: Thread[]): Item[] {
  return bookings.flatMap(booking => {
    const result: Item[] = [{ id: `created:${booking.id}`, body: 'Booking created', createdAt: booking.createdAt, mine: false, read: true, kind: 'booking-created' }];
    if (booking.status === 'Completed') {
      const completedAt = [booking.clientCompletedAt, booking.providerCompletedAt].filter((date): date is Date => !!date).sort((a, b) => b.getTime() - a.getTime())[0] ?? booking.updatedAt;
      result.push({ id: `completed:${booking.id}`, body: 'Booking complete', createdAt: completedAt, mine: false, read: true, kind: 'booking-completed' });
    }
    return result;
  });
}
function details(bookings: Thread[], role: AccountRole) {
  const latest = bookings[0];
  const active = bookings.find(open);
  return { bookingId: latest.id, activeBookingId: active?.id ?? null, closed: !active, serviceTitle: latest.serviceTitle, contactId: role === 'client' ? latest.slot.providerId : latest.clientId,
    contactName: role === 'client' ? latest.slot.provider.businessName ?? 'Provider' : latest.client.user.name ?? 'Client' };
}
@Injectable()
export class MessagesService {
  constructor(private readonly db: PrismaService) {}

  async conversations(accountId: string, role: AccountRole) {
    const bookings = await this.db.booking.findMany({ where: bookingOwnership(accountId, role), select: threadFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const groups = new Map<string, Thread[]>();
    for (const booking of bookings) {
      const key = role === 'client' ? booking.slot.providerId : booking.clientId;
      const group = groups.get(key) ?? []; group.push(booking); groups.set(key, group);
    }
    const conversations = await Promise.all([...groups.values()].map(async group => {
      const ids = group.map(booking => booking.id);
      const [message, unread] = await Promise.all([
        this.db.message.findFirst({ where: { bookingId: { in: ids } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageFields }),
        this.db.message.count({ where: { bookingId: { in: ids }, senderId: { not: accountId }, readAt: null } }),
      ]);
      const items = events(group); if (message) items.push(formatMessage(message, accountId));
      return { ...details(group, role), latest: items.sort(compare)[0], unread };
    }));
    return conversations.sort((a, b) => compare(a.latest, b.latest));
  }

  private async related(accountId: string, role: AccountRole, id: string) {
    const booking = await this.db.booking.findFirst({ where: { id, ...bookingOwnership(accountId, role) }, select: threadFields });
    if (!booking) throw new NotFoundException('Conversation unavailable');
    return this.db.booking.findMany({ where: { clientId: booking.clientId, slot: { providerId: booking.slot.providerId } }, select: threadFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  }

  async thread(accountId: string, role: AccountRole, bookingId: string, before: unknown) {
    const bookings = await this.related(accountId, role, bookingId);
    let cursor: { date: Date; id: string } | undefined;
    if (before !== undefined) {
      try {
        const decoded = JSON.parse(Buffer.from(requiredText(before, 'a message cursor', 512), 'base64url').toString());
        if (typeof decoded.id !== 'string' || typeof decoded.date !== 'string' || Number.isNaN(Date.parse(decoded.date))) throw new Error();
        cursor = { id: decoded.id, date: new Date(decoded.date) };
      } catch { throw new BadRequestException('Invalid message cursor'); }
    }
    // Fetch one page of messages plus same-timestamp ties; event markers are merged below.
    const where: Prisma.MessageWhereInput = { bookingId: { in: bookings.map(booking => booking.id) } };
    if (cursor) where.OR = [{ createdAt: { lt: cursor.date } }, { createdAt: cursor.date, id: { lt: cursor.id } }];
    const messages = await this.db.message.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageFields, take: pageSize + 1 });
    const markerCursor = cursor ? { id: cursor.id, createdAt: cursor.date } as Item : null;
    const markers = events(bookings).filter(item => !markerCursor || compare(item, markerCursor) > 0);
    const all = [...messages.map(message => formatMessage(message, accountId)), ...markers].sort(compare);
    const items = all.slice(0, pageSize);
    const last = items[items.length - 1];
    return { ...details(bookings, role), items, nextCursor: all.length > pageSize ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString('base64url') : null };
  }

  async send(accountId: string, role: AccountRole, bookingId: string, value: unknown) {
    const body = requiredText(value, 'a message', 2000);
    const bookings = await this.related(accountId, role, bookingId);
    const active = bookings.find(open);
    if (!active) throw new NotFoundException('Conversation is closed until another booking is created');
    const message = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${active.id} FOR UPDATE`;
      const booking = await tx.booking.findFirst({ where: { id: active.id, ...bookingOwnership(accountId, role), status: { in: ['Pending', 'Confirmed'] } }, select: threadFields });
      if (!booking) throw new NotFoundException('Conversation is closed until another booking is created');
      const recipientId = role === 'client' ? booking.slot.providerId : booking.clientId;
      const created = await tx.message.create({ data: { bookingId: booking.id, senderId: accountId, body }, select: messageFields });
      await tx.notification.create({ data: { bookingId: booking.id, recipientId, kind: 'MessageReceived', messageId: created.id } });
      return created;
    });
    return formatMessage(message, accountId);
  }

  async markRead(accountId: string, role: AccountRole, bookingId: string, ids: unknown) {
    const bookings = await this.related(accountId, role, bookingId);
    if (!Array.isArray(ids) || !ids.length || ids.length > pageSize || ids.some(id => typeof id !== 'string' || !id || id.length > 128)) throw new BadRequestException('Pass the messages that were displayed');
    const bookingIds = bookings.map(booking => booking.id); const time = new Date();
    await this.db.$transaction([
      this.db.message.updateMany({ where: { id: { in: ids }, bookingId: { in: bookingIds }, senderId: { not: accountId }, readAt: null }, data: { readAt: time } }),
      this.db.notification.updateMany({ where: { recipientId: accountId, bookingId: { in: bookingIds }, kind: 'MessageReceived', messageId: { in: ids }, readAt: null }, data: { readAt: time } }),
    ]);
    return { success: true };
  }
}
