import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { formatListing, listingFields } from './services.service';

@Injectable()
export class ProvidersService {
  constructor(private readonly db: PrismaService) {}

  async publicProfile(id: string) {
    const profile = await this.db.profile.findFirst({ where: { userId: id, providerEnabled: true, listings: { some: { isPublished: true } } }, select: {
      businessName: true, location: true, serviceCategories: true, otherService: true, verificationTier: true, workingHours: true,
      user: { select: { name: true } },
      listings: { where: { isPublished: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: listingFields },
    } });
    if (!profile) throw new NotFoundException('Provider profile not found');
    const reviews = await this.db.review.aggregate({ where: { booking: { slot: { providerId: id } } }, _avg: { rating: true }, _count: { rating: true } });
    return { id, name: profile.businessName || profile.user.name || 'Provider', location: profile.location, serviceCategories: profile.serviceCategories, otherService: profile.otherService, verificationTier: profile.verificationTier, workingHours: profile.workingHours, listings: profile.listings.map(formatListing), averageRating: reviews._avg.rating, reviewCount: reviews._count.rating };
  }

  async hours(id: string) {
    const profile = await this.db.profile.findUniqueOrThrow({ where: { userId: id }, select: { workingHours: true } });
    return { workingHours: profile.workingHours };
  }

  async updateHours(id: string, input: unknown) {
    if (!Array.isArray(input) || input.length !== 7) throw new BadRequestException('Set working hours for all seven days');
    const days = new Set<number>();
    const rows = input.map((row: any) => {
      if (!row || !Number.isInteger(row.day) || row.day < 0 || row.day > 6 || days.has(row.day) || typeof row.closed !== 'boolean') throw new BadRequestException('Enter a valid weekly schedule');
      days.add(row.day);
      if (row.closed) return { day: row.day, closed: true, open: null, close: null };
      if (typeof row.open !== 'string' || typeof row.close !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.close) || row.open >= row.close) throw new BadRequestException('Choose opening and closing times on the same day, with closing after opening');
      return { day: row.day, closed: false, open: row.open, close: row.close };
    }).sort((a,b) => a.day - b.day);
    await this.db.profile.update({ where: { userId: id }, data: { workingHours: rows as Prisma.InputJsonValue } });
    return { workingHours: rows };
  }

  async insights(id: string) {
    const profile = await this.db.profile.findUniqueOrThrow({ where: { userId: id }, select: { location: true } });
    const now = new Date();
    const day = new Date(now.getTime() + 2 * 3600000).toISOString().slice(0, 10);
    const today = new Date(`${day}T00:00:00+02:00`);
    const tomorrow = new Date(today.getTime() + 86400000);
    const week = new Date(now.getTime() - 7 * 86400000);
    const [todayAppointments, todayRequests, weeklyRequests, weeklyBookings, weeklyCompleted, categories, recentCategories] = await this.db.$transaction([
      this.db.booking.count({ where: { slot: { providerId: id, startsAt: { gte: today, lt: tomorrow } }, status: { in: ['Pending', 'Confirmed'] } } }),
      this.db.quoteRequest.count({ where: { providerId: id, createdAt: { gte: today, lt: tomorrow } } }),
      this.db.quoteRequest.count({ where: { providerId: id, createdAt: { gte: week } } }),
      this.db.booking.count({ where: { slot: { providerId: id }, createdAt: { gte: week } } }),
      this.db.booking.count({ where: { slot: { providerId: id }, status: 'Completed', OR: [{ clientCompletedAt: { gte: week } }, { providerCompletedAt: { gte: week } }] } }),
      this.db.serviceListing.groupBy({ by: ['category'], where: { isPublished: true, location: { equals: profile.location, mode: 'insensitive' } }, _count: { _all: true }, orderBy: { _count: { category: 'desc' } }, take: 5 }),
      this.db.serviceListing.groupBy({ by: ['category'], where: { isPublished: true, location: { equals: profile.location, mode: 'insensitive' }, createdAt: { gte: week } }, _count: { _all: true }, orderBy: { category: 'asc' } }),
    ]);
    return { location: profile.location, todayAppointments, todayRequests, weeklyRequests, weeklyBookings, weeklyCompleted, localCategories: categories.map(item => ({ category: item.category, count: typeof item._count === 'object' ? item._count?._all ?? 0 : 0, newThisWeek: (() => { const recent = recentCategories.find(row => row.category === item.category)?._count; return typeof recent === 'object' ? recent?._all ?? 0 : 0; })() })) };
  }
}
