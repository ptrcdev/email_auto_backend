import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppService } from './whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../repositories/user.repository';
import { PriorityRepository } from '../repositories/priority.repository';

describe('WhatsAppService', () => {
  let service: WhatsAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                WHATSAPP_PHONE_NUMBER_ID: '123456',
                WHATSAPP_TOKEN: 'test-token',
                WHATSAPP_TEMPLATE_NAME: 'priority_prompt',
                WHATSAPP_TEMPLATE_LANG: 'en',
              };
              return config[key] || '';
            }),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findByWhatsAppNumber: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PriorityRepository,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleIncomingMessage', () => {
    it('should return success false for unknown number', async () => {
      const userRepo = (service as any).userRepo;
      userRepo.findByWhatsAppNumber.mockResolvedValue(null);

      const result = await service.handleIncomingMessage(
        '+351912550237',
        'Finish contract with Paul',
      );

      expect(result.success).toBe(false);
    });

    it('should capture priority for known user', async () => {
      const userRepo = (service as any).userRepo;
      const priorityRepo = (service as any).priorityRepo;

      userRepo.findByWhatsAppNumber.mockResolvedValue({
        id: 'user-1',
        priorityDecayDays: 3,
      });
      priorityRepo.create.mockResolvedValue({});

      jest.spyOn(service, 'sendTextMessage').mockResolvedValue();

      const result = await service.handleIncomingMessage(
        '+351912550237',
        'Finish contract with Paul',
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(priorityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          rawText: 'Finish contract with Paul',
        }),
      );
    });
  });
});
