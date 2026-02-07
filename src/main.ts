import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Request, Response, NextFunction } from 'express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './infrastructure/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // O‘zimiz katta limit bilan qo‘shamiz
  });
  // GeoJSON / katta fayllar uchun body limitini oshirish (default ~100kb)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  const helmetOptions = {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  };
  // Xarita iframe uchun — X-Frame-Options hech qachon yuborilmasin (frontend iframe ichida ochiladi)
  const stripXFrameOptions = (res: Response) => {
    res.removeHeader('X-Frame-Options');
    const origSet = res.setHeader.bind(res);
    res.setHeader = function (name: string, value: number | string | string[]) {
      if (String(name).toLowerCase() === 'x-frame-options') return res;
      return origSet(name, value);
    };
    const origWriteHead = (res as any).writeHead.bind(res);
    (res as any).writeHead = function (this: Response, ...args: any[]) {
      res.removeHeader('X-Frame-Options');
      const headersArg = typeof args[1] === 'object' && args[1] !== null ? 1 : typeof args[2] === 'object' && args[2] !== null ? 2 : -1;
      if (headersArg >= 0 && args[headersArg]) {
        const h = { ...args[headersArg] };
        Object.keys(h).forEach((k) => {
          if (k.toLowerCase() === 'x-frame-options') delete h[k];
        });
        args[headersArg] = h;
      }
      return origWriteHead(...args);
    };
  };
  app.use((req: Request, res: Response, next: NextFunction) => {
    stripXFrameOptions(res);
    next();
  });
  app.use(helmet(helmetOptions));
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useStaticAssets(join(process.cwd(), 'map'), { prefix: '/map' });
  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/public' });
  app.getHttpAdapter().getInstance().get('/favicon.ico', (_req: Request, res: Response) => res.status(204).end());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  const port = process.env.PORT ?? 9000;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  const baseUrl = process.env.PUBLIC_URL || `http://${host}:${port}`;
  console.log(`API: ${baseUrl}/api/v1`);
  console.log(`Map: ${baseUrl}/map/`);
}
bootstrap();
