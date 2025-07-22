import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import * as Sentry from "@sentry/nestjs";

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Set user context for Sentry
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    }

    // Set request context
    Sentry.setTag("method", request.method);
    Sentry.setTag("url", request.url);

    return next.handle().pipe(
      tap(() => {
        // Clear user context after successful request
        Sentry.setUser(null);
      }),
      catchError((error) => {
        // Capture error in Sentry
        if (error instanceof HttpException) {
          // Don't capture 4xx errors as they are client errors
          const status = error.getStatus();
          if (status >= 500) {
            Sentry.captureException(error);
          }
        } else {
          // Capture all other errors
          Sentry.captureException(error);
        }

        // Clear user context
        Sentry.setUser(null);

        return throwError(error);
      })
    );
  }
}
