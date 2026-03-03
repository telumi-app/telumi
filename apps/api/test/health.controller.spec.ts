import { describe, it, expect, vi } from 'vitest';

import { DatabaseService } from '../src/modules/database/database.service';
import { HealthController } from '../src/modules/health/health.controller';

describe('HealthController', () => {
  it('should return status ok with database connected', async () => {
    const mockDb = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DatabaseService;

    const controller = new HealthController(mockDb);
    const result = await controller.check();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'telumi-api',
      database: 'connected',
    });
    expect(result.timestamp).toBeDefined();
  });

  it('should return database error when db is unreachable', async () => {
    const mockDb = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as DatabaseService;

    const controller = new HealthController(mockDb);
    const result = await controller.check();

    expect(result.database).toBe('error');
    expect(result.status).toBe('ok');
  });
});
