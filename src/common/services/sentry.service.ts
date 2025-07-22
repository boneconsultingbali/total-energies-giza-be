import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

@Injectable()
export class SentryService {
  /**
   * Capture an exception manually
   */
  captureException(error: Error, context?: string): string {
    if (context) {
      Sentry.setTag("context", context);
    }
    return Sentry.captureException(error);
  }

  /**
   * Capture a message manually
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = "info",
    context?: string
  ): string {
    if (context) {
      Sentry.setTag("context", context);
    }
    return Sentry.captureMessage(message, level);
  }

  /**
   * Set user context
   */
  setUser(user: Sentry.User): void {
    Sentry.setUser(user);
  }

  /**
   * Set additional context
   */
  setContext(key: string, context: any): void {
    Sentry.setContext(key, context);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Set tags
   */
  setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  /**
   * Start a span for performance monitoring
   */
  startSpan(
    name: string,
    operation: string,
    callback: (span: any) => any
  ): any {
    return Sentry.startSpan(
      {
        name,
        op: operation,
      },
      callback
    );
  }
}
