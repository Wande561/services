import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseModule } from './database.module';
import { MailModule } from './mail.module';

@Module({ imports: [DatabaseModule, MailModule], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
