import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { Response } from "express";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { Logger } from "winston";
import * as Sentry from "@sentry/nestjs";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message =
        typeof errorResponse === "string"
          ? errorResponse
          : (errorResponse as any).message || exception.message;
    }

    const errorLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      status,
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
      user: request.user?.id || "anonymous",
    };

    // Log to Winston
    this.logger.error("HTTP Exception", errorLog);

    // Report server errors (5xx) to Sentry
    if (status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag("component", "http-exception-filter");
        scope.setLevel("error");
        scope.setContext("request", {
          url: request.url,
          method: request.method,
          headers: request.headers,
          query: request.query,
          body: request.body,
        });
        if (request.user) {
          scope.setUser({
            id: request.user.id,
            email: request.user.email,
            username: request.user.username,
          });
        }
        Sentry.captureException(exception);
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
