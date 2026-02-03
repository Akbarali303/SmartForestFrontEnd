import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal Server Error';

    const body =
      typeof message === 'object' && message !== null && 'message' in message
        ? (message as { message?: string | string[] })
        : { message };

    const msgStr = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? 'Internal Server Error');

    this.logger.error(
      `${req.method} ${req.url} ${status} — ${msgStr}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    if (!res.headersSent) {
      res.status(status).json({
        statusCode: status,
        message: msgStr,
      });
    }
  }
}
