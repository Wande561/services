import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { MessagesService } from './messages.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('messages')
export class MessagesController {
  constructor(private readonly auth: AuthService, private readonly messages: MessagesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async conversations(@Req() req: Request) {
    const { id, role } = await this.auth.requireProfile(req.cookies?.session);
    return this.messages.conversations(id, role);
  }

  @Get(':bookingId')
  @Header('Cache-Control', 'private, no-store')
  async thread(@Req() req: Request, @Param('bookingId') bookingId: string, @Query('before') before: unknown) {
    const { id, role } = await this.auth.requireProfile(req.cookies?.session);
    return this.messages.thread(id, role, bookingId, before);
  }

  @Post(':bookingId')
  async send(@Req() req: Request, @Param('bookingId') bookingId: string, @Body('body') body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const { id, role } = await this.auth.requireProfile(req.cookies?.session);
    return this.messages.send(id, role, bookingId, body);
  }

  @Patch(':bookingId/read')
  async markRead(@Req() req: Request, @Param('bookingId') bookingId: string, @Body('ids') ids: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const { id, role } = await this.auth.requireProfile(req.cookies?.session);
    return this.messages.markRead(id, role, bookingId, ids);
  }
}
