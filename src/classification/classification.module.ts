import { Module } from '@nestjs/common';
import { ClassificationService } from './classification.service.js';

@Module({
  providers: [ClassificationService],
  exports: [ClassificationService],
})
export class ClassificationModule {}
