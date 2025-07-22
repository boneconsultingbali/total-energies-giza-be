// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: "https://af0a4eb926b50fada99db4ad28a094b0@o4508929431044096.ingest.us.sentry.io/4509711208873984",

  // Set tracesSampleRate to 1.0 to capture 100%
  // of the transactions for tracing.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Capture Console logs
  integrations: [
    Sentry.consoleIntegration(),
    Sentry.nodeContextIntegration(),
    Sentry.localVariablesIntegration(),
  ],

  // Environment
  environment: process.env.NODE_ENV || "development",

  // Release tracking
  release: process.env.npm_package_version || "0.0.1",
});
