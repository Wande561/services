import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { checkFrontendOrigin } from './request-validation';
import { WorkspaceFinanceService } from './workspace-finance.service';
import { WorkspaceOperationsService } from './workspace-operations.service';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly auth: AuthService,
    private readonly workspaces: WorkspacesService,
    private readonly operations: WorkspaceOperationsService,
    private readonly finance: WorkspaceFinanceService,
  ) {}

  private token(req: Request) {
    return req.cookies?.session as string | undefined;
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: Request) {
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.list(account.id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    if (!account.profile?.providerEnabled) throw new ForbiddenException('A provider profile is required');
    return this.workspaces.create(account, body as Record<string, unknown>);
  }

  @Post('invitations/accept')
  async acceptInvitation(@Req() req: Request, @Body() body: any) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.acceptInvitation(account, body?.token);
  }

  @Get(':id/public')
  @Header('Cache-Control', 'private, max-age=30')
  async publicProfile(@Req() req: Request, @Param('id') id: string) {
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.publicProfile(id, account.id);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  async summary(@Req() req: Request, @Param('id') id: string) {
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.summary(id, account.id);
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.update(id, account.id, body as Record<string, unknown>);
  }

  @Get(':id/members')
  @Header('Cache-Control', 'private, no-store')
  async members(@Req() req: Request, @Param('id') id: string) {
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.members(id, account.id);
  }

  @Post(':id/invitations')
  async invite(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.invite(id, account.id, body as Record<string, unknown>);
  }

  @Patch(':id/members/:memberId')
  async updateMember(@Req() req: Request, @Param('id') id: string, @Param('memberId') memberId: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.updateMember(id, account.id, memberId, body as Record<string, unknown>);
  }

  @Delete(':id/members/:memberId')
  async deactivateMember(@Req() req: Request, @Param('id') id: string, @Param('memberId') memberId: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.deactivateMember(id, account.id, memberId);
  }

  @Get(':id/bookings')
  @Header('Cache-Control', 'private, no-store')
  async bookings(@Req() req: Request, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.bookings(id, account.id, query);
  }

  @Post(':id/bookings/:bookingId/assign')
  async assign(@Req() req: Request, @Param('id') id: string, @Param('bookingId') bookingId: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.workspaces.assign(id, account.id, bookingId, body as Record<string, unknown>);
  }

  @Get(':id/tasks')
  @Header('Cache-Control', 'private, no-store')
  async tasks(@Req() req: Request, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.tasks(id, account.id, query);
  }

  @Post(':id/tasks')
  async createTask(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.createTask(id, account.id, body as Record<string, unknown>);
  }

  @Patch(':id/tasks/:taskId')
  async updateTask(@Req() req: Request, @Param('id') id: string, @Param('taskId') taskId: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.updateTask(id, account.id, taskId, body as Record<string, unknown>);
  }

  @Delete(':id/tasks/:taskId')
  async deleteTask(@Req() req: Request, @Param('id') id: string, @Param('taskId') taskId: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.deleteTask(id, account.id, taskId);
  }

  @Get(':id/bookings/:bookingId/notes')
  @Header('Cache-Control', 'private, no-store')
  async notes(@Req() req: Request, @Param('id') id: string, @Param('bookingId') bookingId: string) {
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.notes(id, account.id, bookingId);
  }

  @Post(':id/bookings/:bookingId/notes')
  async addNote(@Req() req: Request, @Param('id') id: string, @Param('bookingId') bookingId: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.addNote(id, account.id, bookingId, body as Record<string, unknown>);
  }

  @Get(':id/announcements')
  @Header('Cache-Control', 'private, no-store')
  async announcements(@Req() req: Request, @Param('id') id: string) {
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.announcements(id, account.id);
  }

  @Post(':id/announcements')
  async createAnnouncement(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.createAnnouncement(id, account.id, body as Record<string, unknown>);
  }

  @Delete(':id/announcements/:announcementId')
  async deleteAnnouncement(@Req() req: Request, @Param('id') id: string, @Param('announcementId') announcementId: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.deleteAnnouncement(id, account.id, announcementId);
  }

  @Get(':id/messages')
  @Header('Cache-Control', 'private, no-store')
  async messages(@Req() req: Request, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.messages(id, account.id, query);
  }

  @Post(':id/messages')
  async sendMessage(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.sendMessage(id, account.id, body as Record<string, unknown>);
  }

  @Get(':id/notifications')
  @Header('Cache-Control', 'private, no-store')
  async workspaceNotifications(@Req() req: Request, @Param('id') id: string) {
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.notifications(id, account.id);
  }

  @Patch(':id/notifications/read-all')
  async readAllNotifications(@Req() req: Request, @Param('id') id: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.readAllNotifications(id, account.id);
  }

  @Patch(':id/notifications/:notificationId/read')
  async readNotification(@Req() req: Request, @Param('id') id: string, @Param('notificationId') notificationId: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.currentUser(this.token(req));
    return this.operations.readNotification(id, account.id, notificationId);
  }

  @Get(':id/finance')
  @Header('Cache-Control', 'private, no-store')
  async financeSummary(@Req() req: Request, @Param('id') id: string) {
    const account = await this.auth.currentUser(this.token(req));
    return this.finance.finance(id, account.id);
  }

  @Get(':id/analytics')
  @Header('Cache-Control', 'private, no-store')
  async analytics(@Req() req: Request, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    const account = await this.auth.currentUser(this.token(req));
    return this.finance.analytics(id, account.id, query.days);
  }
}
