import { Controller, Get } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return "NestJS User Management API is running!";
  }

  @Get("health")
  getHealth() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get("test-sentry")
  testSentry() {
    // Test Sentry integration using official SDK
    Sentry.captureMessage(
      "Test message from API - using official Sentry SDK",
      "info"
    );

    // Add some context
    Sentry.addBreadcrumb({
      message: "Testing Sentry integration",
      level: "info",
      timestamp: Date.now() / 1000,
    });

    return {
      message: "Sentry test message sent",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("test-sentry-error")
  testSentryError() {
    // Test error capture
    throw new Error("Test error for Sentry - this is intentional");
  }
}
