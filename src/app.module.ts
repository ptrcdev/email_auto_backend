import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module.js';
import { EmailModule } from './email/email.module.js';
import { WhatsAppModule } from './whatsapp/whatsapp.module.js';
import { ClassificationModule } from './classification/classification.module.js';
import { DigestModule } from './digest/digest.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { UsersModule } from './users/users.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { QueueModule } from './queue/queue.module.js';
import { User } from './entities/user.entity.js';
import { Priority } from './entities/priority.entity.js';
import { EmailRecord } from './entities/email-record.entity.js';
import { Digest } from './entities/digest.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const isProduction = config.get('NODE_ENV') === 'production';
        const databaseUrl = config.get<string>('DATABASE_URL');
        const entities = [User, Priority, EmailRecord, Digest];

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities,
            synchronize: false,
            ssl: isProduction ? { rejectUnauthorized: false } : false,
          };
        }

        return {
          type: 'postgres',
          host: config.get<string>('DATABASE_HOST', 'localhost'),
          port: parseInt(config.get<string>('DATABASE_PORT', '5432'), 10),
          username: config.get<string>('DATABASE_USERNAME', 'postgres'),
          password: config.get<string>('DATABASE_PASSWORD', 'postgres'),
          database: config.get<string>('DATABASE_NAME', 'email_auto'),
          entities,
          synchronize: !isProduction,
          ssl: isProduction ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmailModule,
    WhatsAppModule,
    ClassificationModule,
    DigestModule,
    SchedulerModule,
    UsersModule,
    DashboardModule,
    QueueModule,
  ],
})
export class AppModule {}
