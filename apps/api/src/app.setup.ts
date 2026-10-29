import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './core/config/env.js';
import { HttpExceptionFilter } from './core/http/http-exception.filter.js';
import { originCheck } from './core/http/origin-check.js';

/** Shared by main.ts and the e2e tests so both run the exact same HTTP setup. */
export function configureApp<T extends INestApplication>(app: T): T {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' }); // -> /api/v1/...
  app.use(helmet());
  app.use(cookieParser());
  const webOrigin = config.get('WEB_ORIGIN', { infer: true });
  app.enableCors({ origin: webOrigin, credentials: true });
  app.use(originCheck(webOrigin));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  return app;
}
