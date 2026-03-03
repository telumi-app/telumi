import {
  Charge,
  CreateChargeInput,
  CreateCustomerInput,
  Customer,
  WebhookResult,
} from './types';

/**
 * Abstract billing provider interface.
 *
 * All payment logic MUST go through this interface.
 * No code outside `packages/billing` should import provider SDKs or HTTP clients directly.
 *
 * @see ADR-0002 for rationale
 */
export interface BillingProvider {
  /** Create a customer/subaccount in the billing provider */
  createCustomer(input: CreateCustomerInput): Promise<Customer>;

  /** Create a charge (payment) for a customer */
  createCharge(input: CreateChargeInput): Promise<Charge>;

  /** Cancel an existing charge */
  cancelCharge(chargeId: string): Promise<void>;

  /** Process and validate an incoming webhook payload */
  handleWebhook(payload: unknown): Promise<WebhookResult>;
}

/** DI token for NestJS injection */
export const BILLING_PROVIDER = Symbol('BILLING_PROVIDER');
