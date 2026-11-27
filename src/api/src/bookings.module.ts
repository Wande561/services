import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { BookingsService } from './bookings.service';

@Module({ imports: [DatabaseModule], providers: [BookingsService], exports: [BookingsService] })
export class BookingsModule {}
