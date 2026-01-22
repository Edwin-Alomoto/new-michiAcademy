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
  // Debug: Mostrar información de DATABASE_URL (sin mostrar credenciales completas)
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@'); // Ocultar contraseña
    console.log(`DATABASE_URL configurada: ${maskedUrl}`);
  } else {
    console.error('ERROR: DATABASE_URL no está configurada');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: true, credentials: true });
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
