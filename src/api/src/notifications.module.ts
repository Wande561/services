import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { MailModule } from './mail.module';
import { NotificationsService } from './notifications.service';

@Module({ imports: [DatabaseModule, MailModule], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
