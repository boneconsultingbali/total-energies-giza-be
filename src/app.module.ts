import { Module, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { WinstonModule } from "nest-winston";
import * as winston from "winston";
import { SentryModule } from "@sentry/nestjs/setup";
import { APP_FILTER } from "@nestjs/core";
import { SentryGlobalFilter } from "@sentry/nestjs/setup";
import { AppController } from "./app.controller";
import { PrismaModule } from "./database/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { PerformanceIndicatorModule } from "./modules/performance-indicator/performance-indicator.module";
import { ProjectModule } from "./modules/project/project.module";
import { DocumentModule } from "./modules/document/document.module";
import { LoggerMiddleware } from "./common/middleware/logger.middleware";
import { EmailModule } from "./email/email.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { ThirdPartyModule } from "./modules/third-party/third-party.module";
import { AzureBlobStorageModule } from "./storage/azure-blob-storage/azure-blob-storage.module";
import { RoleModule } from "./modules/role/role.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),
    WinstonModule.forRoot({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
        }),
        new winston.transports.File({
          filename: "logs/combined.log",
        }),
      ],
    }),
    PrismaModule,
    AzureBlobStorageModule,
    EmailModule,

    // Modules
    AuthModule,
    UserModule,
    PerformanceIndicatorModule,
    ProjectModule,
    DocumentModule,
    TenantModule,
    ThirdPartyModule,
    RoleModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
