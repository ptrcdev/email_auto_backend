import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service.js';
import { TestController } from './test.controller.js';
import { QueueModule } from '../queue/queue.module.js';
import { UserRepository } from '../repositories/user.repository.js';
import { User } from '../entities/user.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushModule } from '../push/push.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    QueueModule,
    PushModule,
    TypeOrmModule.forFeature([User]),
  ],
  providers: [SchedulerService, UserRepository],
  controllers: [TestController],
  exports: [SchedulerService],
})
export class SchedulerModule {}
