import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrioritiesController } from './priorities.controller.js';
import { PrioritiesService } from './priorities.service.js';
import { Priority } from '../entities/priority.entity.js';
import { User } from '../entities/user.entity.js';
import { PriorityRepository } from '../repositories/priority.repository.js';
import { UserRepository } from '../repositories/user.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([Priority, User])],
  controllers: [PrioritiesController],
  providers: [PrioritiesService, PriorityRepository, UserRepository],
  exports: [PrioritiesService, PriorityRepository],
})
export class PrioritiesModule {}
