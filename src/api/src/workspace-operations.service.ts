import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkspaceMemberStatus, WorkspaceNotificationKind, WorkspaceRole, WorkspaceTaskPriority, WorkspaceTaskStatus } from '@prisma/client';
import { requiredText } from './request-validation';
import { hasPermission, type WorkspacePermission } from './workspace-permissions';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from './prisma.service';

const taskSelect = {
  id: true, title: true, description: true, status: true, priority: true, dueAt: true, completedAt: true, createdAt: true, updatedAt: true,
  assignee: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  booking: { select: { id: true, serviceTitle: true } },
} satisfies Prisma.WorkspaceTaskSelect;

const noteSelect = {
  id: true, body: true, createdAt: true,
  author: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WorkspaceBookingNoteSelect;

const messageSelect = {
  id: true, body: true, recipientId: true, createdAt: true,
  author: { select: { id: true, name: true, email: true } },
  recipient: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WorkspaceMessageSelect;

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
  return requiredText(value, label, maxLength);
}

function optionalDate(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`Choose a valid ${label}`);
  return date;
}

function taskStatus(value: unknown): WorkspaceTaskStatus {
  if (typeof value !== 'string' || !Object.values(WorkspaceTaskStatus).includes(value as WorkspaceTaskStatus)) throw new BadRequestException('Choose a valid task status');
  return value as WorkspaceTaskStatus;
}

function taskPriority(value: unknown): WorkspaceTaskPriority {
  if (typeof value !== 'string' || !Object.values(WorkspaceTaskPriority).includes(value as WorkspaceTaskPriority)) throw new BadRequestException('Choose a valid task priority');
  return value as WorkspaceTaskPriority;
}

@Injectable()
export class WorkspaceOperationsService {
  constructor(private readonly db: PrismaService, private readonly workspaces: WorkspacesService) {}

  private can(actor: { role: WorkspaceRole; permissions: Prisma.JsonValue | null }, permission: WorkspacePermission) {
    return hasPermission(actor.role, actor.permissions, permission);
  }

  private async notify(memberIds: string[], workspaceId: string, kind: WorkspaceNotificationKind, message: string, href: string) {
    const ids = [...new Set(memberIds.filter(Boolean))];
    if (!ids.length) return;
    await this.db.workspaceNotification.createMany({
      data: ids.map(memberId => ({ workspaceId, memberId, kind, message, href })),
    });
  }

  private async memberIdsForBooking(workspaceId: string, bookingId: string) {
    const assignments = await this.db.workspaceBookingAssignment.findMany({
      where: { workspaceId, bookingId, unassignedAt: null }, select: { memberId: true },
    });
    const managers = await this.db.workspaceMember.findMany({
      where: { workspaceId, status: WorkspaceMemberStatus.Active, role: { in: [WorkspaceRole.Owner, WorkspaceRole.Manager] } },
      select: { id: true },
    });
    return [...new Set([...assignments.map(item => item.memberId), ...managers.map(item => item.id)])];
  }

  async tasks(workspaceId: string, userId: string, query: Record<string, unknown>) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'tasks.view');
    const canSeeAll = this.can(member, 'tasks.view.all');
    const where: Prisma.WorkspaceTaskWhereInput = { workspaceId };
    if (!canSeeAll) where.assigneeId = member.id;
    else if (query.assigneeId !== undefined && query.assigneeId !== '') where.assigneeId = String(query.assigneeId);
    if (query.status !== undefined && query.status !== '') where.status = taskStatus(query.status);
    if (query.mine === '1') where.assigneeId = member.id;
    return this.db.workspaceTask.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: taskSelect,
    });
  }

  async createTask(workspaceId: string, userId: string, input: Record<string, unknown> | undefined) {
    const { member, workspace } = await this.workspaces.access(workspaceId, userId, 'tasks.manage');
    if (!this.can(member, 'tasks.view.all')) throw new ForbiddenException('Only managers can create tasks');
    const title = requiredText(input?.title, 'a task title', 160);
    const description = optionalText(input?.description, 'a task description', 2000);
    const priority = input?.priority === undefined ? WorkspaceTaskPriority.Normal : taskPriority(input.priority);
    const dueAt = optionalDate(input?.dueAt, 'due date');
    const assigneeId = input?.assigneeId === undefined || input.assigneeId === '' ? null : requiredText(input.assigneeId, 'a team member', 128);
    if (assigneeId) {
      const assignee = await this.db.workspaceMember.findFirst({ where: { id: assigneeId, workspaceId, status: WorkspaceMemberStatus.Active }, select: { id: true } });
      if (!assignee) throw new BadRequestException('Choose an active team member');
    }
    const bookingId = input?.bookingId === undefined || input.bookingId === '' ? null : requiredText(input.bookingId, 'a booking', 128);
    if (bookingId) {
      const booking = await this.db.booking.findFirst({ where: { id: bookingId, workspaceId }, select: { id: true } });
      if (!booking) throw new BadRequestException('Choose a booking from this workspace');
    }
    const task = await this.db.workspaceTask.create({
      data: { workspaceId, title, description, priority, dueAt, assigneeId, createdById: userId, bookingId },
      select: taskSelect,
    });
    if (assigneeId) await this.notify([assigneeId], workspaceId, WorkspaceNotificationKind.TaskAssigned, `New task assigned: ${title}`, `/workspace?workspace=${workspaceId}&tab=tasks`);
    await this.workspaces.activity(this.db, workspaceId, userId, 'task.created', `${workspace.name}: task “${title}” created`);
    return task;
  }

  async updateTask(workspaceId: string, userId: string, taskId: string, input: Record<string, unknown> | undefined) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'tasks.manage');
    const task = await this.db.workspaceTask.findFirst({ where: { id: taskId, workspaceId }, select: { id: true, assigneeId: true, title: true } });
    if (!task) throw new NotFoundException('Task not found');
    const canSeeAll = this.can(member, 'tasks.view.all');
    if (!canSeeAll && task.assigneeId !== member.id) throw new ForbiddenException('You can only update tasks assigned to you');
    const data: Prisma.WorkspaceTaskUpdateInput = {};
    if (input?.status !== undefined) {
      const status = taskStatus(input.status);
      data.status = status;
      data.completedAt = status === WorkspaceTaskStatus.Completed ? new Date() : null;
    }
    if (canSeeAll) {
      if (input?.title !== undefined) data.title = requiredText(input.title, 'a task title', 160);
      if (input?.description !== undefined) data.description = optionalText(input.description, 'a task description', 2000);
      if (input?.priority !== undefined) data.priority = taskPriority(input.priority);
      if (input?.dueAt !== undefined) data.dueAt = optionalDate(input.dueAt, 'due date');
      if (input?.assigneeId !== undefined) {
        if (input.assigneeId === '' || input.assigneeId === null) data.assignee = { disconnect: true };
        else {
          const assigneeId = requiredText(input.assigneeId, 'a team member', 128);
          const assignee = await this.db.workspaceMember.findFirst({ where: { id: assigneeId, workspaceId, status: WorkspaceMemberStatus.Active }, select: { id: true } });
          if (!assignee) throw new BadRequestException('Choose an active team member');
          data.assignee = { connect: { id: assigneeId } };
        }
      }
    }
    const updated = await this.db.workspaceTask.update({ where: { id: task.id }, data, select: taskSelect });
    if (canSeeAll && updated.assignee && updated.assignee.id !== task.assigneeId) {
      await this.notify([updated.assignee.id], workspaceId, WorkspaceNotificationKind.TaskAssigned, `Task assigned: ${updated.title}`, `/workspace?workspace=${workspaceId}&tab=tasks`);
    }
    await this.workspaces.activity(this.db, workspaceId, userId, 'task.updated', `Task “${updated.title}” updated`);
    return updated;
  }

  async deleteTask(workspaceId: string, userId: string, taskId: string) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'tasks.manage');
    if (!this.can(member, 'tasks.view.all')) throw new ForbiddenException('Only managers can delete tasks');
    const task = await this.db.workspaceTask.findFirst({ where: { id: taskId, workspaceId }, select: { id: true, title: true } });
    if (!task) throw new NotFoundException('Task not found');
    await this.db.workspaceTask.delete({ where: { id: task.id } });
    await this.workspaces.activity(this.db, workspaceId, userId, 'task.deleted', `Task “${task.title}” deleted`);
    return { success: true };
  }

  async notes(workspaceId: string, userId: string, bookingId: string) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'bookings.notes');
    const booking = await this.db.booking.findFirst({ where: { id: bookingId, workspaceId }, select: { id: true, workspaceAssignments: { where: { unassignedAt: null }, select: { memberId: true } } } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!this.can(member, 'bookings.view.all') && !booking.workspaceAssignments.some(item => item.memberId === member.id)) throw new ForbiddenException('You can only view notes for bookings assigned to you');
    return this.db.workspaceBookingNote.findMany({ where: { workspaceId, bookingId }, orderBy: { createdAt: 'asc' }, select: noteSelect });
  }

  async addNote(workspaceId: string, userId: string, bookingId: string, input: Record<string, unknown> | undefined) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'bookings.notes');
    const booking = await this.db.booking.findFirst({ where: { id: bookingId, workspaceId }, select: { id: true, serviceTitle: true, workspaceAssignments: { where: { unassignedAt: null }, select: { memberId: true } } } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!this.can(member, 'bookings.view.all') && !booking.workspaceAssignments.some(item => item.memberId === member.id)) throw new ForbiddenException('You can only add notes to bookings assigned to you');
    const body = requiredText(input?.body, 'a note', 2000);
    const note = await this.db.workspaceBookingNote.create({ data: { workspaceId, bookingId, authorId: userId, body }, select: noteSelect });
    const recipients = (await this.memberIdsForBooking(workspaceId, bookingId)).filter(id => id !== member.id);
    await this.notify(recipients, workspaceId, WorkspaceNotificationKind.BookingNote, `New internal note on ${booking.serviceTitle}`, `/workspace?workspace=${workspaceId}&tab=bookings`);
    await this.workspaces.activity(this.db, workspaceId, userId, 'booking.note', `Internal note added to ${booking.serviceTitle}`);
    return note;
  }

  async announcements(workspaceId: string, userId: string) {
    await this.workspaces.access(workspaceId, userId, 'chat.view');
    return this.db.workspaceAnnouncement.findMany({
      where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, title: true, body: true, createdAt: true, author: { select: { id: true, name: true, email: true } } },
    });
  }

  async createAnnouncement(workspaceId: string, userId: string, input: Record<string, unknown> | undefined) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'announcements.manage');
    const title = requiredText(input?.title, 'an announcement title', 160);
    const body = requiredText(input?.body, 'an announcement', 4000);
    const announcement = await this.db.workspaceAnnouncement.create({ data: { workspaceId, authorId: userId, title, body }, select: { id: true, title: true, body: true, createdAt: true, author: { select: { id: true, name: true, email: true } } } });
    const members = await this.db.workspaceMember.findMany({ where: { workspaceId, status: WorkspaceMemberStatus.Active, NOT: { id: member.id } }, select: { id: true } });
    await this.notify(members.map(item => item.id), workspaceId, WorkspaceNotificationKind.Announcement, `Announcement: ${title}`, `/workspace?workspace=${workspaceId}&tab=messages`);
    await this.workspaces.activity(this.db, workspaceId, userId, 'announcement.created', `Announcement “${title}” posted`);
    return announcement;
  }

  async deleteAnnouncement(workspaceId: string, userId: string, announcementId: string) {
    await this.workspaces.access(workspaceId, userId, 'announcements.manage');
    const announcement = await this.db.workspaceAnnouncement.findFirst({ where: { id: announcementId, workspaceId }, select: { id: true, title: true } });
    if (!announcement) throw new NotFoundException('Announcement not found');
    await this.db.workspaceAnnouncement.delete({ where: { id: announcement.id } });
    await this.workspaces.activity(this.db, workspaceId, userId, 'announcement.deleted', `Announcement “${announcement.title}” deleted`);
    return { success: true };
  }

  async messages(workspaceId: string, userId: string, query: Record<string, unknown>) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'chat.view');
    const withId = query.with === undefined || query.with === '' ? null : requiredText(query.with, 'a team member', 128);
    if (!withId) {
      return this.db.workspaceMessage.findMany({ where: { workspaceId, recipientId: null }, orderBy: { createdAt: 'asc' }, take: 200, select: messageSelect });
    }
    const target = await this.db.workspaceMember.findFirst({ where: { id: withId, workspaceId, status: WorkspaceMemberStatus.Active }, select: { id: true, userId: true } });
    if (!target?.userId) throw new NotFoundException('Team member not found');
    return this.db.workspaceMessage.findMany({
      where: {
        workspaceId,
        OR: [
          { authorId: userId, recipientId: target.id },
          { authorId: target.userId, recipientId: member.id },
        ],
      },
      orderBy: { createdAt: 'asc' }, take: 200, select: messageSelect,
    });
  }

  async sendMessage(workspaceId: string, userId: string, input: Record<string, unknown> | undefined) {
    const { member } = await this.workspaces.access(workspaceId, userId, 'chat.post');
    const body = requiredText(input?.body, 'a message', 2000);
    const to = input?.toMemberId === undefined || input.toMemberId === '' ? null : requiredText(input.toMemberId, 'a team member', 128);
    let recipientId: string | null = null;
    if (to) {
      const target = await this.db.workspaceMember.findFirst({ where: { id: to, workspaceId, status: WorkspaceMemberStatus.Active }, select: { id: true } });
      if (!target) throw new BadRequestException('Choose an active team member');
      recipientId = target.id;
    }
    const message = await this.db.workspaceMessage.create({ data: { workspaceId, authorId: userId, recipientId, body }, select: messageSelect });
    if (recipientId) await this.notify([recipientId], workspaceId, WorkspaceNotificationKind.DirectMessage, `New direct message from ${member.name || member.email}`, `/workspace?workspace=${workspaceId}&tab=messages`);
    if (!recipientId) await this.workspaces.activity(this.db, workspaceId, userId, 'message.posted', 'A message was posted in the team discussion');
    return message;
  }

  async notifications(workspaceId: string, userId: string) {
    const { member } = await this.workspaces.access(workspaceId, userId);
    const [items, unread] = await Promise.all([
      this.db.workspaceNotification.findMany({ where: { workspaceId, memberId: member.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.db.workspaceNotification.count({ where: { workspaceId, memberId: member.id, readAt: null } }),
    ]);
    return { unread, items };
  }

  async readNotification(workspaceId: string, userId: string, notificationId: string) {
    const { member } = await this.workspaces.access(workspaceId, userId);
    const updated = await this.db.workspaceNotification.updateMany({ where: { id: notificationId, workspaceId, memberId: member.id }, data: { readAt: new Date() } });
    if (!updated.count) throw new NotFoundException('Notification not found');
    return { success: true };
  }

  async readAllNotifications(workspaceId: string, userId: string) {
    const { member } = await this.workspaces.access(workspaceId, userId);
    await this.db.workspaceNotification.updateMany({ where: { workspaceId, memberId: member.id, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }
}
