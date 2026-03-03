export interface CreateCustomerInput {
  workspaceId: string;
  name: string;
  email: string;
  cpfCnpj: string;
}

export interface Customer {
  id: string;
  externalId: string;
  name: string;
  email: string;
}

export interface CreateChargeInput {
  customerId: string;
  amount: number;
  description: string;
  dueDate: string;
  externalReference?: string;
}

export interface Charge {
  id: string;
  externalId: string;
  status: string;
  amount: number;
  paymentUrl?: string;
  pixQrCode?: string;
}

export interface WebhookResult {
  eventType: string;
  handled: boolean;
  data?: Record<string, unknown>;
}
