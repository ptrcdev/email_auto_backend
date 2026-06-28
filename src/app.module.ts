import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module.js';
import { EmailModule } from './email/email.module.js';
import { WhatsAppModule } from './whatsapp/whatsapp.module.js';
import { ClassificationModule } from './classification/classification.module.js';
import { DigestModule } from './digest/digest.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { UsersModule } from './users/users.module.js';
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
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USERNAME', 'postgres'),
        password: config.get('DATABASE_PASSWORD', 'postgres'),
        database: config.get('DATABASE_NAME', 'email_auto'),
        entities: [User, Priority, EmailRecord, Digest],
        synchronize: config.get('NODE_ENV') === 'development',
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmailModule,
    WhatsAppModule,
    ClassificationModule,
    DigestModule,
    SchedulerModule,
    UsersModule,
  ],
})
export class AppModule {}
