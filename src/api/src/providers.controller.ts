import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ProvidersService } from './providers.service';
import { checkFrontendOrigin } from './request-validation';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly auth: AuthService, private readonly providers: ProvidersService) {}
  @Get('me/hours') async myHours(@Req() req: Request) { const user = await this.auth.requireProfile(req.cookies?.session, 'provider'); return this.providers.hours(user.id); }
  @Put('me/hours') async saveHours(@Req() req: Request, @Body('workingHours') hours: unknown) { checkFrontendOrigin(req.get('origin')); const user = await this.auth.requireProfile(req.cookies?.session, 'provider'); return this.providers.updateHours(user.id, hours); }
  @Get('me/insights') async insights(@Req() req: Request) { const user = await this.auth.requireProfile(req.cookies?.session, 'provider'); return this.providers.insights(user.id); }
  @Get(':id') profile(@Param('id') id: string) { return this.providers.publicProfile(id); }
}
