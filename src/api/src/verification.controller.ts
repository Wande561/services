import { Body, Controller, ForbiddenException, Get, Header, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { VerificationService } from './verification.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('verification')
export class VerificationController {
  constructor(private readonly auth: AuthService, private readonly service: VerificationService) {}
  private async reviewer(req: Request) {
    const account = await this.auth.currentUser(req.cookies?.session);
    if (!account.isVerificationAdmin) throw new ForbiddenException('Verification administrator access required');
    return account;
  }
  @Get('mine') @Header('Cache-Control', 'private, no-store') async mine(@Req() req: Request) {
    const user = await this.auth.requireProfile(req.cookies?.session); return this.service.mine(user.id);
  }
  @Post() async submit(@Req() req: Request, @Body() body: any) {
    checkFrontendOrigin(req.get('origin')); const user = await this.auth.requireProfile(req.cookies?.session); return this.service.submit(user.id, user.role, body);
  }
  @Get('admin/submissions') @Header('Cache-Control', 'private, no-store') async queue(@Req() req: Request) {
    await this.reviewer(req); return this.service.queue();
  }
  @Get('admin/submissions/:id/documents/:documentId') async file(@Req() req: Request, @Res() res: Response, @Param('id') id: string, @Param('documentId') documentId: string) {
    await this.reviewer(req); const file = await this.service.readDocument(id, documentId);
    res.set({ 'Content-Type': file.mimeType, 'Content-Disposition': 'attachment', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }).send(file.data);
  }
  @Post('admin/submissions/:id/decision') async decide(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    checkFrontendOrigin(req.get('origin')); const reviewer = await this.reviewer(req); return this.service.decide(reviewer.id, id, body);
  }
}
