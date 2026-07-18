import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { User } from '../entities/user.entity.js';
import { EmailRecord } from '../entities/email-record.entity.js';
import { Digest } from '../entities/digest.entity.js';
import { Priority } from '../entities/priority.entity.js';
import { CalendarModule } from '../calendar/calendar.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, EmailRecord, Digest, Priority]),
    CalendarModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
})
export class UsersModule {}
