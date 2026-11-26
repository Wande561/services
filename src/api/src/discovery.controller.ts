import { Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { DiscoveryService } from './discovery.service';
import { checkFrontendOrigin } from './request-validation';
@Controller('client/discovery')
export class DiscoveryController {
  constructor(private readonly auth: AuthService, private readonly discovery: DiscoveryService) {}
  private async client(req: Request) { return (await this.auth.requireProfile(req.cookies?.session, 'client')).id; }
  @Get() async mine(@Req() req: Request) { return this.discovery.mine(await this.client(req)); }
  @Post('views/:id') async view(@Req() req: Request, @Param('id') id: string) { checkFrontendOrigin(req.get('origin')); return this.discovery.recordView(await this.client(req), id); }
  @Put('listings/:id') async saveListing(@Req() req: Request, @Param('id') id: string) { checkFrontendOrigin(req.get('origin')); return this.discovery.setListing(await this.client(req), id, true); }
  @Delete('listings/:id') async removeListing(@Req() req: Request, @Param('id') id: string) { checkFrontendOrigin(req.get('origin')); return this.discovery.setListing(await this.client(req), id, false); }
  @Put('providers/:id') async saveProvider(@Req() req: Request, @Param('id') id: string) { checkFrontendOrigin(req.get('origin')); return this.discovery.setProvider(await this.client(req), id, true); }
  @Delete('providers/:id') async removeProvider(@Req() req: Request, @Param('id') id: string) { checkFrontendOrigin(req.get('origin')); return this.discovery.setProvider(await this.client(req), id, false); }
}
