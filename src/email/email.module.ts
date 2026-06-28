import { Module } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { User } from '../entities/user.entity.js';
import { EmailRecord } from '../entities/email-record.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User, EmailRecord])],
  providers: [EmailService, UserRepository, EmailRecordRepository],
  exports: [EmailService],
})
export class EmailModule {}
