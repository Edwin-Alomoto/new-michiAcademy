import * as dotenv from 'dotenv';
// Solo cargar .env en desarrollo, en producción usar variables de entorno del sistema
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  // Verificar que DATABASE_URL esté configurada en producción
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL no está configurada en producción');
    process.exit(1);
  }
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: true, credentials: true });
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
