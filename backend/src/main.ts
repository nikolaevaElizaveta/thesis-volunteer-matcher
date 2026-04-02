import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Volunteer Matcher API')
    .setDescription(
      'Backend for Volunteer Matcher: CRUD for tasks and offers, proxy to matching service (greedy / hungarian / max_coverage / bottleneck). Use **POST /auth/login** first, then **Authorize** with `Bearer <access_token>`.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Login / register')
    .addTag('tasks', 'Shelter tasks')
    .addTag('offers', 'Volunteer offers')
    .addTag('match', 'Run matching')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`Swagger UI at http://localhost:${port}/api`);
}

bootstrap();
