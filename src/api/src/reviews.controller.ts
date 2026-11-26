import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { checkFrontendOrigin } from './request-validation';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly auth: AuthService, private readonly reviews: ReviewsService) {}

  @Get('services/:listingId')
  listing(@Param('listingId') listingId: string, @Query('before') before: unknown) {
    return this.reviews.listing(listingId, before);
  }

  @Get('mine')
  @Header('Cache-Control', 'private, no-store')
  async provider(@Req() req: Request) {
    const account = await this.auth.requireProfile(req.cookies?.session);
    return account.role === 'provider' ? this.reviews.provider(account.id) : this.reviews.client(account.id);
  }

  @Post(':bookingId/client')
  async leaveClientReview(@Req() req: Request, @Param('bookingId') bookingId: string, @Body() body: Record<string, unknown>) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session, 'provider');
    return this.reviews.leaveClientReview(account.id, bookingId, body);
  }

  @Post(':bookingId')
  async leave(@Req() req: Request, @Param('bookingId') bookingId: string, @Body() body: Record<string, unknown>) {
    checkFrontendOrigin(req.get('origin'));
    const account = await this.auth.requireProfile(req.cookies?.session, 'client');
    return this.reviews.leave(account.id, bookingId, body);
  }
}
