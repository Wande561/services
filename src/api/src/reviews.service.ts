import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

const pageSize = 20;
const reviewFields = { rating: true, comment: true, createdAt: true } satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewsService {
  constructor(private readonly db: PrismaService) {}

  async listing(listingId: string, before: unknown) {
    const listing = await this.db.serviceListing.findUnique({
      where: { id: listingId, isPublished: true },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException('Service listing not found');
    const where = { booking: { listingId } };
    let cursor: { id: string } | undefined;
    if (before !== undefined) {
      const id = requiredText(before, 'a review cursor', 128);
      if (!await this.db.review.findUnique({ where: { id, ...where }, select: { id: true } })) {
        throw new NotFoundException('Review cursor not found');
      }
      cursor = { id };
    }
    const [records, stats] = await this.db.$transaction([
      this.db.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pageSize + 1,
        ...(cursor && { cursor, skip: 1 }),
        select: { id: true, ...reviewFields },
      }),
      this.db.review.aggregate({ where, _avg: { rating: true }, _count: { rating: true } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return {
      items: records.slice(0, pageSize),
      nextCursor: records.length > pageSize ? records[pageSize - 1].id : null,
      averageRating: stats._avg.rating,
      reviewCount: stats._count.rating,
    };
  }

  async provider(providerId: string) {
    const stats = await this.db.review.aggregate({
      where: { booking: { slot: { providerId } } }, _avg: { rating: true }, _count: { rating: true },
    });
    return { averageRating: stats._avg.rating, reviewCount: stats._count.rating };
  }

  async client(clientId: string) {
    const stats = await this.db.clientReview.aggregate({ where: { clientId }, _avg: { rating: true }, _count: { rating: true } });
    return { averageRating: stats._avg.rating, reviewCount: stats._count.rating };
  }

  async leaveClientReview(providerId: string, bookingId: string, input?: Record<string, unknown>) {
    const rating = input?.rating;
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('Choose a rating from 1 to 5');
    const comment = input?.comment == null || (typeof input.comment === 'string' && !input.comment.trim()) ? null : requiredText(input.comment, 'a review comment', 1000);
    const booking = await this.db.booking.findFirst({ where: { id: bookingId, slot: { providerId } }, select: { status: true, clientId: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'Completed') throw new ConflictException('You can review a completed booking');
    try {
      const [review] = await this.db.$transaction([
        this.db.clientReview.create({ data: { bookingId, clientId: booking.clientId, rating, comment }, select: reviewFields }),
        this.db.notification.create({ data: { bookingId, recipientId: booking.clientId, kind: 'ReviewReceived' } }),
      ]);
      return review;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('You already reviewed this client for this booking');
      throw error;
    }
  }

  async leave(clientId: string, bookingId: string, input?: Record<string, unknown>) {
    const rating = input?.rating;
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Choose a rating from 1 to 5');
    }
    const comment = input?.comment == null || (typeof input.comment === 'string' && !input.comment.trim())
      ? null : requiredText(input.comment, 'a review comment', 1000);
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId, clientId },
      select: { status: true, slot: { select: { providerId: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'Completed') throw new ConflictException('You can review a completed booking');

    try {
      const [review] = await this.db.$transaction([
        this.db.review.create({ data: { bookingId, rating, comment }, select: reviewFields }),
        this.db.notification.create({ data: { bookingId, recipientId: booking.slot.providerId, kind: 'ReviewReceived' } }),
      ]);
      return review;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This booking already has a review');
      }
      throw error;
    }
  }
}
