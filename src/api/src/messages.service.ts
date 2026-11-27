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
const quoteFields = {
  id: true, clientId: true, providerId: true, status: true, createdAt: true,
  listing: { select: { title: true } }, client: { select: { user: { select: { name: true } } } },
  provider: { select: { businessName: true } },
} satisfies Prisma.QuoteRequestSelect;
const messageFields = { id: true, senderId: true, body: true, createdAt: true, readAt: true } satisfies Prisma.MessageSelect;
type Thread = Prisma.BookingGetPayload<{ select: typeof threadFields }>;
type Quote = Prisma.QuoteRequestGetPayload<{ select: typeof quoteFields }>;
type Group = { bookings: Thread[]; quotes: Quote[] };
type Message = Prisma.MessageGetPayload<{ select: typeof messageFields }>;
type Item = { id: string; body: string; createdAt: Date; mine: boolean; read: boolean; kind: 'message' | 'quote-created' | 'booking-created' | 'booking-completed' };
const open = (booking: Thread) => booking.status === 'Pending' || booking.status === 'Confirmed';
const activeQuoteStatuses = ['Pending', 'Quoted', 'RevisionRequested', 'DepositPending', 'SlotUnavailable'] as const;
const openQuote = (quote: Quote) => (activeQuoteStatuses as readonly string[]).includes(quote.status);
const compare = (a: Item, b: Item) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id === b.id ? 0 : a.id < b.id ? 1 : -1);
function formatMessage(message: Message, accountId: string): Item {
  return { id: message.id, body: message.body, createdAt: message.createdAt, mine: message.senderId === accountId, read: message.readAt !== null, kind: 'message' };
}
function events(group: Group): Item[] {
  return [...group.quotes.map(quote => ({ id: `quote:${quote.id}`, body: 'Quotation requested', createdAt: quote.createdAt, mine: false, read: true, kind: 'quote-created' as const })), ...group.bookings.flatMap(booking => {
    const result: Item[] = [{ id: `created:${booking.id}`, body: 'Booking created', createdAt: booking.createdAt, mine: false, read: true, kind: 'booking-created' }];
    if (booking.status === 'Completed') {
      const completedAt = [booking.clientCompletedAt, booking.providerCompletedAt].filter((date): date is Date => !!date).sort((a, b) => b.getTime() - a.getTime())[0] ?? booking.updatedAt;
      result.push({ id: `completed:${booking.id}`, body: 'Booking complete', createdAt: completedAt, mine: false, read: true, kind: 'booking-completed' });
    }
    return result;
  })];
}
function references(group: Group) {
  return [{ bookingId: { in: group.bookings.map(booking => booking.id) } }, { quoteRequestId: { in: group.quotes.map(quote => quote.id) } }];
}
function details(group: Group, role: AccountRole) {
  const booking = group.bookings[0]; const quote = group.quotes[0];
  const latestQuote = quote && (!booking || quote.createdAt > booking.createdAt);
  const active = group.bookings.find(open);
  return { bookingId: latestQuote ? `q:${quote.id}` : booking.id, activeBookingId: active?.id ?? null, quoteRequestId: quote?.id ?? null,
    closed: !active && !group.quotes.some(openQuote), serviceTitle: latestQuote ? quote.listing.title : booking.serviceTitle,
    contactId: role === 'client' ? (latestQuote ? quote.providerId : booking.slot.providerId) : (latestQuote ? quote.clientId : booking.clientId),
    contactName: role === 'client' ? (latestQuote ? quote.provider.businessName : booking.slot.provider.businessName) ?? 'Provider' : (latestQuote ? quote.client.user.name : booking.client.user.name) ?? 'Client' };
}
@Injectable()
export class MessagesService {
  constructor(private readonly db: PrismaService) {}

  async conversations(accountId: string, role: AccountRole) {
    const [bookings, quotes] = await Promise.all([
      this.db.booking.findMany({ where: bookingOwnership(accountId, role), select: threadFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.db.quoteRequest.findMany({ where: role === 'provider' ? { providerId: accountId } : { clientId: accountId }, select: quoteFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    ]);
    const groups = new Map<string, Group>();
    const group = (key: string) => { let value = groups.get(key); if (!value) { value = { bookings: [], quotes: [] }; groups.set(key, value); } return value; };
    for (const booking of bookings) group(role === 'client' ? booking.slot.providerId : booking.clientId).bookings.push(booking);
    for (const quote of quotes) group(role === 'client' ? quote.providerId : quote.clientId).quotes.push(quote);
    const conversations = await Promise.all([...groups.values()].map(async value => {
      const [message, unread] = await Promise.all([
        this.db.message.findFirst({ where: { OR: references(value) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageFields }),
        this.db.message.count({ where: { OR: references(value), senderId: { not: accountId }, readAt: null } }),
      ]);
      const items = events(value); if (message) items.push(formatMessage(message, accountId));
      return { ...details(value, role), latest: items.sort(compare)[0], unread };
    }));
    return conversations.sort((a, b) => compare(a.latest, b.latest));
  }

  private async related(accountId: string, role: AccountRole, id: string): Promise<Group> {
    let clientId: string; let providerId: string;
    if (id.startsWith('q:')) {
      const quote = await this.db.quoteRequest.findFirst({ where: { id: id.slice(2), ...(role === 'provider' ? { providerId: accountId } : { clientId: accountId }) }, select: quoteFields });
      if (!quote) throw new NotFoundException('Conversation unavailable');
      clientId = quote.clientId; providerId = quote.providerId;
    } else {
      const booking = await this.db.booking.findFirst({ where: { id, ...bookingOwnership(accountId, role) }, select: threadFields });
      if (!booking) throw new NotFoundException('Conversation unavailable');
      clientId = booking.clientId; providerId = booking.slot.providerId;
    }
    const [bookings, quotes] = await Promise.all([
      this.db.booking.findMany({ where: { clientId, slot: { providerId } }, select: threadFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.db.quoteRequest.findMany({ where: { clientId, providerId }, select: quoteFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    ]);
    return { bookings, quotes };
  }

  async thread(accountId: string, role: AccountRole, bookingId: string, before: unknown) {
    const group = await this.related(accountId, role, bookingId);
    let cursor: { date: Date; id: string } | undefined;
    if (before !== undefined) {
      try {
        const decoded = JSON.parse(Buffer.from(requiredText(before, 'a message cursor', 512), 'base64url').toString());
        if (typeof decoded.id !== 'string' || typeof decoded.date !== 'string' || Number.isNaN(Date.parse(decoded.date))) throw new Error();
        cursor = { id: decoded.id, date: new Date(decoded.date) };
      } catch { throw new BadRequestException('Invalid message cursor'); }
    }
    const where: Prisma.MessageWhereInput = { AND: [{ OR: references(group) }, ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.date } }, { createdAt: cursor.date, id: { lt: cursor.id } }] }] : [])] };
    const messages = await this.db.message.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: messageFields, take: pageSize + 1 });
    const markerCursor = cursor ? { id: cursor.id, createdAt: cursor.date } as Item : null;
    const markers = events(group).filter(item => !markerCursor || compare(item, markerCursor) > 0);
    const all = [...messages.map(message => formatMessage(message, accountId)), ...markers].sort(compare);
    const items = all.slice(0, pageSize); const last = items[items.length - 1];
    return { ...details(group, role), items, nextCursor: all.length > pageSize ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString('base64url') : null };
  }

  /** Read at most three messages from up to three conversations already owned by this provider. */
  async assistantRecentContext(accountId: string, referencesToLoad: Array<{ kind: 'booking' | 'quote'; id: string }>) {
    const limited = referencesToLoad.slice(0, 3);
    return Promise.all(limited.map(async reference => {
      const threadId = reference.kind === 'quote' ? `q:${reference.id}` : reference.id;
      const group = await this.related(accountId, AccountRole.provider, threadId);
      const messages = await this.db.message.findMany({
        where: { OR: references(group) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 3,
        select: { senderId: true, body: true, createdAt: true },
      });
      return {
        referenceId: reference.id,
        kind: reference.kind,
        messages: messages.reverse().map(item => ({ speaker: item.senderId === accountId ? 'provider' : 'client', body: item.body.slice(0, 700), createdAt: item.createdAt })),
      };
    }));
  }

  async send(accountId: string, role: AccountRole, bookingId: string, value: unknown) {
    const body = requiredText(value, 'a message', 2000);
    const group = await this.related(accountId, role, bookingId);
    const active = group.bookings.find(open); const quote = group.quotes.find(openQuote);
    if (!active && !quote) throw new NotFoundException('Conversation is closed until another quotation is requested or booking is created');
    const message = await this.db.$transaction(async tx => {
      let context: { bookingId: string } | { quoteRequestId: string }; let recipientId: string;
      if (active) {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${active.id} FOR UPDATE`;
        const booking = await tx.booking.findFirst({ where: { id: active.id, ...bookingOwnership(accountId, role), status: { in: ['Pending', 'Confirmed'] } }, select: threadFields });
        if (!booking) throw new NotFoundException('Conversation has closed. Refresh to try again.');
        context = { bookingId: booking.id }; recipientId = role === 'client' ? booking.slot.providerId : booking.clientId;
      } else {
        await tx.$queryRaw`SELECT "id" FROM "QuoteRequest" WHERE "id" = ${quote!.id} FOR UPDATE`;
        const current = await tx.quoteRequest.findFirst({ where: { id: quote!.id, ...(role === 'provider' ? { providerId: accountId } : { clientId: accountId }), status: { in: [...activeQuoteStatuses] } }, select: quoteFields });
        if (!current) throw new NotFoundException('Conversation has closed. Refresh to try again.');
        context = { quoteRequestId: current.id }; recipientId = role === 'client' ? current.providerId : current.clientId;
      }
      const created = await tx.message.create({ data: { ...context, senderId: accountId, body }, select: messageFields });
      await tx.notification.create({ data: { ...context, recipientId, kind: 'MessageReceived', messageId: created.id } });
      return created;
    });
    return formatMessage(message, accountId);
  }

  async markRead(accountId: string, role: AccountRole, bookingId: string, ids: unknown) {
    const group = await this.related(accountId, role, bookingId);
    if (!Array.isArray(ids) || !ids.length || ids.length > pageSize || ids.some(id => typeof id !== 'string' || !id || id.length > 128)) throw new BadRequestException('Pass the messages that were displayed');
    const refs = references(group); const time = new Date();
    await this.db.$transaction([
      this.db.message.updateMany({ where: { id: { in: ids }, OR: refs, senderId: { not: accountId }, readAt: null }, data: { readAt: time } }),
      this.db.notification.updateMany({ where: { recipientId: accountId, OR: refs, kind: 'MessageReceived', messageId: { in: ids }, readAt: null }, data: { readAt: time } }),
    ]);
    return { success: true };
  }
}
