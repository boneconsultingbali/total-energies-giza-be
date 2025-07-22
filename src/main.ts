// IMPORTANT: Make sure to import `instrument.ts` at the top of your file.
// If you're using CommonJS (CJS) syntax, use `require("./instrument.ts");`
import "./instrument";

// All other imports below
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { SentryExceptionFilter } from "./common/filters/sentry-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);

  app.useLogger(logger);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Global exception filter
  app.useGlobalFilters(new SentryExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new ResponseInterceptor());

  // CORS
  // app.enableCors({
  //   origin: [configService.get("FRONTEND_URL", "http://localhost:3000")],
  //   credentials: true,
  // });

  // CORS allow all
  app.enableCors();

  // Welcome message by return public/index.html
  app.getHttpAdapter().get("/", (req, res) => {
    res.sendFile("index.html", { root: "public" });
  });

  // Global prefix
  app.setGlobalPrefix("api/v1");

  const port = configService.get("PORT", 8080);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
