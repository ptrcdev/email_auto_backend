import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { EmailRecordRepository } from '../repositories/email-record.repository.js';
import { User } from '../entities/user.entity.js';
import { EmailRecord } from '../entities/email-record.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, EmailRecord])],
  controllers: [DashboardController],
  providers: [DashboardService, UserRepository, EmailRecordRepository],
})
export class DashboardModule {}
