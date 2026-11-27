import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, Prisma } from '@prisma/client';
import { assertCanBook, assertCanStart } from './reliability.service';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';
import { calculateQuotation } from './quote-calculation';
import { lockProfiles } from './bookings.service';

const selection = {
  id: true, clientId: true, providerId: true, listingId: true, description: true, preferredAt: true,
  location: true, additionalInfo: true, status: true, changeRequest: true, createdAt: true, updatedAt: true,
  depositCents: true, bankName: true, accountNumber: true, paymentReference: true, depositConfirmedAt: true,
  listing: { select: { title: true } }, client: { select: { verificationTier: true, user: { select: { name: true } } } },
  provider: { select: { businessName: true, verificationTier: true } }, photos: { select: { id: true, mimeType: true, isListingReference: true } }, booking: { select: { id: true } },
  versions: { orderBy: { version: 'desc' as const } },
} satisfies Prisma.QuoteRequestSelect;

function optional(value: unknown, label: string, max: number) {
  return value == null || value === '' ? null : requiredText(value, label, max);
}
function future(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new BadRequestException(`Choose a valid ${label}`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new BadRequestException(`Choose a future ${label} in South African time`);
  return date;
}
function validBankDetails(input: any) {
  const bankName = requiredText(input?.bankName, 'the bank name', 100);
  const accountNumber = requiredText(input?.accountNumber, 'the account number', 20);
  const paymentReference = requiredText(input?.paymentReference, 'the payment reference', 100);
  if (!/^\d{4,20}$/.test(accountNumber)) throw new BadRequestException('Enter a valid account number using digits only');
  return { bankName, accountNumber, paymentReference };
}
function photos(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 3) throw new BadRequestException('Choose up to three photos');
  return value.map(item => {
    if (typeof item !== 'string' || item.length > 1_400_000) throw new BadRequestException('Each photo must be at most 1 MB');
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(item);
    if (!match) throw new BadRequestException('Use JPEG, PNG, or WebP photos');
    const data = Buffer.from(match[2], 'base64');
    if (data.length > 1_048_576 || data.length === 0 || data.toString('base64') !== match[2]) throw new BadRequestException('Invalid photo');
    const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
    if ((match[1] === 'image/jpeg' && !jpeg) || (match[1] === 'image/png' && !png) || (match[1] === 'image/webp' && !webp)) throw new BadRequestException('Photo content does not match its type');
    return { mimeType: match[1], data };
  });
}

@Injectable()
export class QuotesService {
  constructor(private readonly db: PrismaService) {}
  private async withClientRatings(requests: Prisma.QuoteRequestGetPayload<{ select: typeof selection }>[]) {
    const ids = [...new Set(requests.map(request => request.clientId))];
    if (!ids.length) return [];
    const ratings = await this.db.clientReview.groupBy({ by: ['clientId'], where: { clientId: { in: ids } }, _avg: { rating: true }, _count: { rating: true } });
    const byClient = new Map(ratings.map(rating => [rating.clientId, { averageRating: rating._avg.rating, reviewCount: rating._count.rating }]));
    return requests.map(request => ({ ...request, clientRating: byClient.get(request.clientId) ?? { averageRating: null, reviewCount: 0 } }));
  }
  async list(id: string, role: AccountRole) {
    const requests = await this.db.quoteRequest.findMany({ where: role === 'client' ? { clientId: id } : { providerId: id }, select: selection, orderBy: { createdAt: 'desc' } });
    return role === 'provider' ? this.withClientRatings(requests) : requests;
  }
  async get(id: string, role: AccountRole, requestId: string) {
    const result = await this.db.quoteRequest.findFirst({ where: { id: requestId, ...(role === 'client' ? { clientId: id } : { providerId: id }) }, select: selection });
    if (!result) throw new NotFoundException('Quote request not found');
    return role === 'provider' ? (await this.withClientRatings([result]))[0] : result;
  }
  async create(clientId: string, body: any) {
    const listingId = requiredText(body?.listingId, 'a service', 128);
    const listing = await this.db.serviceListing.findFirst({ where: { id: listingId, isPublished: true }, select: { providerId: true } });
    if (!listing) throw new NotFoundException('Service not found');
    if (listing.providerId === clientId) throw new BadRequestException('You cannot request a quote for your own service');
    const description = requiredText(body?.description, 'the work you need', 2000);
    const location = requiredText(body?.location, 'the service location', 300);
    const preferredAt = future(body?.preferredAt, 'preferred date and time');
    const additionalInfo = optional(body?.additionalInfo, 'additional information', 1000);
    const images = photos(body?.photos);
    const referencePhotoId = body?.referencePhotoId == null || body.referencePhotoId === '' ? null : requiredText(body.referencePhotoId, 'a listing photo', 128);
    return this.db.$transaction(async tx => {
      for (const userId of [clientId, listing.providerId].sort()) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      await assertCanStart(tx, clientId);
      await assertCanBook(tx, [listing.providerId]);
      const reference = referencePhotoId ? await tx.listingPhoto.findFirst({ where: { id: referencePhotoId, listingId, listing: { isPublished: true } }, select: { image: true, mimeType: true } }) : null;
      if (referencePhotoId && !reference) throw new BadRequestException('This listing photo is no longer available. Choose another or continue without one.');
      const requestPhotos = [...images, ...(reference ? [{ mimeType: reference.mimeType, data: reference.image, isListingReference: true }] : [])];
      const request = await tx.quoteRequest.create({ data: { clientId, providerId: listing.providerId, listingId, description, location, preferredAt, additionalInfo, photos: { create: requestPhotos } }, select: selection });
      await tx.quoteAlert.createMany({ data: [{ recipientId: listing.providerId, requestId: request.id, message: 'A client sent you a quote request.' }, { recipientId: clientId, requestId: request.id, message: 'Your quote request was sent.' }] });
      return request;
    });
  }
  async photo(id: string, role: AccountRole, requestId: string, photoId: string) {
    await this.get(id, role, requestId);
    const image = await this.db.quotePhoto.findFirst({ where: { id: photoId, requestId } });
    if (!image) throw new NotFoundException('Photo not found');
    return image;
  }
  async offer(providerId: string, requestId: string, body: any) {
    const serviceDescription = requiredText(body?.serviceDescription, 'a service description', 2000);
    const depositRequired = body?.depositRequired ?? false;
    const costs = calculateQuotation({ labourCents: body?.labourCents, materialsCents: body?.materialsCents, travelCents: body?.travelCents, depositRequired });
    const bank = depositRequired ? validBankDetails(body?.bankDetails) : { bankName: null, accountNumber: null, paymentReference: null };
    const appointmentAt = future(body?.appointmentAt, 'appointment');
    const durationMinutes = body?.durationMinutes;
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080) throw new BadRequestException('Enter a duration between 1 and 10080 minutes');
    const validity = body?.validHours;
    if (![1, 3, 5, 12, 24, 48].includes(validity)) throw new BadRequestException('Choose a valid quotation period');
    const notes = optional(body?.notes, 'notes', 2000);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${providerId} FOR UPDATE`;
      await assertCanStart(tx, providerId);
      const current = await tx.quoteRequest.findFirst({ where: { id: requestId, providerId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
      if (!current) throw new NotFoundException('Quote request not found');
      if (current.status !== 'Pending' && current.status !== 'RevisionRequested') throw new ConflictException('This request cannot be quoted');
      const changed = await tx.quoteRequest.updateMany({ where: { id: requestId, status: current.status }, data: { status: 'Quoted' } });
      if (!changed.count) throw new ConflictException('This request has changed. Refresh and try again.');
      await tx.quoteVersion.create({ data: { requestId, version: (current.versions[0]?.version ?? 0) + 1, serviceDescription, labourCents: costs.labourCents, materialsCents: costs.materialsCents, travelCents: costs.travelCents, totalCents: costs.totalCents, depositRequired, depositCents: depositRequired ? costs.depositCents : null, ...bank, durationMinutes, appointmentAt, notes, expiresAt: new Date(Date.now() + validity * 3600000) } });
      await tx.quoteAlert.create({ data: { recipientId: current.clientId, requestId, message: current.versions.length ? 'The provider sent a revised quotation.' : 'The provider sent you a quotation.' } });
      return tx.quoteRequest.findUniqueOrThrow({ where: { id: requestId }, select: selection });
    });
  }
  private async createBooking(tx: Prisma.TransactionClient, current: Prisma.QuoteRequestGetPayload<{ include: { listing: { select: { title: true } }, versions: { orderBy: { version: 'desc' }, take: 1 } } }>) {
    const version = current.versions[0];
    if (!version) throw new ConflictException('Quotation not found');
    const startsAt = version.appointmentAt;
    const endsAt = new Date(startsAt.getTime() + version.durationMinutes * 60000);
    if (startsAt <= new Date()) throw new ConflictException('The proposed appointment has passed. Please request a new quotation.');
    const overlap = await tx.booking.findFirst({ where: {
      status: { in: ['Pending', 'Confirmed'] },
      slot: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      OR: [{ slot: { providerId: current.providerId } }, { clientId: current.clientId }],
    }, select: { id: true } });
    if (overlap) throw new ConflictException('This appointment overlaps an existing booking. Please request a different time.');
    const slot = await tx.availabilitySlot.create({ data: { providerId: current.providerId, startsAt, endsAt, isOpen: false } });
    const booking = await tx.booking.create({ data: {
      clientId: current.clientId, listingId: current.listingId, slotId: slot.id, quoteRequestId: current.id,
      serviceTitle: current.listing.title, address: current.location, notes: current.additionalInfo,
      status: 'Confirmed', priceCents: version.totalCents, maxPriceCents: null, priceUnit: 'PerProject',
    }, select: { id: true } });
    await tx.notification.createMany({ data: [
      { recipientId: current.clientId, bookingId: booking.id, kind: 'BookingStatusChanged', bookingStatus: 'Confirmed' },
      { recipientId: current.providerId, bookingId: booking.id, kind: 'BookingStatusChanged', bookingStatus: 'Confirmed' },
    ] });
    const pending = await tx.quoteRequest.findMany({ where: { providerId: current.providerId, status: 'DepositPending', id: { not: current.id } }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
    for (const other of pending) {
      const candidate = other.versions[0];
      if (!candidate) continue;
      const candidateEnd = new Date(candidate.appointmentAt.getTime() + candidate.durationMinutes * 60000);
      if (candidate.appointmentAt < endsAt && candidateEnd > startsAt) {
        const changed = await tx.quoteRequest.updateMany({ where: { id: other.id, status: 'DepositPending' }, data: { status: 'SlotUnavailable' } });
        if (changed.count) await tx.quoteAlert.createMany({ data: [
          { recipientId: other.clientId, requestId: other.id, message: 'Your appointment is no longer available because another booking was confirmed first. Please contact the provider about an alternative time or any payment made.' },
          { recipientId: other.providerId, requestId: other.id, message: 'A pending deposit request lost its appointment to another booking. Contact the client about an alternative or any payment made.' },
        ] });
      }
    }
    return booking;
  }
  async respond(clientId: string, requestId: string, body: any) {
    const action = body?.action;
    if (!['accept', 'decline', 'changes'].includes(action)) throw new BadRequestException('Choose a response');
    const changeRequest = action === 'changes' ? requiredText(body?.changeRequest, 'the changes you need', 1000) : null;
    return this.db.$transaction(async tx => {
      if (action === 'accept') {
        const owner = await tx.quoteRequest.findFirst({ where: { id: requestId, clientId }, select: { providerId: true } });
        if (!owner) throw new NotFoundException('Quote request not found');
        await lockProfiles(tx, owner.providerId, clientId);
        for (const userId of [owner.providerId, clientId].sort()) await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        await assertCanBook(tx, [owner.providerId, clientId]);
      }
      const current = await tx.quoteRequest.findFirst({ where: { id: requestId, clientId }, include: { listing: { select: { title: true } }, versions: { orderBy: { version: 'desc' }, take: 1 } } });
      if (!current) throw new NotFoundException('Quote request not found');
      if (current.status !== 'Quoted' || !current.versions[0] || current.versions[0].expiresAt <= new Date()) throw new ConflictException('This quotation is no longer available or has expired');
      const version = current.versions[0];
      const depositRequired = action === 'accept' && version.depositRequired;
      let depositCents: number | null = null;
      if (action === 'accept') {
        if (version.appointmentAt <= new Date()) throw new ConflictException('The proposed appointment has passed. Please request a new quotation.');
        if (depositRequired) {
          depositCents = version.depositCents;
          if (!depositCents) throw new BadRequestException('A deposit is not available for a zero-value quotation');
          const endsAt = new Date(version.appointmentAt.getTime() + version.durationMinutes * 60000);
          const overlap = await tx.booking.findFirst({ where: { status: { in: ['Pending', 'Confirmed'] }, slot: { startsAt: { lt: endsAt }, endsAt: { gt: version.appointmentAt } }, OR: [{ slot: { providerId: current.providerId } }, { clientId }] }, select: { id: true } });
          if (overlap) throw new ConflictException('This appointment overlaps an existing booking. Please request a different time.');
        } else await this.createBooking(tx, current);
      }
      const status = action === 'accept' ? (depositRequired ? 'DepositPending' : 'Accepted') : action === 'decline' ? 'Declined' : 'RevisionRequested';
      const changed = await tx.quoteRequest.updateMany({ where: { id: requestId, status: 'Quoted', versions: { some: { id: version.id, expiresAt: { gt: new Date() } } } }, data: { status, changeRequest, depositCents, ...(depositRequired ? { bankName: version.bankName, accountNumber: version.accountNumber, paymentReference: version.paymentReference } : {}) } });
      if (!changed.count) throw new ConflictException('This quotation has changed. Refresh and try again.');
      await tx.quoteAlert.create({ data: { recipientId: current.providerId, requestId, message: depositRequired ? 'The client accepted your quotation. The 25% deposit is awaiting payment.' : action === 'accept' ? 'The client accepted your quotation.' : action === 'decline' ? 'The client declined your quotation.' : 'The client requested changes to your quotation.' } });
      if (depositRequired) await tx.quoteAlert.create({ data: { recipientId: clientId, requestId, message: 'Your deposit is pending. Your appointment is not guaranteed until the provider confirms receipt. Another client may secure this time first.' } });
      return tx.quoteRequest.findUniqueOrThrow({ where: { id: requestId }, select: selection });
    });
  }
  async bankDetails(providerId: string, requestId: string, input: any) {
    const bank = validBankDetails(input);
    return this.db.$transaction(async tx => {
      // Only legacy pending requests without bank details may use this endpoint.
      const changed = await tx.quoteRequest.updateMany({ where: { id: requestId, providerId, status: 'DepositPending', bankName: null }, data: bank });
      if (!changed.count) throw new NotFoundException('Pending deposit request not found');
      const current = await tx.quoteRequest.findUniqueOrThrow({ where: { id: requestId }, select: selection });
      await tx.quoteAlert.create({ data: { recipientId: current.clientId, requestId, message: 'The provider has supplied bank details for your deposit. Your appointment remains unconfirmed until the provider verifies payment.' } });
      return current;
    });
  }
  async confirmDeposit(providerId: string, requestId: string) {
    return this.db.$transaction(async tx => {
      const owner = await tx.quoteRequest.findFirst({ where: { id: requestId, providerId }, select: { clientId: true } });
      if (!owner) throw new NotFoundException('Quote request not found');
      await lockProfiles(tx, providerId, owner.clientId);
      const current = await tx.quoteRequest.findFirst({ where: { id: requestId, providerId }, include: { listing: { select: { title: true } }, versions: { orderBy: { version: 'desc' }, take: 1 } } });
      if (!current || current.status !== 'DepositPending' || !current.depositCents) throw new ConflictException('This request is not awaiting a deposit');
      if (!current.bankName || !current.accountNumber || !current.paymentReference) throw new ConflictException('Provide bank details before confirming the deposit');
      await this.createBooking(tx, current);
      await tx.quoteRequest.update({ where: { id: requestId }, data: { status: 'Accepted', depositConfirmedAt: new Date(), depositConfirmedBy: providerId } });
      await tx.quoteAlert.create({ data: { recipientId: current.clientId, requestId, message: 'The provider confirmed receipt of your deposit. Your booking is confirmed.' } });
      return tx.quoteRequest.findUniqueOrThrow({ where: { id: requestId }, select: selection });
    });
  }
  async alerts(id: string) { return this.db.quoteAlert.findMany({ where: { recipientId: id }, include: { request: { select: { listing: { select: { title: true } } } } }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  async readAllAlerts(id: string) { await this.db.quoteAlert.updateMany({ where: { recipientId: id, readAt: null }, data: { readAt: new Date() } }); return { success: true }; }
  async readAlert(id: string, alertId: string) { await this.db.quoteAlert.updateMany({ where: { id: alertId, recipientId: id }, data: { readAt: new Date() } }); return { success: true }; }
}
