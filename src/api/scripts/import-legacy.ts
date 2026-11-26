import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AccountRole, BookingStatus, PriceUnit, Prisma, PrismaClient, ServiceCategory } from '@prisma/client';

const historicalStatuses = [BookingStatus.Completed, BookingStatus.Cancelled, BookingStatus.Declined];

class ImportError extends Error {}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ImportError(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function rows(value: unknown, label: string, fields: string[]) {
  if (!Array.isArray(value)) throw new ImportError(`${label} must be an array`);
  return value.map((entry, index) => {
    const rowLabel = `${label} row ${index + 1}`;
    const row = object(entry, rowLabel);
    if (Object.keys(row).some(key => !fields.includes(key))) throw new ImportError(`Unsupported field in ${rowLabel}`);
    return row;
  });
}

function text(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ImportError(`Invalid ${label}`);
  return value.trim();
}

function member<T extends string>(value: unknown, options: T[], label: string): T {
  const found = options.find(option => option === value);
  if (!found) throw new ImportError(`Invalid ${label}`);
  return found;
}

function principal(value: unknown) {
  const id = text(value, 'legacy principal', 100);
  if (!/^[a-z2-7]+(?:-[a-z2-7]+)+$/.test(id) || id === '2vxsx-fae' || id === 'aaaaa-aa') {
    throw new ImportError('Invalid or anonymous legacy principal');
  }
  return id;
}

function price(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new ImportError('Prices must be integer rand cents');
  }
  return value;
}

function instant(value: unknown, label: string) {
  const iso = text(value, label, 24);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(iso)) {
    throw new ImportError(`${label} must be a UTC timestamp`);
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== iso.slice(0, 19)) {
    throw new ImportError(`Invalid ${label}`);
  }
  return date;
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new ImportError(`Duplicate ${label} in the export`);
}

function parseExport(value: unknown) {
  const data = object(value, 'export');
  if (data.version !== 1) throw new ImportError('The legacy export must use version 1');
  if (Object.keys(data).some(key => !['version', 'source', 'identities', 'listings', 'bookings'].includes(key))) {
    throw new ImportError('The export contains an unsupported record type');
  }
  const source = text(data.source, 'source', 160);
  if (!/^icp:[a-z0-9-]+:[a-z2-7-]+$/.test(source)) {
    throw new ImportError('Source must identify the old ICP network and canister as icp:network:canister');
  }
  const identities = rows(data.identities, 'Identities', ['principal', 'userId', 'role']).map(row => ({
    source,
    principal: principal(row.principal),
    userId: text(row.userId, 'target account ID', 128),
    role: member(row.role, Object.values(AccountRole), 'account role'),
  }));

  const listings = rows(data.listings, 'Listings', [
    'id', 'provider', 'title', 'description', 'category', 'location', 'priceCents', 'maxPriceCents', 'priceUnit', 'createdAt',
  ]).map(row => {
    const priceCents = price(row.priceCents);
    const maxPriceCents = row.maxPriceCents == null ? null : price(row.maxPriceCents);
    if (maxPriceCents !== null && maxPriceCents < priceCents) throw new ImportError('A listing has an invalid price range');
    return {
      legacyId: text(row.id, 'legacy listing ID', 128),
      provider: principal(row.provider),
      title: text(row.title, 'listing title', 120),
      description: text(row.description, 'listing description', 2000),
      category: member(row.category, Object.values(ServiceCategory), 'listing category'),
      location: text(row.location, 'listing location', 150),
      priceCents,
      maxPriceCents,
      priceUnit: member(row.priceUnit, Object.values(PriceUnit), 'price unit'),
      createdAt: instant(row.createdAt, 'listing creation time'),
    };
  });

  const bookings = rows(data.bookings, 'Bookings', [
    'id', 'listing', 'client', 'provider', 'serviceTitle', 'address', 'notes', 'startsAt', 'endsAt', 'status', 'createdAt',
  ]).map(row => {
    const startsAt = instant(row.startsAt, 'booking start time');
    const endsAt = instant(row.endsAt, 'booking end time');
    const status = member(row.status, historicalStatuses, 'historical booking status');
    if (endsAt <= startsAt || (status === 'Completed' && endsAt > new Date())) throw new ImportError('Invalid historical booking interval');
    return {
      legacyId: text(row.id, 'legacy booking ID', 128),
      listing: text(row.listing, 'legacy booking listing ID', 128),
      client: principal(row.client),
      provider: principal(row.provider),
      serviceTitle: text(row.serviceTitle, 'booked service title', 120),
      address: text(row.address, 'service address', 300),
      notes: row.notes == null ? null : text(row.notes, 'booking notes', 1000),
      startsAt,
      endsAt,
      status,
      createdAt: instant(row.createdAt, 'booking creation time'),
    };
  });
  assertUnique(identities.map(row => row.principal), 'legacy principal');
  assertUnique(identities.map(row => row.userId), 'target account');
  assertUnique(listings.map(row => row.legacyId), 'listing ID');
  assertUnique(bookings.map(row => row.legacyId), 'booking ID');
  return { source, identities, listings, bookings };
}

function destinationId(source: string, kind: 'listing' | 'booking' | 'slot', id: string) {
  return 'legacy_' + createHash('sha256').update(JSON.stringify([source, kind, id])).digest('hex');
}

async function migrate(db: Prisma.TransactionClient, data: ReturnType<typeof parseExport>, apply: boolean) {
  const { source, identities } = data;
  const profiles = await db.profile.findMany({
    where: { userId: { in: identities.map(identity => identity.userId) } },
    select: { userId: true, role: true },
  });
  const roles = new Map(profiles.map(profile => [profile.userId, profile.role]));
  const existingLinks = await db.legacyIdentity.findMany({
    where: { source, OR: [
      { principal: { in: identities.map(identity => identity.principal) } },
      { userId: { in: identities.map(identity => identity.userId) } },
    ] },
  });
  const byPrincipal = new Map(existingLinks.map(link => [link.principal, link.userId]));
  const byUser = new Map(existingLinks.map(link => [link.userId, link.principal]));

  const newLinks = identities.filter(identity => {
    if (roles.get(identity.userId) !== identity.role) {
      throw new ImportError('A target account is missing its completed profile or has a different role');
    }
    const knownUser = byPrincipal.get(identity.principal);
    const knownPrincipal = byUser.get(identity.userId);
    if ((knownUser && knownUser !== identity.userId) || (knownPrincipal && knownPrincipal !== identity.principal)) {
      throw new ImportError('An identity mapping conflicts with an earlier import');
    }
    return !knownUser;
  }).map(({ role: _role, ...identity }) => identity);
  const approved = new Map(identities.map(identity => [identity.principal, identity]));
  function accountId(legacyPrincipal: string, role: AccountRole) {
    const identity = approved.get(legacyPrincipal);
    if (identity?.role !== role) throw new ImportError(`An approved ${role} mapping is missing`);
    return identity.userId;
  }

  const listings = data.listings.map(({ provider, legacyId, ...listing }) => ({
    ...listing,
    legacyId,
    providerId: accountId(provider, 'provider'),
    id: destinationId(source, 'listing', legacyId),
    isPublished: false,
  }));
  const listingsByLegacyId = new Map(listings.map(listing => [listing.legacyId, listing]));
  const savedListings = await db.serviceListing.findMany({
    where: { id: { in: listings.map(listing => listing.id) } },
    select: { id: true, providerId: true },
  });
  const listingOwners = new Map(savedListings.map(listing => [listing.id, listing.providerId]));
  const newListings = listings.filter(listing => {
    const owner = listingOwners.get(listing.id);
    if (owner && owner !== listing.providerId) throw new ImportError('A listing conflicts with an earlier import');
    return !owner;
  }).map(({ legacyId: _legacyId, ...listing }) => listing);

  const bookings = data.bookings.map(({ legacyId, listing, client, provider, startsAt, endsAt, ...record }) => {
    const service = listingsByLegacyId.get(listing);
    const providerId = accountId(provider, 'provider');
    if (!service || service.providerId !== providerId) throw new ImportError('A booking does not match its listing and provider');
    const slot = { id: destinationId(source, 'slot', legacyId), providerId, startsAt, endsAt, isOpen: false };
    const booking = {
      ...record,
      id: destinationId(source, 'booking', legacyId),
      listingId: service.id,
      clientId: accountId(client, 'client'),
      slotId: slot.id,
    };
    return { slot, booking };
  });
  const savedBookings = await db.booking.findMany({
    where: { id: { in: bookings.map(({ booking }) => booking.id) } },
    select: { id: true, listingId: true, clientId: true, slotId: true },
  });
  const bookingsById = new Map(savedBookings.map(booking => [booking.id, booking]));
  const newBookings = bookings.filter(({ booking }) => {
    const saved = bookingsById.get(booking.id);
    if (saved && (saved.slotId !== booking.slotId || saved.clientId !== booking.clientId || saved.listingId !== booking.listingId)) {
      throw new ImportError('A booking conflicts with an earlier import');
    }
    return !saved;
  });

  if (apply) {
    if (newLinks.length) await db.legacyIdentity.createMany({ data: newLinks });
    if (newListings.length) await db.serviceListing.createMany({ data: newListings });
    if (newBookings.length) {
      await db.availabilitySlot.createMany({ data: newBookings.map(({ slot }) => slot) });
      await db.booking.createMany({ data: newBookings.map(({ booking }) => booking) });
    }
  }
  return {
    mode: apply ? 'apply' : 'dry-run',
    new: { identities: newLinks.length, listings: newListings.length, bookings: newBookings.length },
    existing: {
      identities: identities.length - newLinks.length,
      listings: listings.length - newListings.length,
      bookings: bookings.length - newBookings.length,
    },
  };
}

async function main() {
  const [file, mode, ...extra] = process.argv.slice(2);
  if (!file || file.startsWith('-') || (mode && mode !== '--apply') || extra.length > 0) {
    throw new ImportError('Usage: npm run legacy:import -- <export.json> [--apply]');
  }
  let input: unknown;
  try {
    input = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new ImportError('Could not read a valid JSON export');
  }
  const data = parseExport(input);
  const db = new PrismaClient();
  try {
    const result = await db.$transaction(tx => migrate(tx, data, mode === '--apply'), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    });
    console.log(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => {
  const message = error instanceof ImportError ? error.message
    : error instanceof Prisma.PrismaClientKnownRequestError ? `Import stopped with database error ${error.code}`
    : 'Import could not connect to the database or complete';
  console.error(message);
  process.exitCode = 1;
});
