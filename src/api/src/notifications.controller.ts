import { Body, Controller, Get, Header, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { NotificationsService } from './notifications.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly auth: AuthService, private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: Request, @Query('before') before: unknown) {
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.notifications.list(account.id, before);
  }

  @Get('unread')
  @Header('Cache-Control', 'private, no-store')
  async unread(@Req() req: Request) {
    const { id, role } = await this.auth.requireProfile(req.cookies?.session);
    return this.notifications.unread(id, role);
  }

  @Get('preferences')
  @Header('Cache-Control', 'private, no-store')
  async preferences(@Req() req: Request) {
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.notifications.getPreferences(account.id);
  }

  @Patch('preferences')
  async updatePreferences(@Req() req: Request, @Body() body: Record<string, unknown>) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.notifications.updatePreferences(account.id, body);
  }

  @Patch('read-all')
  async readAll(@Req() req: Request) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.notifications.markAllRead(account.id);
  }

  @Patch(':id/read')
  async read(@Req() req: Request, @Param('id') id: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.notifications.markRead(account.id, id);
  }
}
