import { Body, Controller, Get, Header, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
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
  @Header('Cache-Control', 'private, no-store')
  async search(@Query() query: Record<string, unknown>, @Req() req: Request) {
    return this.services.search(query, await this.clientViewer(req));
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
  @Header('Cache-Control', 'private, no-store')
  async detail(@Param('id') id: string, @Req() req: Request) {
    return this.services.detail(id, await this.clientViewer(req));
  }

  private async clientViewer(req: Request) {
    if (!req.cookies?.session) return undefined;
    try { const account = await this.auth.currentUser(req.cookies.session); return account.profile?.role === 'client' ? account.id : undefined; }
    catch { return undefined; }
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
