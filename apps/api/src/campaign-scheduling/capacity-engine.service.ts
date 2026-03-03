import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '@/modules/database';

import {
  type CapacityOccurrence,
  checkCapacity,
  computeMaxPlaysPerHour,
  EFFECTIVE_CAPACITY,
} from '@telumi/shared';

/**
 * CapacityEngineService — responsável por consultas de capacidade no banco
 * e orquestrar a validação usando funções puras do @telumi/shared.
 *
 * Invariante: soma(rate) de todas as campahas ativas em qualquer subintervalo
 * de uma tela nunca excede EFFECTIVE_CAPACITY (0.95).
 */
@Injectable()
export class CapacityEngineService {
  private readonly logger = new Logger(CapacityEngineService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Busca ocorrências confirmadas e holds ativos que sobrepõem o intervalo
   * para uma tela específica.
   *
   * @param excludeCampaignId Excluir ocorrências desta campanha (para re-validação)
   * @param excludeHoldId Excluir este hold (para não contar 2x no confirm)
   */
  async getExistingOccurrences(
    screenId: string,
    startUtc: Date,
    endUtc: Date,
    excludeCampaignId?: string,
    excludeHoldId?: string,
  ): Promise<CapacityOccurrence[]> {
    const result: CapacityOccurrence[] = [];

    // 1) Ocorrências materializadas ACTIVE
    const occurrences = await this.db.scheduleOccurrence.findMany({
      where: {
        screenId,
        status: 'ACTIVE',
        startAtUtc: { lt: endUtc },
        endAtUtc: { gt: startUtc },
        ...(excludeCampaignId ? { campaignId: { not: excludeCampaignId } } : {}),
      },
      select: {
        startAtUtc: true,
        endAtUtc: true,
        rate: true,
      },
    });

    for (const occ of occurrences) {
      result.push({
        start: occ.startAtUtc.getTime(),
        end: occ.endAtUtc.getTime(),
        rate: occ.rate,
      });
    }

    // 2) Holds ACTIVE não expirados (tratados como reservas)
    const now = new Date();
    const holds = await this.db.capacityHold.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gt: now },
        ...(excludeHoldId ? { id: { not: excludeHoldId } } : {}),
      },
      select: {
        id: true,
        occurrencesJson: true,
        campaignId: true,
      },
    });

    for (const hold of holds) {
      if (excludeCampaignId && hold.campaignId === excludeCampaignId) continue;

      const holdOccs = hold.occurrencesJson as Array<{
        screenId: string;
        startAtUtc: string;
        endAtUtc: string;
        rate: number;
      }>;

      for (const ho of holdOccs) {
        if (ho.screenId !== screenId) continue;

        const hoStart = new Date(ho.startAtUtc);
        const hoEnd = new Date(ho.endAtUtc);

        // Verificar overlap
        if (hoStart < endUtc && hoEnd > startUtc) {
          result.push({
            start: hoStart.getTime(),
            end: hoEnd.getTime(),
            rate: ho.rate,
          });
        }
      }
    }

    return result;
  }

  /**
   * Verifica capacidade para uma ocorrência candidata em uma tela.
   * Retorna se cabe, o slack disponível e max plays/hora.
   */
  async checkScreenCapacity(
    screenId: string,
    startUtc: Date,
    endUtc: Date,
    candidateRate: number,
    timelineDurationSeconds: number,
    excludeCampaignId?: string,
    excludeHoldId?: string,
  ): Promise<{
    fits: boolean;
    slack: number;
    maxPlaysPerHour: number;
  }> {
    const existing = await this.getExistingOccurrences(
      screenId,
      startUtc,
      endUtc,
      excludeCampaignId,
      excludeHoldId,
    );

    const candidate: CapacityOccurrence = {
      start: startUtc.getTime(),
      end: endUtc.getTime(),
      rate: candidateRate,
    };

    const result = checkCapacity(candidate, existing, EFFECTIVE_CAPACITY);
    const maxPph = computeMaxPlaysPerHour(result.slack, timelineDurationSeconds);

    return {
      fits: result.fits,
      slack: result.slack,
      maxPlaysPerHour: maxPph,
    };
  }

  /**
   * Expire holds que passaram do TTL.
   * Chamado periodicamente ou antes de validações.
   */
  async expireStaleHolds(): Promise<number> {
    const result = await this.db.capacityHold.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale capacity hold(s)`);
    }

    return result.count;
  }
}
