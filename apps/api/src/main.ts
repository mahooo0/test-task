import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

// BigInt safety net: Item.sizeBytes is BigInt; JSON.stringify throws on BigInt otherwise.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');
  // CORS_ORIGIN is a comma-separated allowlist (e.g. local web + deployed web).
  const corsOrigins = (config.get<string>('CORS_ORIGIN') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // `X-Locale` carries the caller's UI locale so the API can localize error messages.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Locale'],
  });
  app.enableShutdownHooks();

  await app.listen(config.get<number>('PORT') ?? 3000);
}

void bootstrap();
