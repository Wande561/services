import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, BookingStatus, Prisma } from '@prisma/client';
import { assertCanBook, awardCompletion, recordCancellation } from './reliability.service';
import { bookingOwnership } from './booking-ownership';
import { paymentFields } from './payments.service';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

const activeStatuses: BookingStatus[] = ['Pending', 'Confirmed'];
const slotFields = { id: true, startsAt: true, endsAt: true } satisfies Prisma.AvailabilitySlotSelect;
const bookingFields = {
  id: true,
  serviceTitle: true,
  address: true,
  notes: true,
  priceCents: true,
  maxPriceCents: true,
  priceUnit: true,
  status: true,
  createdAt: true, updatedAt: true,
  clientCompletedAt: true,
  providerCompletedAt: true,
  clientId: true,
  quoteRequestId: true,
  quoteRequest: { select: { depositCents: true, depositConfirmedAt: true } },
  review: { select: { rating: true, comment: true, createdAt: true } },
  clientReview: { select: { rating: true, comment: true, createdAt: true } },
  payments: { select: paymentFields, orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }] },
  slot: {
    select: { startsAt: true, endsAt: true, providerId: true, provider: { select: { businessName: true, verificationTier: true } } },
  },
  client: { select: { verificationTier: true, user: { select: { name: true } } } },
} satisfies Prisma.BookingSelect;

type BookingRecord = Prisma.BookingGetPayload<{ select: typeof bookingFields }>;

function formatBooking({ slot, client, clientId, priceCents, maxPriceCents, priceUnit, ...booking }: BookingRecord) {
  return {
    ...booking,
    clientId,
    providerId: slot.providerId,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    providerName: slot.provider.businessName ?? 'Provider',
    providerVerificationTier: slot.provider.verificationTier,
    clientName: client.user.name ?? 'Client',
    clientVerificationTier: client.verificationTier,
    listingPrice: priceCents !== null && priceUnit ? { priceCents, maxPriceCents, priceUnit } : null,
  };
}

function slotTime(day: unknown, time: unknown) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new BadRequestException('Choose a valid date and time');
  }
  const calendarDay = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== day) {
    throw new BadRequestException('Choose a valid calendar date');
  }
  return new Date(`${day}T${time}:00+02:00`);
}

export async function lockProfiles(tx: Prisma.TransactionClient, providerId: string, clientId?: string) {
  // Lock the provider first so a competing client cannot hold their profile while
  // waiting for the provider and block notifications for the winning request.
  await tx.$queryRaw`SELECT "userId" FROM "Profile" WHERE "userId" = ${providerId} FOR UPDATE`;
  if (clientId && clientId !== providerId) await tx.$queryRaw`SELECT "userId" FROM "Profile" WHERE "userId" = ${clientId} FOR UPDATE`;
}

@Injectable()
export class BookingsService {
  constructor(private readonly db: PrismaService) {}

  async slotsForListing(listingId: unknown) {
    const id = requiredText(listingId, 'a service listing', 128);
    const listing = await this.db.serviceListing.findUnique({
      where: { id, isPublished: true },
      select: { providerId: true },
    });
    if (!listing) throw new NotFoundException('Service listing not found');
    const slots = await this.db.availabilitySlot.findMany({
      where: {
        providerId: listing.providerId,
        isOpen: true,
        startsAt: { gt: new Date() },
        bookings: { none: { status: { in: activeStatuses } } },
      },
      orderBy: { startsAt: 'asc' },
      select: slotFields,
    });
    const active = await this.db.booking.findMany({ where: { status: { in: activeStatuses }, slot: { providerId: listing.providerId } }, select: { slot: { select: { startsAt: true, endsAt: true } } } });
    return slots.filter(slot => !active.some(({ slot: occupied }) => occupied.startsAt < slot.endsAt && occupied.endsAt > slot.startsAt));
  }

  async providerAvailability(providerId: string) {
    const slots = await this.db.availabilitySlot.findMany({
      where: { providerId, isOpen: true, startsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: {
        ...slotFields,
        _count: { select: { bookings: { where: { status: { in: activeStatuses } } } } },
      },
    });
    const active = await this.db.booking.findMany({ where: { status: { in: activeStatuses }, slot: { providerId } }, select: { slot: { select: { startsAt: true, endsAt: true } } } });
    return slots.map(({ _count, ...slot }) => ({ ...slot, reserved: _count.bookings > 0 || active.some(({ slot: occupied }) => occupied.startsAt < slot.endsAt && occupied.endsAt > slot.startsAt) }));
  }

  addSlot(providerId: string, input?: Record<string, unknown>) {
    const startsAt = slotTime(input?.date, input?.startTime);
    const endsAt = slotTime(input?.date, input?.endTime);
    if (endsAt <= startsAt) throw new BadRequestException('End time must be after start time');

    return this.db.$transaction(async tx => {
      await lockProfiles(tx, providerId);
      if (startsAt <= new Date()) throw new BadRequestException('Choose a time in the future');
      const overlap = await tx.availabilitySlot.findFirst({
        where: { providerId, isOpen: true, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        select: { id: true },
      });
      if (overlap) throw new ConflictException('This overlaps with another availability slot');
      const booked = await tx.booking.findFirst({ where: { status: { in: activeStatuses }, slot: { providerId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }, select: { id: true } });
      if (booked) throw new ConflictException('This overlaps with an existing booking');
      return tx.availabilitySlot.create({
        data: { providerId, startsAt, endsAt },
        select: slotFields,
      });
    });
  }

  closeSlot(providerId: string, id: string) {
    return this.db.$transaction(async tx => {
      await lockProfiles(tx, providerId);
      const slot = await tx.availabilitySlot.findUnique({
        where: { id, providerId },
        select: { isOpen: true, _count: { select: { bookings: { where: { status: { in: activeStatuses } } } } } },
      });
      if (!slot) throw new NotFoundException('Availability slot not found');
      if (slot._count.bookings > 0) throw new ConflictException('Resolve the booking before removing this slot');
      if (slot.isOpen) await tx.availabilitySlot.update({ where: { id }, data: { isOpen: false } });
      return { id };
    });
  }

  async list(accountId: string, role: AccountRole) {
    const bookings = await this.db.booking.findMany({
      where: bookingOwnership(accountId, role),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: bookingFields,
    });
    return bookings.map(formatBooking);
  }

  async request(clientId: string, input?: Record<string, unknown>) {
    const listingId = requiredText(input?.listingId, 'a service listing', 128);
    const slotId = requiredText(input?.slotId, 'an available slot', 128);
    const address = requiredText(input?.address, 'the service address', 300);
    const notes = input?.notes == null || (typeof input.notes === 'string' && !input.notes.trim())
      ? null : requiredText(input.notes, 'valid booking notes', 1000);

    try {
      const booking = await this.db.$transaction(async tx => {
        const slotOwner = await tx.availabilitySlot.findUnique({ where: { id: slotId }, select: { providerId: true } });
        if (!slotOwner) throw new NotFoundException('Availability slot not found');
        const { providerId } = slotOwner;
        if (providerId === clientId) throw new BadRequestException('You cannot book your own service');
        await lockProfiles(tx, providerId, clientId);
        const listing = await tx.serviceListing.findUnique({
          where: { id: listingId, providerId, isPublished: true },
          select: { title: true, priceCents: true, maxPriceCents: true, priceUnit: true },
        });
        if (!listing) throw new NotFoundException('This service has no matching availability slot');

        const slot = await tx.availabilitySlot.findFirst({
          where: {
            id: slotId, isOpen: true, startsAt: { gt: new Date() },
            bookings: { none: { status: { in: activeStatuses } } },
          },
          select: slotFields,
        });
        if (!slot) throw new ConflictException('This time is no longer available');

        const providerOverlap = await tx.booking.findFirst({ where: { status: { in: activeStatuses }, slot: { providerId, startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } } }, select: { id: true } });
        if (providerOverlap) throw new ConflictException('This time is no longer available');
        const overlap = await tx.booking.findFirst({
          where: {
            clientId,
            status: { in: activeStatuses },
            slot: { startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } },
          },
          select: { id: true },
        });
        if (overlap) throw new ConflictException('You already have a booking that overlaps this time');

        const created = await tx.booking.create({
          data: {
            clientId, listingId, slotId, serviceTitle: listing.title, address, notes,
            priceCents: listing.priceCents, maxPriceCents: listing.maxPriceCents, priceUnit: listing.priceUnit,
          },
          select: bookingFields,
        });
        await tx.notification.create({ data: { recipientId: providerId, bookingId: created.id, kind: 'BookingRequested' } });
        return created;
      });
      return formatBooking(booking);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This time is no longer available');
      }
      throw error;
    }
  }

  async confirmCompletion(accountId: string, role: AccountRole, id: string) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id} FOR UPDATE`;
      const booking = await tx.booking.findUnique({ where: { id, ...bookingOwnership(accountId, role) }, select: bookingFields });
      if (!booking) throw new NotFoundException('Booking not found');
      const ownConfirmation = role === 'client' ? booking.clientCompletedAt : booking.providerCompletedAt;
      if (ownConfirmation && (booking.status === 'Confirmed' || booking.status === 'Completed')) return formatBooking(booking);
      if (booking.status !== 'Confirmed') throw new ConflictException('Only a confirmed booking can be marked as service completed');
      const otherConfirmation = role === 'client' ? booking.providerCompletedAt : booking.clientCompletedAt;
      const when = new Date();
      const updated = await tx.booking.update({ where: { id }, data: {
        ...(role === 'client' ? { clientCompletedAt: when } : { providerCompletedAt: when }),
        ...(otherConfirmation ? { status: 'Completed' } : {}),
      }, select: bookingFields });
      if (otherConfirmation) {
        await awardCompletion(tx, id, booking.clientId, booking.slot.providerId);
        await tx.bookingReschedule.updateMany({ where: { bookingId: id, status: 'Pending' }, data: { status: 'Cancelled' } });
        await tx.notification.updateMany({ where: { bookingId: id, kind: 'MessageReceived', readAt: null }, data: { readAt: when } });
        await tx.notification.createMany({ data: [
          { bookingId: id, recipientId: booking.clientId, kind: 'BookingStatusChanged', bookingStatus: 'Completed' },
          { bookingId: id, recipientId: booking.slot.providerId, kind: 'BookingStatusChanged', bookingStatus: 'Completed' },
        ] });
      } else {
        await tx.notification.create({ data: { bookingId: id, recipientId: role === 'client' ? booking.slot.providerId : booking.clientId, kind: 'ServiceCompletionConfirmation' } });
      }
      return formatBooking(updated);
    });
  }

  async changeStatus(accountId: string, role: AccountRole, id: string, status: unknown, input?: { emergency?: unknown; reason?: unknown }) {
    if (status !== 'Confirmed' && status !== 'Declined' && status !== 'Cancelled') throw new BadRequestException('Choose a valid booking status');
    if (input?.emergency !== undefined && typeof input.emergency !== 'boolean') throw new BadRequestException('Choose whether an emergency applies');
    const emergency = input?.emergency === true;
    const reason = emergency ? requiredText(input?.reason, 'the emergency or circumstances', 2000) : typeof input?.reason === 'string' && input.reason.trim() ? requiredText(input.reason, 'a reason', 2000) : 'No reason provided';
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id} FOR UPDATE`;
      const booking = await tx.booking.findUnique({ where: { id, ...bookingOwnership(accountId, role) }, select: bookingFields });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status === status) return formatBooking(booking);
      const now = new Date(); const pending = booking.status === 'Pending'; const confirmed = booking.status === 'Confirmed'; const provider = role === 'provider'; const beforeStart = booking.slot.startsAt > now;
      const allowed = (status === 'Confirmed' && provider && pending && beforeStart) || (status === 'Declined' && provider && pending && beforeStart) || (status === 'Cancelled' && ((pending && !provider && beforeStart) || (confirmed && (beforeStart || emergency))));
      if (!allowed) throw new ConflictException('This booking can no longer be changed to that status');
      if (status === 'Confirmed') await assertCanBook(tx, [booking.clientId, booking.slot.providerId]);
      const updated = await tx.booking.update({ where: { id }, data: { status }, select: bookingFields });
      if (status === 'Cancelled' || status === 'Declined') {
        await recordCancellation(tx, { bookingId: id, actorId: accountId, otherId: provider ? booking.clientId : booking.slot.providerId, clientId: booking.clientId, startsAt: booking.slot.startsAt, depositCents: booking.quoteRequest?.depositCents ?? null, depositConfirmedAt: booking.quoteRequest?.depositConfirmedAt ?? null, emergency, reason, now });
        await tx.bookingReschedule.updateMany({ where: { bookingId: id, status: 'Pending' }, data: { status: 'Cancelled' } });
      }
      await tx.notification.create({ data: { bookingId: id, recipientId: provider ? booking.clientId : booking.slot.providerId, kind: 'BookingStatusChanged', bookingStatus: status } });
      return formatBooking(updated);
    });
  }
}
