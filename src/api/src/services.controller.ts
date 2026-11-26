import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { assertCanBook } from './reliability.service';
import { PrismaService } from './prisma.service';
import { AuthService } from './auth.service';
import { checkFrontendOrigin } from './request-validation';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly auth: AuthService, private readonly services: ServicesService, private readonly db: PrismaService) {}

  @Get()
  search(@Query() query: Record<string, unknown>) {
    return this.services.search(query);
  }

  @Get('mine')
  async mine(@Req() req: Request) {
    return this.services.listForProvider(await this.providerId(req));
  }

  @Get('photos/:id')
  async photo(@Req() req: Request, @Res() res: Response, @Param('id') id: string) {
    let viewerId: string | undefined;
    if (req.cookies?.session) { try { viewerId = (await this.auth.currentUser(req.cookies.session)).id; } catch { /* Published photos are public. */ } }
    const photo = await this.services.photo(id, viewerId);
    res.set({ 'Content-Type': photo.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }).send(photo.image);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.services.detail(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    checkFrontendOrigin(req.get('origin'));
    return this.services.create(await this.providerId(req, true), body);
  }

  @Put(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    checkFrontendOrigin(req.get('origin'));
    return this.services.update(await this.providerId(req, true), id, body);
  }

  @Patch(':id/publication')
  async publication(@Req() req: Request, @Param('id') id: string, @Body('isPublished') isPublished: unknown) {
    checkFrontendOrigin(req.get('origin'));
    return this.services.setPublication(await this.providerId(req, isPublished === true), id, isPublished);
  }

  private async providerId(req: Request, requireActive = false) {
    const account = await this.auth.requireProfile(req.cookies?.session, 'provider');
    if (requireActive) await assertCanBook(this.db, [account.id]);
    return account.id;
  }
}
