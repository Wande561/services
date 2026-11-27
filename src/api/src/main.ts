import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';
import { assertSecureFrontendOrigin } from './production-config';

async function bootstrap() {
  assertSecureFrontendOrigin();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Listing edits can include up to twenty 1 MB photos encoded as JSON.
  app.use('/services', json({ limit: '30mb' }));
  app.use(json({ limit: '5mb' }));
  app.use(cookieParser());
  app.enableCors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true });
  await app.listen(Number(process.env.PORT || 3001));
}

void bootstrap();
