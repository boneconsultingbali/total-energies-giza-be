# Sentry Integration

This document explains how Sentry error monitoring and performance tracking has been integrated into the NestJS application.

## Overview

Sentry has been configured to:

- **Capture Errors**: Automatically capture and report unhandled exceptions
- **Performance Monitoring**: Track request performance and database queries
- **User Context**: Associate errors with specific users when available
- **Release Tracking**: Track errors by deployment version

## Configuration

### Environment Variables

Add the following environment variable to your `.env` file:

```bash
# Sentry - Error Monitoring
SENTRY_DSN="https://af0a4eb926b50fada99db4ad28a094b0@o4508929431044096.ingest.us.sentry.io/4509711208873984"
```

### Files Added

1. **`src/config/sentry.config.ts`** - Sentry initialization configuration
2. **`src/common/interceptors/sentry.interceptor.ts`** - Global interceptor for request tracking
3. **`src/common/services/sentry.service.ts`** - Injectable service for manual error reporting

### Files Modified

1. **`src/main.ts`** - Initialize Sentry at application startup
2. **`src/app.module.ts`** - Register SentryService as global provider
3. **`src/app.controller.ts`** - Added test endpoints for Sentry
4. **`src/common/filters/http-exception.filter.ts`** - Enhanced to report server errors to Sentry

## Usage

### Automatic Error Capture

Sentry will automatically capture:

- **Unhandled Exceptions**: Any uncaught errors in your application
- **HTTP Errors**: Server errors (5xx status codes) are reported
- **Performance Issues**: Slow database queries and request times

### Manual Error Reporting

Inject the `SentryService` to manually report errors or events:

```typescript
import { SentryService } from "../common/services/sentry.service";

@Injectable()
export class YourService {
  constructor(private readonly sentryService: SentryService) {}

  async someMethod() {
    try {
      // Your code here
    } catch (error) {
      // Manual error capture
      this.sentryService.captureException(error, "YourService.someMethod");
      throw error;
    }
  }

  logImportantEvent() {
    // Manual message capture
    this.sentryService.captureMessage(
      "Important business event occurred",
      "info"
    );
  }
}
```

### User Context

When users are authenticated, Sentry automatically captures user information:

- User ID
- Email address
- Username

This helps track which users are affected by specific errors.

### Performance Monitoring

Use spans to track performance of specific operations:

```typescript
async performExpensiveOperation() {
  return this.sentryService.startSpan(
    'expensive-operation',
    'database.query',
    async (span) => {
      // Your expensive operation here
      const result = await this.database.complexQuery();
      span.setTag('records_processed', result.length);
      return result;
    }
  );
}
```

## Testing Sentry Integration

Use the built-in test endpoints:

1. **Test Message Capture**:

   ```bash
   GET /test-sentry
   ```

   Sends a test message to Sentry.

2. **Test Error Capture**:
   ```bash
   GET /test-sentry-error
   ```
   Throws an intentional error to test error capture.

## Configuration Details

### Sampling Rates

- **Development**: 100% of transactions and profiles are captured
- **Production**: 10% of transactions and profiles are captured (to reduce volume)

### Filtered Events

The following requests are filtered out to reduce noise:

- Health check endpoints (`/health`)
- Metrics endpoints (`/metrics`)
- Favicon requests (`/favicon.ico`)

### Error Filtering

- **Client Errors (4xx)**: Not reported to Sentry (normal user errors)
- **Server Errors (5xx)**: Reported to Sentry with full context

## Monitoring and Alerts

Access your Sentry dashboard at: https://sentry.io/

You can set up alerts for:

- New error types
- Error frequency spikes
- Performance degradation
- Release health

## Security Considerations

- **PII Data**: `sendDefaultPii: true` is enabled, which includes IP addresses
- **Sensitive Data**: Request bodies are captured - ensure sensitive data is filtered
- **User Information**: User context is automatically captured when available

## Best Practices

1. **Context Setting**: Always set relevant context before capturing errors
2. **Error Grouping**: Use consistent error messages for better grouping
3. **Performance Impact**: Sentry adds minimal overhead but consider sampling in production
4. **Release Tracking**: Deploy with proper release tags for better tracking

## Troubleshooting

If Sentry is not capturing events:

1. Check the DSN configuration in environment variables
2. Verify network connectivity to Sentry
3. Check browser console for Sentry-related errors
4. Use test endpoints to verify integration

## Environment-Specific Configuration

- **Development**: Full debugging enabled, 100% sampling
- **Production**: Reduced sampling, error-level logging only
- **Staging**: Production-like configuration with higher sampling
