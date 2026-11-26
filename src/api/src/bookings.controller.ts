import { Body, Controller, Get, Header, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { BookingsService } from './bookings.service';
import { PaymentsService } from './payments.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly auth: AuthService,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: Request) {
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.bookings.list(account.id, account.role);
  }

  @Post(':id/confirm-completion')
  async confirmCompletion(@Req() req: Request, @Param('id') id: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.bookings.confirmCompletion(account.id, account.role, id);
  }

  @Patch(':id/status')
  async changeStatus(@Req() req: Request, @Param('id') id: string, @Body() body: { status?: unknown; emergency?: unknown; reason?: unknown }) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session);
    return this.bookings.changeStatus(account.id, account.role, id, body?.status, body);
  }

  @Post(':id/payment')
  async recordPayment(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session, 'provider');
    return this.payments.record(account.id, id, body);
  }

  @Patch(':id/payment/:paymentId/void')
  async voidPayment(@Req() req: Request, @Param('id') id: string, @Param('paymentId') paymentId: string) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session, 'provider');
    return this.payments.void(account.id, id, paymentId);
  }
}
