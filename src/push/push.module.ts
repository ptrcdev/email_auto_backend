import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushService } from './push.service.js';
import { PushController } from './push.controller.js';
import { User } from '../entities/user.entity.js';
import { UserRepository } from '../repositories/user.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PushController],
  providers: [PushService, UserRepository],
  exports: [PushService],
})
export class PushModule {}
