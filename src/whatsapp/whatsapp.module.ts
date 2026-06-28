import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service.js';
import { WhatsAppController } from './whatsapp.controller.js';
import { UserRepository } from '../repositories/user.repository.js';
import { PriorityRepository } from '../repositories/priority.repository.js';
import { User } from '../entities/user.entity.js';
import { Priority } from '../entities/priority.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([User, Priority])],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, UserRepository, PriorityRepository],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
