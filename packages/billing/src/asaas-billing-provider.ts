import { BillingProvider } from './billing-provider.interface';
import {
  Charge,
  CreateChargeInput,
  CreateCustomerInput,
  Customer,
  WebhookResult,
} from './types';

/**
 * Asaas billing provider — STUB implementation.
 *
 * This is the only place where Asaas SDK/API calls should live.
 * Currently returns placeholder data. Real implementation will be added
 * when Asaas integration is activated.
 */
export class AsaasBillingProvider implements BillingProvider {
  async createCustomer(_input: CreateCustomerInput): Promise<Customer> {
    // TODO: Implement Asaas API call — POST /v3/customers
    throw new Error('AsaasBillingProvider.createCustomer: Not implemented yet');
  }

  async createCharge(_input: CreateChargeInput): Promise<Charge> {
    // TODO: Implement Asaas API call — POST /v3/payments
    throw new Error('AsaasBillingProvider.createCharge: Not implemented yet');
  }

  async cancelCharge(_chargeId: string): Promise<void> {
    // TODO: Implement Asaas API call — DELETE /v3/payments/{id}
    throw new Error('AsaasBillingProvider.cancelCharge: Not implemented yet');
  }

  async handleWebhook(_payload: unknown): Promise<WebhookResult> {
    // TODO: Implement webhook signature validation + event parsing
    throw new Error('AsaasBillingProvider.handleWebhook: Not implemented yet');
  }
}
