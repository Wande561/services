import { Body, Controller, Delete, ForbiddenException, Get, Header, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { checkFrontendOrigin } from './request-validation';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly auth: AuthService, private readonly workspaces: WorkspacesService) {}

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
}
