import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PriceUnit, Prisma, ServiceCategory } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { imageData } from './photo-validation';
import { requiredText } from './request-validation';
import { ObjectStorageService } from './object-storage.service';

const pageSize = 24;
const maxDatabaseInteger = 2_147_483_647;
export const listingFields = {
  id: true,
  providerId: true,
  title: true,
  description: true,
  category: true,
  location: true,
  priceCents: true,
  maxPriceCents: true,
  priceUnit: true,
  isPublished: true,
  photos: { select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  provider: { select: { businessName: true, verificationTier: true } },
  _count: { select: { bookings: { where: { review: { isNot: null } } } } },
} satisfies Prisma.ServiceListingSelect;
const newestFirst = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.ServiceListingOrderByWithRelationInput[];

type ListingInput = Record<string, unknown> | undefined;
type ListingRecord = Prisma.ServiceListingGetPayload<{ select: typeof listingFields }>;

export function formatListing({ provider, _count, ...listing }: ListingRecord) {
  return { ...listing, providerName: provider.businessName ?? 'Provider', verificationTier: provider.verificationTier, reviewCount: _count.bookings };
}

function isEnumValue<T extends string>(values: Record<string, T>, value: unknown): value is T {
  return typeof value === 'string' && Object.values(values).some(option => option === value);
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || (typeof value === 'string' && !value.trim())) return undefined;
  return requiredText(value, label, maxLength);
}

function getPage(value: unknown) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new BadRequestException('Enter a valid page number');
  }
  const page = Number(value);
  if (page < 1 || (page - 1) * pageSize > maxDatabaseInteger) {
    throw new BadRequestException('Enter a valid page number');
  }
  return page;
}

function contains(value: string): Prisma.StringFilter {
  return { contains: value.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' };
}

function priceInCents(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > maxDatabaseInteger) {
    throw new BadRequestException('Enter a valid price in rand');
  }
  return value;
}

function listingData(input: ListingInput) {
  const category = input?.category;
  if (!isEnumValue(ServiceCategory, category)) throw new BadRequestException('Choose a service category');
  const priceUnit = input?.priceUnit;
  if (!isEnumValue(PriceUnit, priceUnit)) throw new BadRequestException('Choose a price unit');
  const priceCents = priceInCents(input?.priceCents);
  const maxPriceCents = input?.maxPriceCents == null ? null : priceInCents(input.maxPriceCents);
  if (maxPriceCents !== null && maxPriceCents < priceCents) {
    throw new BadRequestException('Maximum price must be at least the starting price');
  }

  return {
    title: requiredText(input?.title, 'a title', 120),
    description: optionalText(input?.description, 'a description', 2000),
    location: requiredText(input?.location, 'a service area', 150),
    category,
    priceCents,
    maxPriceCents,
    priceUnit,
  };
}

@Injectable()
export class ServicesService {
  constructor(private readonly db: PrismaService, private readonly storage: ObjectStorageService) {}

  async search(query: Record<string, unknown>, excludeProviderId?: string) {
    const search = optionalText(query.search, 'a search term', 120);
    const location = optionalText(query.location, 'a service area', 150);
    const page = getPage(query.page);
    const sort = query.sort ?? 'newest';
    if (sort !== 'newest' && sort !== 'price_asc' && sort !== 'price_desc' && sort !== 'rating' && sort !== 'verified') {
      throw new BadRequestException('Choose a valid service sort order');
    }
    const category = query.category;
    if (category !== undefined && !isEnumValue(ServiceCategory, category)) {
      throw new BadRequestException('Choose a valid category');
    }

    const where: Prisma.ServiceListingWhereInput = { isPublished: true };
    if (excludeProviderId) where.providerId = { not: excludeProviderId };
    if (isEnumValue(ServiceCategory, category)) where.category = category;
    if (location) where.location = contains(location);
    if (search) {
      const filter = contains(search);
      where.OR = [{ title: filter }, { description: filter }, { provider: { businessName: filter } }];
    }
    const total = await this.db.serviceListing.count({ where });
    let ids: string[] | undefined;
    if (sort === 'rating') {
      const matches = await this.db.serviceListing.findMany({ where, select: { id: true } });
      ids = matches.map(item => item.id);
      if (ids.length) {
        const ratings = await this.db.$queryRaw<{ listingId: string; averageRating: number; reviewCount: bigint }[]>`
          SELECT b."listingId" AS "listingId", AVG(r."rating")::float AS "averageRating", COUNT(r."id") AS "reviewCount"
          FROM "Review" r INNER JOIN "Booking" b ON b."id" = r."bookingId"
          WHERE b."listingId" IN (${Prisma.join(ids)})
          GROUP BY b."listingId"
        `;
        const ratingById = new Map(ratings.map(row => [row.listingId, { average: row.averageRating, count: Number(row.reviewCount) }]));
        ids.sort((a, b) => (ratingById.get(b)?.count ?? 0) - (ratingById.get(a)?.count ?? 0) || (ratingById.get(b)?.average ?? 0) - (ratingById.get(a)?.average ?? 0) || a.localeCompare(b));
      }
    }
    const orderBy = sort === 'price_asc' ? [{ priceCents: 'asc' }, ...newestFirst] as Prisma.ServiceListingOrderByWithRelationInput[]
      : sort === 'price_desc' ? [{ priceCents: 'desc' }, ...newestFirst] as Prisma.ServiceListingOrderByWithRelationInput[]
      : sort === 'verified' ? [{ provider: { verificationTier: 'desc' } }, ...newestFirst] as Prisma.ServiceListingOrderByWithRelationInput[]
      : newestFirst;
    const skip = (page - 1) * pageSize;
    const records = sort === 'rating'
      ? await this.db.serviceListing.findMany({ where: { ...where, id: { in: (ids ?? []).slice(skip, skip + pageSize) } }, select: listingFields })
      : await this.db.serviceListing.findMany({ where, orderBy, skip, take: pageSize, select: listingFields });
    const ordered = sort === 'rating' ? [...records].sort((a, b) => (ids ?? []).indexOf(a.id) - (ids ?? []).indexOf(b.id)) : records;
    const formatted = ordered.map(formatListing);
    if (ordered.length) {
      const pageIds = ordered.map(item => item.id);
      const ratings = await this.db.$queryRaw<{ listingId: string; averageRating: number; reviewCount: bigint }[]>`
        SELECT b."listingId" AS "listingId", AVG(r."rating")::float AS "averageRating", COUNT(r."id") AS "reviewCount"
        FROM "Review" r INNER JOIN "Booking" b ON b."id" = r."bookingId"
        WHERE b."listingId" IN (${Prisma.join(pageIds)}) GROUP BY b."listingId"
      `;
      const ratingById = new Map(ratings.map(row => [row.listingId, { average: row.averageRating, count: Number(row.reviewCount) }]));
      for (const listing of formatted) {
        const rating = ratingById.get(listing.id);
        (listing as typeof listing & { averageRating: number | null }).averageRating = rating?.average ?? null;
        listing.reviewCount = rating?.count ?? 0;
      }
    }
    return { listings: formatted, total, pageSize };
  }

  async listForProvider(providerId: string) {
    const records = await this.db.serviceListing.findMany({ where: { providerId }, orderBy: newestFirst, select: listingFields });
    return records.map(formatListing);
  }

  async detail(id: string, excludeProviderId?: string) {
    const record = await this.db.serviceListing.findFirst({ where: { id, isPublished: true, ...(excludeProviderId ? { providerId: { not: excludeProviderId } } : {}) }, select: listingFields });
    if (!record) throw new NotFoundException('Service listing not found');
    return formatListing(record);
  }

  async create(providerId: string, input: ListingInput) {
    const data = listingData(input);
    const photos = this.photoInput(input, []);
    const stored = await this.storePhotos(photos.add);
    try {
      const record = await this.db.serviceListing.create({ data: { ...data, description: data.description ?? '', providerId, photos: { create: stored } }, select: listingFields });
      return formatListing(record);
    } catch (error) {
      await this.storage.deleteMany(stored.map(photo => photo.storageKey)).catch(() => undefined);
      throw error;
    }
  }

  async update(providerId: string, id: string, input: ListingInput) {
    const data = listingData(input);
    const listing = await this.db.serviceListing.findFirst({ where: { id, providerId }, select: { photos: { select: { id: true, storageKey: true } } } });
    if (!listing) throw new NotFoundException('Listing not found');
    const photos = this.photoInput(input, listing.photos.map(photo => photo.id));
    const stored = await this.storePhotos(photos.add);
    try {
      const record = await this.db.$transaction(async tx => {
        const current = await tx.serviceListing.findFirst({ where: { id, providerId }, select: { photos: { select: { id: true } } } });
        if (!current) throw new NotFoundException('Listing not found');
        this.photoInput(input, current.photos.map(photo => photo.id));
        return tx.serviceListing.update({ where: { id, providerId }, data: { ...data, photos: { deleteMany: { id: { notIn: photos.keep } }, create: stored } }, select: listingFields });
      });
      const removedKeys = listing.photos.filter(photo => !photos.keep.includes(photo.id)).map(photo => photo.storageKey);
      await this.storage.deleteMany(removedKeys).catch(error => console.warn('Could not remove replaced listing files from object storage.', error));
      return formatListing(record);
    } catch (error) {
      await this.storage.deleteMany(stored.map(photo => photo.storageKey)).catch(() => undefined);
      throw error;
    }
  }

  private photoInput(input: ListingInput, existing: string[]) {
    const keep = input?.keepPhotoIds === undefined ? existing : input.keepPhotoIds;
    const values = input?.newPhotos === undefined ? [] : input.newPhotos;
    if (!Array.isArray(keep) || !keep.every(id => typeof id === 'string' && existing.includes(id)) || new Set(keep).size !== keep.length || !Array.isArray(values) || keep.length + values.length > 20) throw new BadRequestException('Choose up to 20 valid listing photos');
    return { keep: keep as string[], add: values.map(imageData) };
  }

  private async storePhotos(photos: Array<{ mimeType: string; image: Buffer }>) {
    const stored: Array<{ mimeType: string; image: Buffer | null; storageKey: string | null }> = [];
    try {
      for (const photo of photos) {
        const file = await this.storage.store('listing', photo.mimeType, photo.image);
        stored.push({ mimeType: photo.mimeType, image: file.legacyData, storageKey: file.storageKey });
      }
    } catch (error) {
      await this.storage.deleteMany(stored.map(photo => photo.storageKey)).catch(() => undefined);
      throw error;
    }
    return stored;
  }

  async photo(id: string, viewerId?: string) {
    const photo = await this.db.listingPhoto.findFirst({ where: { id, OR: [{ listing: { isPublished: true } }, ...(viewerId ? [{ listing: { providerId: viewerId } }] : [])] }, select: { image: true, storageKey: true, mimeType: true } });
    if (!photo) throw new NotFoundException('Photo not found');
    return { mimeType: photo.mimeType, image: await this.storage.read(photo.storageKey, photo.image, 'Photo') };
  }

  setPublication(providerId: string, id: string, isPublished: unknown) {
    if (typeof isPublished !== 'boolean') throw new BadRequestException('Choose a publication status');
    return this.updateOwnedListing(providerId, id, { isPublished });
  }

  private async updateOwnedListing(providerId: string, id: string, data: Prisma.ServiceListingUpdateInput) {
    try {
      const record = await this.db.serviceListing.update({ where: { id, providerId }, data, select: listingFields });
      return formatListing(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Listing not found');
      }
      throw error;
    }
  }
}
