import { Test } from '@nestjs/testing';
import { BuildingsService } from './buildings.service';
import { getModelToken } from '@nestjs/mongoose';
import { S3Service } from '../common/s3.service';
import { QueueService } from '../queues/queue.service';

describe('BuildingsService (unit)', () => {
  let service: any;

  const mockBuildingModel = {
    findById: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const mockUserModel = {
    findById: jest.fn(),
  };
  const mockS3 = {};
  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BuildingsService,
        { provide: getModelToken('Building'), useValue: mockBuildingModel },
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: S3Service, useValue: mockS3 },
        { provide: QueueService, useValue: mockQueue },
      ],
    }).compile();

    service = moduleRef.get(BuildingsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should queue an uploadBuildingImage job', async () => {
    mockBuildingModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ save: jest.fn() }),
    });
    const fakeFile = { originalname: 'a.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('x') };
    mockQueue.add.mockResolvedValue({ id: 'job1' });
    const res = await service.uploadBuildingImage('bid', fakeFile as any);
    expect(res).toHaveProperty('jobId', 'job1');
    expect(res.status).toBe('queued');
  });
});

