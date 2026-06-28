import { Module } from '@nestjs/common';
import { DigestService } from './digest.service.js';
import { DigestSenderService } from './digest-sender.service.js';
import { DigestRepository } from '../repositories/digest.repository.js';
import { Digest } from '../entities/digest.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Digest])],
  providers: [DigestService, DigestSenderService, DigestRepository],
  exports: [DigestService, DigestSenderService],
})
export class DigestModule {}
