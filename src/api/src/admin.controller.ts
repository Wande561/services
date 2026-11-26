import { Body, Controller, ForbiddenException, Get, Header, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AdminService } from './admin.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('admin')
export class AdminController {
  constructor(private readonly auth: AuthService, private readonly admin: AdminService) {}
  private async authorize(req: Request) { const user = await this.auth.currentUser(req.cookies?.session); if (!user.isVerificationAdmin) throw new ForbiddenException('Administrator access required'); return user; }
  @Get('overview') @Header('Cache-Control', 'private, no-store') async overview(@Req() req: Request) { await this.authorize(req); return this.admin.overview(); }
  @Get('accounts') @Header('Cache-Control', 'private, no-store') async accounts(@Req() req: Request, @Query('page') page: unknown) { await this.authorize(req); return this.admin.accounts(page); }
  @Get('bookings') @Header('Cache-Control', 'private, no-store') async bookings(@Req() req: Request, @Query('page') page: unknown) { await this.authorize(req); return this.admin.bookings(page); }
  @Get('quotes') @Header('Cache-Control', 'private, no-store') async quotes(@Req() req: Request, @Query('page') page: unknown) { await this.authorize(req); return this.admin.quotes(page); }
  @Get('complaints') @Header('Cache-Control', 'private, no-store') async complaints(@Req() req: Request, @Query('page') page: unknown) { await this.authorize(req); return this.admin.complaints(page); }
  @Patch('accounts/:id') async changeAccount(@Req() req: Request, @Param('id') id: string, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const a = await this.authorize(req); return this.admin.changeAccount(a.id, id, body); }
  @Patch('complaints/:id') async updateComplaint(@Req() req: Request, @Param('id') id: string, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const a = await this.authorize(req); return this.admin.updateComplaint(a.id, id, body); }
}
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly auth: AuthService, private readonly admin: AdminService) {}
  @Get() @Header('Cache-Control', 'private, no-store') async mine(@Req() req: Request) { const a = await this.auth.requireProfile(req.cookies?.session); return this.admin.myComplaints(a.id); }
  @Post() async create(@Req() req: Request, @Body() body: any) { checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.admin.submitComplaint(a.id, body); }
}
