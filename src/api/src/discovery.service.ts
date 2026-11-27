import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { formatListing, listingFields } from './services.service';

@Injectable()
export class DiscoveryService {
  constructor(private readonly db: PrismaService) {}
  async listingVisible(id: string) {
    if (!await this.db.serviceListing.findFirst({ where: { id, isPublished: true }, select: { id: true } })) throw new NotFoundException('Service not found');
  }
  async setListing(clientId: string, listingId: string, saved: boolean) {
    if (saved) { await this.listingVisible(listingId); await this.db.clientFavoriteListing.upsert({ where: { clientId_listingId: { clientId, listingId } }, create: { clientId, listingId }, update: {} }); }
    else await this.db.clientFavoriteListing.deleteMany({ where: { clientId, listingId } });
    return { saved };
  }
  async setProvider(clientId: string, providerId: string, saved: boolean) {
    if (saved) {
      if (!await this.db.profile.findFirst({ where: { userId: providerId, providerEnabled: true, listings: { some: { isPublished: true } } }, select: { userId: true } })) throw new NotFoundException('Provider not found');
      await this.db.clientFavoriteProvider.upsert({ where: { clientId_providerId: { clientId, providerId } }, create: { clientId, providerId }, update: {} });
    } else await this.db.clientFavoriteProvider.deleteMany({ where: { clientId, providerId } });
    return { saved };
  }
  async recordView(clientId: string, listingId: string) {
    await this.listingVisible(listingId);
    await this.db.$transaction(async tx => {
      await tx.clientListingView.upsert({ where: { clientId_listingId: { clientId, listingId } }, create: { clientId, listingId }, update: { viewedAt: new Date() } });
      const excess = await tx.clientListingView.findMany({ where: { clientId }, orderBy: [{ viewedAt: 'desc' }, { listingId: 'desc' }], skip: 50, select: { listingId: true } });
      if (excess.length) await tx.clientListingView.deleteMany({ where: { clientId, listingId: { in: excess.map(row => row.listingId) } } });
    });
    return { recorded: true };
  }
  async mine(clientId: string) {
    const profile = await this.db.profile.findUniqueOrThrow({ where: { userId: clientId }, select: { location: true } });
    const [favoriteRows, providerRows, viewedRows, quoteInterests] = await this.db.$transaction([
      this.db.clientFavoriteListing.findMany({ where: { clientId, listing: { isPublished: true } }, orderBy: { createdAt: 'desc' }, select: { listing: { select: listingFields } } }),
      this.db.clientFavoriteProvider.findMany({ where: { clientId, provider: { providerEnabled: true, listings: { some: { isPublished: true } } } }, orderBy: { createdAt: 'desc' }, select: { provider: { select: { userId: true, businessName: true, location: true, verificationTier: true, user: { select: { name: true } } } } } }),
      this.db.clientListingView.findMany({ where: { clientId, listing: { isPublished: true } }, orderBy: { viewedAt: 'desc' }, take: 12, select: { listing: { select: listingFields } } }),
      this.db.quoteRequest.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 30, select: { listing: { select: { category: true } } } }),
    ]);
    const favorites = favoriteRows.map(row => formatListing(row.listing));
    const recent = viewedRows.map(row => formatListing(row.listing));
    const interest = [...new Set([...favorites.map(row => row.category), ...recent.map(row => row.category), ...quoteInterests.map(row => row.listing.category)])];
    const matches: Prisma.ServiceListingWhereInput[] = [{ location: { equals: profile.location, mode: 'insensitive' } }, ...(interest.length ? [{ category: { in: interest } }] : [])];
    const candidates = await this.db.serviceListing.findMany({ where: { isPublished: true, OR: matches }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 80, select: listingFields });
    const location = profile.location.trim().toLowerCase();
    const recommended = candidates.map(formatListing).sort((a,b) => ((b.location.trim().toLowerCase() === location ? 2 : 0) + (interest.includes(b.category) ? 1 : 0)) - ((a.location.trim().toLowerCase() === location ? 2 : 0) + (interest.includes(a.category) ? 1 : 0))).slice(0, 6);
    const popularGroups = await this.db.quoteRequest.groupBy({ by: ['listingId'], where: { listing: { isPublished: true, location: { equals: profile.location, mode: 'insensitive' } } }, _count: { _all: true }, orderBy: { _count: { listingId: 'desc' } }, take: 6 });
    const popularListings = await this.db.serviceListing.findMany({ where: { isPublished: true, id: { in: popularGroups.map(row => row.listingId) } }, select: listingFields });
    const popular = popularGroups.flatMap(row => { const listing = popularListings.find(item => item.id === row.listingId); return listing ? [formatListing(listing)] : []; });
    return { location: profile.location, favorites, favoriteProviders: providerRows.map(({ provider }) => ({ id: provider.userId, name: provider.businessName || provider.user.name || 'Provider', location: provider.location, verificationTier: provider.verificationTier })), recent, recommended, popular };
  }
}
