import { Injectable } from '@nestjs/common';
import { PlanTier } from '@prisma/client';

export interface PaymentActivationResult {
  reference: string;
}

/**
 * Payment abstraction (Spec §2). v1 uses MANUAL activation (bank transfer) via
 * the Super Admin — no real gateway. A future local gateway (Sadad/Moamalat)
 * plugs in behind this interface without touching the subscription flow.
 */
export abstract class PaymentGateway {
  abstract activate(
    tenantId: string,
    tier: PlanTier,
    note?: string,
  ): Promise<PaymentActivationResult>;
}

@Injectable()
export class ManualPaymentGateway extends PaymentGateway {
  async activate(
    tenantId: string,
    tier: PlanTier,
    note?: string,
  ): Promise<PaymentActivationResult> {
    // Manual/bank-transfer activation: the reference is the admin's note (or a marker).
    return { reference: note ?? `manual:${tier}:${tenantId}` };
  }
}
