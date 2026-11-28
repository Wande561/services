import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkspaceMemberStatus, WorkspaceRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { MailService } from './mail.service';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';
import { formatListing, listingFields } from './services.service';
import { effectivePermissions, hasPermission, parsePermissionOverrides, type WorkspacePermission } from './workspace-permissions';

const memberSelect = {
  id: true, workspaceId: true, userId: true, email: true, name: true, role: true, status: true,
  permissions: true, workingHours: true, inviteExpiresAt: true, invitedAt: true, joinedAt: true,
  deactivatedAt: true, createdAt: true, updatedAt: true,
  services: { select: { listingId: true } },
} satisfies Prisma.WorkspaceMemberSelect;

const assignmentSelect = {
  id: true, memberId: true, assignedAt: true,
  member: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.WorkspaceBookingAssignmentSelect;

const workspaceBookingSelect = {
  id: true, serviceTitle: true, status: true, address: true, notes: true, priceCents: true, createdAt: true, updatedAt: true,
  slot: { select: { startsAt: true, endsAt: true } },
  client: { select: { phone: true, user: { select: { name: true } } } },
  listing: { select: { id: true, title: true } },
  workspaceAssignments: { where: { unassignedAt: null }, select: assignmentSelect },
} satisfies Prisma.BookingSelect;

const activitySelect = { id: true, kind: true, message: true, createdAt: true, actor: { select: { name: true } } } satisfies Prisma.WorkspaceActivitySelect;

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
  return requiredText(value, label, maxLength);
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new BadRequestException('Enter a valid email address');
  }
  return value.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'workspace';
}

function sastDayStart(value = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  return new Date(`${day}T00:00:00+02:00`);
}

function roleValue(value: unknown, allowOwner = false): WorkspaceRole {
  if (typeof value !== 'string' || !Object.values(WorkspaceRole).includes(value as WorkspaceRole) || (!allowOwner && value === WorkspaceRole.Owner)) {
    throw new BadRequestException('Choose a valid team role');
  }
  return value as WorkspaceRole;
}

function memberView(member: Prisma.WorkspaceMemberGetPayload<{ select: typeof memberSelect }>) {
  const { services, ...rest } = member;
  return { ...rest, serviceIds: services.map(service => service.listingId), effectivePermissions: [...effectivePermissions(member.role, member.permissions)] };
}

@Injectable()
export class WorkspacesService {
  constructor(private readonly db: PrismaService, private readonly mail: MailService = new MailService()) {}

  async access(workspaceId: string, userId: string, permission?: WorkspacePermission) {
    const workspace = await this.db.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const member = await this.db.workspaceMember.findFirst({ where: { workspaceId, userId, status: WorkspaceMemberStatus.Active } });
    if (!member) throw new ForbiddenException('You do not have access to this workspace');
    if (permission && !hasPermission(member.role, member.permissions, permission)) {
      throw new ForbiddenException('Your workspace role cannot perform this action');
    }
    return { workspace, member };
  }

  permissions(member: { role: WorkspaceRole; permissions: Prisma.JsonValue | null }) {
    return [...effectivePermissions(member.role, member.permissions)];
  }

  async activity(tx: Prisma.TransactionClient | PrismaService, workspaceId: string, actorId: string, kind: string, message: string, metadata?: Prisma.InputJsonValue) {
    await tx.workspaceActivity.create({ data: { workspaceId, actorId, kind, message, ...(metadata ? { metadata } : {}) } });
  }

  async list(userId: string) {
    const memberships = await this.db.workspaceMember.findMany({
      where: { userId, status: WorkspaceMemberStatus.Active },
      orderBy: [{ workspace: { createdAt: 'asc' } }, { createdAt: 'asc' }],
      select: {
        role: true, workspaceId: true,
        workspace: {
          select: {
            id: true, name: true, slug: true, description: true, publicDescription: true, location: true, isPublished: true, createdAt: true,
            _count: { select: { members: { where: { status: WorkspaceMemberStatus.Active } } } },
          },
        },
      },
    });
    return memberships.map(({ role, workspace }) => ({
      id: workspace.id, name: workspace.name, slug: workspace.slug, description: workspace.description, publicDescription: workspace.publicDescription, location: workspace.location,
      isPublished: workspace.isPublished, createdAt: workspace.createdAt, memberCount: workspace._count.members, role, isOwner: role === WorkspaceRole.Owner,
    }));
  }

  private async uniqueSlug(base: string) {
    let slug = base;
    let suffix = 2;
    while (await this.db.workspace.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
    return slug;
  }

  async create(owner: { id: string; email: string; name: string | null }, input: Record<string, unknown> | undefined) {
    const name = requiredText(input?.name, 'a workspace name', 120);
    const description = optionalText(input?.description, 'a workspace description', 500);
    const location = optionalText(input?.location, 'a workspace location', 150);
    const attachExisting = input?.attachExisting !== false;

    const slug = await this.uniqueSlug(slugify(name));
    const workspace = await this.db.$transaction(async tx => {
      const created = await tx.workspace.create({ data: { ownerId: owner.id, name, slug, description, location } });
      await tx.workspaceMember.create({
        data: {
          workspaceId: created.id, userId: owner.id, email: owner.email, name: owner.name,
          role: WorkspaceRole.Owner, status: WorkspaceMemberStatus.Active, joinedAt: new Date(),
        },
      });
      if (attachExisting) {
        await tx.serviceListing.updateMany({ where: { providerId: owner.id, workspaceId: null }, data: { workspaceId: created.id } });
        await tx.quoteRequest.updateMany({ where: { providerId: owner.id, workspaceId: null }, data: { workspaceId: created.id } });
        await tx.booking.updateMany({ where: { workspaceId: null, listing: { providerId: owner.id } }, data: { workspaceId: created.id } });
      }
      await this.activity(tx, created.id, owner.id, 'workspace.created', `${owner.name || owner.email} created the workspace`);
      return created;
    });
    return this.summary(workspace.id, owner.id);
  }

  async summary(workspaceId: string, userId: string) {
    const { workspace, member } = await this.access(workspaceId, userId, 'bookings.view');
    const canTeamView = hasPermission(member.role, member.permissions, 'team.view');
    const canViewAllBookings = hasPermission(member.role, member.permissions, 'bookings.view.all');
    const canViewAllTasks = hasPermission(member.role, member.permissions, 'tasks.view.all');
    const now = new Date();
    const todayStart = sastDayStart(now);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit' }).format(now)}-01T00:00:00+02:00`);

    const [todayBookings, pendingRequests, upcomingBookings, activeMembers, completedThisMonth, openTasks, upcoming, team, activity, listings] = await Promise.all([
      this.db.booking.count({ where: { workspaceId, status: { in: ['Pending', 'Confirmed'] }, slot: { startsAt: { gte: todayStart, lt: todayEnd } } } }),
      this.db.quoteRequest.count({ where: { workspaceId, status: { in: ['Pending', 'RevisionRequested'] } } }),
      this.db.booking.count({ where: { workspaceId, status: 'Confirmed', slot: { startsAt: { gte: now } } } }),
      this.db.workspaceMember.count({ where: { workspaceId, status: WorkspaceMemberStatus.Active } }),
      this.db.booking.count({ where: { workspaceId, status: 'Completed', updatedAt: { gte: monthStart } } }),
      this.db.workspaceTask.count({ where: { workspaceId, status: { not: 'Completed' }, ...(canViewAllTasks ? {} : { assigneeId: member.id }) } }),
      this.db.booking.findMany({
        where: {
          workspaceId, status: { in: ['Pending', 'Confirmed'] }, slot: { startsAt: { gte: now } },
          ...(canViewAllBookings ? {} : { workspaceAssignments: { some: { memberId: member.id, unassignedAt: null } } }),
        },
        orderBy: [{ slot: { startsAt: 'asc' } }], take: 8, select: workspaceBookingSelect,
      }),
      this.db.workspaceMember.findMany({
        where: { workspaceId, status: { in: [WorkspaceMemberStatus.Active, WorkspaceMemberStatus.Invited] } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }], select: memberSelect,
      }),
      this.db.workspaceActivity.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 10, select: activitySelect }),
      this.db.serviceListing.findMany({ where: { workspaceId }, orderBy: { title: 'asc' }, select: { id: true, title: true, isPublished: true } }),
    ]);

    return {
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, description: workspace.description, publicDescription: workspace.publicDescription, location: workspace.location, isPublished: workspace.isPublished, logoKey: workspace.logoKey, createdAt: workspace.createdAt, ownerId: workspace.ownerId },
      access: { role: member.role, permissions: this.permissions(member), memberId: member.id, userId: member.userId, name: member.name, email: member.email },
      metrics: { todayBookings, pendingRequests, upcomingBookings, activeMembers, completedThisMonth, openTasks },
      upcoming,
      team: canTeamView ? team.map(memberView) : [],
      activity: canTeamView || canViewAllBookings ? activity : [],
      listings,
    };
  }

  async publicProfile(workspaceId: string, userId: string) {
    const workspace = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true, name: true, slug: true, description: true, publicDescription: true, location: true,
        logoKey: true, isPublished: true, createdAt: true,
        owner: { select: { name: true, profile: { select: { businessName: true, verificationTier: true } } } },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const viewerMember = await this.db.workspaceMember.findFirst({ where: { workspaceId, userId, status: WorkspaceMemberStatus.Active }, select: { role: true } });
    if (!workspace.isPublished && !viewerMember) throw new NotFoundException('Workspace not found');
    const [listings, team, reviewSummary, reviewItems, completedBookings] = await Promise.all([
      this.db.serviceListing.findMany({ where: { workspaceId, isPublished: true }, orderBy: { createdAt: 'desc' }, select: listingFields }),
      this.db.workspaceMember.findMany({ where: { workspaceId, status: WorkspaceMemberStatus.Active }, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }], select: { name: true, role: true } }),
      this.db.review.aggregate({ where: { booking: { workspaceId } }, _avg: { rating: true }, _count: { _all: true } }),
      this.db.review.findMany({ where: { booking: { workspaceId } }, orderBy: { createdAt: 'desc' }, take: 6, select: { rating: true, comment: true, createdAt: true, booking: { select: { client: { select: { user: { select: { name: true } } } } } } } }),
      this.db.booking.count({ where: { workspaceId, status: 'Completed' } }),
    ]);
    const formatted = listings.map(formatListing);
    const ids = listings.map(listing => listing.id);
    if (ids.length) {
      const ratings = await this.db.$queryRaw<{ listingId: string; averageRating: number; reviewCount: bigint }[]>`
        SELECT b."listingId" AS "listingId", AVG(r."rating")::float AS "averageRating", COUNT(r."id") AS "reviewCount"
        FROM "Review" r INNER JOIN "Booking" b ON b."id" = r."bookingId"
        WHERE b."listingId" IN (${Prisma.join(ids)}) GROUP BY b."listingId"
      `;
      const byId = new Map(ratings.map(row => [row.listingId, row]));
      for (const listing of formatted) {
        const rating = byId.get(listing.id);
        (listing as typeof listing & { averageRating: number | null }).averageRating = rating?.averageRating ?? null;
        listing.reviewCount = rating ? Number(rating.reviewCount) : 0;
      }
    }
    return {
      workspace: {
        id: workspace.id, name: workspace.name, slug: workspace.slug, description: workspace.description,
        publicDescription: workspace.publicDescription, location: workspace.location, logoKey: workspace.logoKey,
        isPublished: workspace.isPublished, createdAt: workspace.createdAt,
        ownerName: workspace.owner.profile?.businessName || workspace.owner.name || 'Provider',
        verificationTier: workspace.owner.profile?.verificationTier ?? 'Basic',
      },
      listings: formatted,
      team: team.map(member => ({ name: member.name, role: member.role })),
      reviews: {
        averageRating: reviewSummary._avg.rating ?? null,
        count: reviewSummary._count._all,
        items: reviewItems.map(review => ({
          rating: review.rating, comment: review.comment, createdAt: review.createdAt,
          clientName: review.booking.client.user.name || 'Client',
        })),
      },
      stats: { completedBookings, activeMembers: team.length, listingCount: formatted.length },
      viewerRole: viewerMember?.role ?? null,
    };
  }

  async update(workspaceId: string, userId: string, input: Record<string, unknown> | undefined) {
    const { workspace } = await this.access(workspaceId, userId, 'workspace.manage');
    const data: Prisma.WorkspaceUpdateInput = {};
    if (input?.name !== undefined) data.name = requiredText(input.name, 'a workspace name', 120);
    if (input?.description !== undefined) data.description = optionalText(input.description, 'a workspace description', 500);
    if (input?.publicDescription !== undefined) data.publicDescription = optionalText(input.publicDescription, 'a public description', 3000);
    if (input?.location !== undefined) data.location = optionalText(input.location, 'a workspace location', 150);
    if (input?.isPublished !== undefined) {
      if (typeof input.isPublished !== 'boolean') throw new BadRequestException('Choose a valid publishing option');
      data.isPublished = input.isPublished;
      if (input.isPublished) data.publishedAt = new Date();
    }
    if (!Object.keys(data).length) throw new BadRequestException('Choose something to update');
    const updated = await this.db.workspace.update({ where: { id: workspace.id }, data });
    await this.activity(this.db, workspaceId, userId, 'workspace.updated', 'Workspace details were updated');
    return { id: updated.id, name: updated.name, slug: updated.slug, description: updated.description, publicDescription: updated.publicDescription, location: updated.location, isPublished: updated.isPublished };
  }

  async members(workspaceId: string, userId: string) {
    await this.access(workspaceId, userId, 'team.view');
    const members = await this.db.workspaceMember.findMany({
      where: { workspaceId }, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }], select: memberSelect,
    });
    return members.map(memberView);
  }

  async invite(workspaceId: string, actorId: string, input: Record<string, unknown> | undefined) {
    const { workspace, member: actor } = await this.access(workspaceId, actorId, 'team.manage');
    const email = normalizeEmail(input?.email);
    const name = optionalText(input?.name, 'a team member name', 100);
    const role = roleValue(input?.role ?? WorkspaceRole.Staff);
    if (actor.role === WorkspaceRole.Manager && role === WorkspaceRole.Manager) throw new ForbiddenException('Only the owner can invite another manager');
    const overrides = parsePermissionOverrides(input?.permissions);
    const now = new Date();
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const existing = await this.db.workspaceMember.findUnique({ where: { workspaceId_email: { workspaceId, email } } });
    if (existing?.status === WorkspaceMemberStatus.Active) throw new ConflictException('This person is already an active team member');
    if (existing?.role === WorkspaceRole.Owner) throw new ConflictException('The workspace owner is already on the team');

    const member = existing
      ? await this.db.workspaceMember.update({
        where: { id: existing.id },
        data: {
          name, role, permissions: overrides ? overrides as Prisma.InputJsonValue : Prisma.DbNull,
          status: WorkspaceMemberStatus.Invited, inviteTokenHash: tokenHash, inviteExpiresAt: expiresAt,
          invitedAt: now, deactivatedAt: null,
        },
        select: memberSelect,
      })
      : await this.db.workspaceMember.create({
        data: {
          workspaceId, email, name, role, status: WorkspaceMemberStatus.Invited,
          permissions: overrides ? overrides as Prisma.InputJsonValue : undefined,
          inviteTokenHash: tokenHash, inviteExpiresAt: expiresAt,
        },
        select: memberSelect,
      });

    const inviteUrl = new URL('/workspace/accept', process.env.FRONTEND_URL || 'http://localhost:3000');
    inviteUrl.hash = new URLSearchParams({ token: rawToken }).toString();
    const emailSent = await this.mail.send({
      to: email,
      subject: `You're invited to ${workspace.name} on ServiceConnect`,
      text: `Hi ${name || 'there'},\n\n${actor.name || 'The workspace owner'} invited you to join ${workspace.name} on ServiceConnect as ${role}.\n\nAccept the invitation: ${inviteUrl}\n\nSign in or create an account with ${email}. This invitation expires in seven days.\n\nIf you were not expecting this, you can ignore the email.`,
    });
    await this.activity(this.db, workspaceId, actorId, 'member.invited', `${name || email} was invited as ${role}`);
    return { member: memberView(member), inviteUrl: inviteUrl.toString(), emailSent };
  }

  async acceptInvitation(user: { id: string; email: string }, token: unknown) {
    if (typeof token !== 'string' || token.length < 30 || token.length > 200) throw new BadRequestException('This invitation link is invalid or has expired');
    const member = await this.db.workspaceMember.findFirst({
      where: { inviteTokenHash: hashToken(token), status: WorkspaceMemberStatus.Invited },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (!member || !member.inviteExpiresAt || member.inviteExpiresAt <= new Date()) throw new BadRequestException('This invitation link is invalid or has expired');
    if (member.email.toLowerCase() !== user.email.toLowerCase()) throw new ForbiddenException(`Sign in with ${member.email} to accept this invitation`);
    await this.db.workspaceMember.update({
      where: { id: member.id },
      data: { userId: user.id, status: WorkspaceMemberStatus.Active, joinedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null, deactivatedAt: null },
    });
    await this.activity(this.db, member.workspaceId, user.id, 'member.joined', `${member.name || member.email} joined the workspace`);
    return { workspaceId: member.workspaceId, workspaceName: member.workspace.name };
  }

  async updateMember(workspaceId: string, actorId: string, memberId: string, input: Record<string, unknown> | undefined) {
    const { member: actor } = await this.access(workspaceId, actorId, 'team.manage');
    const target = await this.db.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!target) throw new NotFoundException('Team member not found');
    if (target.role === WorkspaceRole.Owner) throw new ForbiddenException('The workspace owner cannot be changed here');
    if (actor.role === WorkspaceRole.Manager && (target.role === WorkspaceRole.Manager || input?.role === WorkspaceRole.Manager)) throw new ForbiddenException('Only the owner can manage managers');
    if (input?.role !== undefined && actor.role !== WorkspaceRole.Owner) throw new ForbiddenException('Only the owner can change roles');

    const data: Prisma.WorkspaceMemberUpdateInput = {};
    if (input?.name !== undefined) data.name = optionalText(input.name, 'a team member name', 100);
    if (input?.role !== undefined) data.role = roleValue(input.role);
    if (input?.permissions !== undefined) {
      const overrides = parsePermissionOverrides(input.permissions);
      data.permissions = overrides ? overrides as Prisma.InputJsonValue : Prisma.DbNull;
    }
    if (input?.workingHours !== undefined) data.workingHours = input.workingHours === null ? Prisma.DbNull : input.workingHours as Prisma.InputJsonValue;
    if (input?.status !== undefined) {
      if (input.status !== WorkspaceMemberStatus.Active && input.status !== WorkspaceMemberStatus.Inactive) throw new BadRequestException('Choose a valid member status');
      data.status = input.status;
      if (input.status === WorkspaceMemberStatus.Inactive) data.deactivatedAt = new Date();
      else { data.deactivatedAt = null; data.joinedAt = target.joinedAt ?? new Date(); }
    }
    if (input?.serviceIds !== undefined) {
      if (!Array.isArray(input.serviceIds) || input.serviceIds.some(id => typeof id !== 'string')) throw new BadRequestException('Choose valid services');
      const listingIds = [...new Set(input.serviceIds as string[])];
      const listings = await this.db.serviceListing.findMany({ where: { id: { in: listingIds }, workspaceId }, select: { id: true } });
      if (listings.length !== listingIds.length) throw new BadRequestException('One of those services does not belong to this workspace');
      data.services = { deleteMany: {}, create: listingIds.map(listingId => ({ listingId })) };
    }
    const updated = await this.db.workspaceMember.update({ where: { id: target.id }, data, select: memberSelect });
    await this.activity(this.db, workspaceId, actorId, 'member.updated', `${target.name || target.email} was updated`);
    return memberView(updated);
  }

  async deactivateMember(workspaceId: string, actorId: string, memberId: string) {
    const { member: actor } = await this.access(workspaceId, actorId, 'team.manage');
    const target = await this.db.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });
    if (!target) throw new NotFoundException('Team member not found');
    if (target.role === WorkspaceRole.Owner) throw new ForbiddenException('The workspace owner cannot be removed');
    if (actor.role === WorkspaceRole.Manager && target.role === WorkspaceRole.Manager) throw new ForbiddenException('Only the owner can manage managers');
    await this.db.workspaceMember.update({ where: { id: target.id }, data: { status: WorkspaceMemberStatus.Inactive, deactivatedAt: new Date() } });
    await this.activity(this.db, workspaceId, actorId, 'member.deactivated', `${target.name || target.email} was deactivated`);
    return { success: true };
  }

  async bookings(workspaceId: string, userId: string, query: Record<string, unknown>) {
    const { member } = await this.access(workspaceId, userId, 'bookings.view');
    const where: Prisma.BookingWhereInput = { workspaceId };
    if (query.status !== undefined) {
      if (!['Pending', 'Confirmed', 'Declined', 'Cancelled', 'Completed'].includes(String(query.status))) throw new BadRequestException('Choose a valid booking status');
      where.status = query.status as 'Pending' | 'Confirmed' | 'Declined' | 'Cancelled' | 'Completed';
    }
    if (query.memberId !== undefined) {
      where.workspaceAssignments = { some: { memberId: String(query.memberId), unassignedAt: null } };
    }
    if (query.from !== undefined || query.to !== undefined) {
      where.slot = {
        ...(query.from !== undefined ? { startsAt: { gte: new Date(String(query.from)) } } : {}),
        ...(query.to !== undefined ? { endsAt: { lte: new Date(String(query.to)) } } : {}),
      };
    }
    if (!hasPermission(member.role, member.permissions, 'bookings.view.all')) {
      where.workspaceAssignments = { some: { memberId: member.id, unassignedAt: null } };
    }
    const records = await this.db.booking.findMany({
      where, orderBy: [{ slot: { startsAt: 'asc' } }], take: 50, select: workspaceBookingSelect,
    });
    return records;
  }

  async assign(workspaceId: string, actorId: string, bookingId: string, input: Record<string, unknown> | undefined) {
    await this.access(workspaceId, actorId, 'bookings.assign');
    if (!Array.isArray(input?.memberIds) || input.memberIds.some(id => typeof id !== 'string')) throw new BadRequestException('Choose team members to assign');
    const memberIds = [...new Set(input.memberIds as string[])];
    const booking = await this.db.booking.findFirst({ where: { id: bookingId }, select: { id: true, workspaceId: true, listing: { select: { workspaceId: true } } } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.workspaceId !== workspaceId) {
      if (booking.listing.workspaceId !== workspaceId) throw new NotFoundException('Booking not found in this workspace');
      await this.db.booking.update({ where: { id: booking.id }, data: { workspaceId } });
    }
    const members = await this.db.workspaceMember.findMany({
      where: { workspaceId, id: { in: memberIds }, status: WorkspaceMemberStatus.Active },
      select: { id: true, name: true, email: true },
    });
    if (members.length !== memberIds.length) throw new BadRequestException('Choose active team members from this workspace');

    await this.db.$transaction(async tx => {
      const current = await tx.workspaceBookingAssignment.findMany({ where: { bookingId, workspaceId, unassignedAt: null }, select: { id: true, memberId: true } });
      const unassign = current.filter(item => !memberIds.includes(item.memberId));
      if (unassign.length) await tx.workspaceBookingAssignment.updateMany({ where: { id: { in: unassign.map(item => item.id) } }, data: { unassignedAt: new Date() } });
      const activeIds = new Set(current.map(item => item.memberId));
      const additions = members.filter(member => !activeIds.has(member.id));
      if (additions.length) await tx.workspaceBookingAssignment.createMany({ data: additions.map(member => ({ workspaceId, bookingId, memberId: member.id, assignedById: actorId })) });
      await this.activity(tx, workspaceId, actorId, 'booking.assigned',
        additions.length ? `Booking assigned to ${additions.map(member => member.name || member.email).join(', ')}` : 'Booking assignments updated');
    });
    return this.db.workspaceBookingAssignment.findMany({ where: { bookingId, workspaceId, unassignedAt: null }, select: assignmentSelect });
  }
}
