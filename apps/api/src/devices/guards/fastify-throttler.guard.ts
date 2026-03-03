import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Guard de rate-limit compatível com Fastify.
 *
 * O ThrottlerGuard padrão espera Express (`req.ip`).
 * Aqui sobrescrevemos para extrair IP via `request.ip` do Fastify.
 */
@Injectable()
export class FastifyThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    // Fastify: request.ip já considera x-forwarded-for se trustProxy está ativo
    const ip =
      (req as { ip?: string }).ip ??
      (req as { ips?: string[] }).ips?.[0] ??
      'unknown';
    return Promise.resolve(ip);
  }

  override getRequestResponse(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const reply = http.getResponse();
    return { req: request, res: reply };
  }
}
