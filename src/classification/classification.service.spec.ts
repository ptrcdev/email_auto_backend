import { Test, TestingModule } from '@nestjs/testing';
import { ClassificationService } from './classification.service';
import { ConfigService } from '@nestjs/config';

describe('ClassificationService', () => {
  let service: ClassificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENROUTER_API_KEY') return 'test-key';
              if (key === 'LLM_MODELS')
                return 'meta-llama/llama-3.3-70b-instruct:free';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ClassificationService>(ClassificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
