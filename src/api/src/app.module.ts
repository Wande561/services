import { Module } from '@nestjs/common';
import { ReliabilityController, ReliabilityAdminController } from './reliability.controller';
import { ReliabilityService } from './reliability.service';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { AdminController, ComplaintsController } from './admin.controller';
import { AdminService } from './admin.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from './prisma.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  controllers: [ReliabilityController, ReliabilityAdminController, DiscoveryController, ProvidersController, AdminController, ComplaintsController, VerificationController, QuotesController, AuthController, ServicesController, BookingsController, MessagesController, NotificationsController, ReviewsController],
  providers: [ReliabilityService, DiscoveryService, ProvidersService, AdminService, VerificationService, QuotesService, AuthService, PrismaService, ServicesService, BookingsService, MessagesService, NotificationsService, ReviewsService, PaymentsService],
})
export class AppModule {}
