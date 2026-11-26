import { Body, Controller, ForbiddenException, Get, Header, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ReliabilityService } from './reliability.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('reliability')
export class ReliabilityController {
  constructor(private readonly auth: AuthService, private readonly reliability: ReliabilityService) {}
  @Get('mine') @Header('Cache-Control', 'private, no-store') async mine(@Req() req: Request) { const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.mine(a.id); }
  @Get('cases') @Header('Cache-Control', 'private, no-store') async cases(@Req() req: Request, @Query('page') page: unknown) { const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.cases(a.id, page); }
  @Get('ledger') @Header('Cache-Control', 'private, no-store') async ledger(@Req() req: Request, @Query('page') page: unknown) { const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.ledger(a.id, page); }
  @Get('unread') @Header('Cache-Control', 'private, no-store') async unread(@Req() req: Request) { const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.unread(a.id); }
  @Patch('alerts/read-all') async read(@Req() req: Request) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.markAlerts(a.id); }
  @Post('cases/:id/dispute') async dispute(@Req() req: Request, @Param('id') id: string, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.dispute(a.id, id, body); }
  @Post('bookings/:id/report') async report(@Req() req: Request, @Param('id') id: string, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.report(a.id, a.role, id, body); }
  @Post('bookings/:id/late') async late(@Req() req: Request, @Param('id') id: string, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.notifyLate(a.id, a.role, id, body); }
  @Post('bookings/:id/continue') async continue(@Req() req: Request, @Param('id') id: string) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.continueBooking(a.id, a.role, id); }
  @Get('bookings/:id/reschedules') async reschedules(@Req() req: Request, @Param('id') id: string) { const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.reschedules(a.id, a.role, id); }
  @Post('bookings/:id/reschedules') async propose(@Req() req: Request, @Param('id') id: string, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.propose(a.id, a.role, id, body); }
  @Post('bookings/:id/reschedules/:proposal/respond') async respond(@Req() req: Request, @Param('id') id: string, @Param('proposal') proposal: string, @Body('action') action: unknown) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.reliability.respondReschedule(a.id, a.role, id, proposal, action); }
}
@Controller('admin/reliability')
export class ReliabilityAdminController {
  constructor(private readonly auth: AuthService, private readonly reliability: ReliabilityService) {}
  private async admin(req: Request) { const user = await this.auth.currentUser(req.cookies?.session); if (!user.isVerificationAdmin) throw new ForbiddenException('Administrator access required'); return user; }
  @Get() @Header('Cache-Control', 'private, no-store') async queue(@Req() req: Request, @Query('filter') filter: unknown, @Query('page') page: unknown) { await this.admin(req); return this.reliability.queue(filter, page); }
  @Get(':id/messages') @Header('Cache-Control', 'private, no-store') async messages(@Req() req: Request, @Param('id') id: string, @Query('page') page: unknown) { await this.admin(req); return this.reliability.reviewMessages(id, page); }
  @Post(':id/decision') async decide(@Req() req: Request, @Param('id') id: string, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const admin = await this.admin(req); return this.reliability.decide(admin.id, id, body); }
}
