import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarService } from './calendar.service.js';
import { CalendarController } from './calendar.controller.js';
import { User } from '../entities/user.entity.js';
import { UserRepository } from '../repositories/user.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [CalendarController],
  providers: [CalendarService, UserRepository],
  exports: [CalendarService],
})
export class CalendarModule {}
