import { Body, Controller, Get, Header, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { QuotesService } from './quotes.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly auth: AuthService, private readonly quotes: QuotesService) {}
  @Get() @Header('Cache-Control', 'private, no-store') async list(@Req() req: Request) {
    const a = await this.auth.requireProfile(req.cookies?.session); return this.quotes.list(a.id, a.role);
  }
  @Get('alerts') @Header('Cache-Control', 'private, no-store') async alerts(@Req() req: Request) {
    const a = await this.auth.requireProfile(req.cookies?.session); return this.quotes.alerts(a.id);
  }
  @Patch('alerts/read-all') async readAll(@Req() req: Request) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.quotes.readAllAlerts(a.id);
  }
  @Patch('alerts/:id/read') async read(@Req() req: Request, @Param('id') id: string) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session); return this.quotes.readAlert(a.id, id);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store') async get(@Req() req: Request, @Param('id') id: string) {
    const a = await this.auth.requireProfile(req.cookies?.session); return this.quotes.get(a.id, a.role, id);
  }
  @Get(':id/photos/:photoId') async photo(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Param('photoId') photoId: string) {
    const a = await this.auth.requireProfile(req.cookies?.session); const photo = await this.quotes.photo(a.id, a.role, id, photoId);
    res.set({ 'Content-Type': photo.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }).send(photo.data);
  }
  @Post() async create(@Req() req: Request, @Body() body: any) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session, 'client'); return this.quotes.create(a.id, body);
  }
  @Post(':id/offer') async offer(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session, 'provider'); return this.quotes.offer(a.id, id, body);
  }
  @Post(':id/withdraw') async withdraw(@Req() req: Request, @Param('id') id: string) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session, 'client'); return this.quotes.withdraw(a.id, id);
  }
  @Post(':id/bank-details') async bankDetails(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session, 'provider'); return this.quotes.bankDetails(a.id, id, body);
  }
  @Post(':id/confirm-deposit') async confirmDeposit(@Req() req: Request, @Param('id') id: string) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session, 'provider'); return this.quotes.confirmDeposit(a.id, id);
  }
  @Post(':id/response') async respond(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    checkFrontendOrigin(req.get('origin')); const a = await this.auth.requireProfile(req.cookies?.session, 'client'); return this.quotes.respond(a.id, id, body);
  }
}
