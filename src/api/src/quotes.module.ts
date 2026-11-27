import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { ObjectStorageModule } from './object-storage.module';
import { QuotesService } from './quotes.service';

@Module({ imports: [DatabaseModule, ObjectStorageModule], providers: [QuotesService], exports: [QuotesService] })
export class QuotesModule {}
