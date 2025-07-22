import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response, Request } from "express";
import { SentryExceptionCaptured } from "@sentry/nestjs";
import * as Sentry from "@sentry/nestjs";

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : "Internal server error";

    // Add context to Sentry
    Sentry.withScope((scope) => {
      scope.setTag("component", "ExceptionFilter");
      scope.setContext("http", {
        method: request.method,
        url: request.url,
        headers: request.headers,
        user_agent: request.headers["user-agent"],
      });
      scope.setLevel("error");

      // Capture the exception to Sentry
      if (status >= 500) {
        Sentry.captureException(exception);
      } else {
        Sentry.captureMessage(`HTTP ${status}: ${message}`, "warning");
      }
    });

    // Send response
    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
