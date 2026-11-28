import { Module } from '@nestjs/common';
import { ReliabilityController, ReliabilityAdminController } from './reliability.controller';
import { ReliabilityService } from './reliability.service';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { ProvidersController } from './providers.controller';
import { AdminController, ComplaintsController } from './admin.controller';
import { AdminService } from './admin.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { QuotesController } from './quotes.controller';
import { AuthController } from './auth.controller';
import { BookingsController } from './bookings.controller';
import { MessagesController } from './messages.controller';
import { NotificationsController } from './notifications.controller';
import { PaymentsService } from './payments.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { PresenceController } from './presence.controller';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth.module';
import { DatabaseModule } from './database.module';
import { ObjectStorageModule } from './object-storage.module';
import { BookingsModule } from './bookings.module';
import { QuotesModule } from './quotes.module';
import { MessagesModule } from './messages.module';
import { NotificationsModule } from './notifications.module';
import { ProvidersModule } from './providers.module';
import { WorkspacesModule } from './workspaces.module';

@Module({
  imports: [DatabaseModule, ObjectStorageModule, BookingsModule, QuotesModule, MessagesModule, NotificationsModule, ProvidersModule, AuthModule, AiModule, WorkspacesModule],
  controllers: [PresenceController, ReliabilityController, ReliabilityAdminController, DiscoveryController, ProvidersController, AdminController, ComplaintsController, VerificationController, QuotesController, AuthController, ServicesController, BookingsController, MessagesController, NotificationsController, ReviewsController],
  providers: [ReliabilityService, DiscoveryService, AdminService, VerificationService, ServicesService, ReviewsService, PaymentsService],
})
export class AppModule {}
