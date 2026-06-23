export type PaymentMethod = "mobile_money" | "cash";
export type PaymentProviderName = "mpesa" | "emola" | null;
export type PaymentRecordStatus = "pending" | "confirmed" | "failed";

export interface Payment {
  id: number;
  orderId: number;
  method: PaymentMethod;
  provider: PaymentProviderName;
  status: PaymentRecordStatus;
  amountCents: number;
  providerTransactionRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRow {
  id: number;
  order_id: number;
  method: string;
  provider: string | null;
  status: string;
  amount_cents: number;
  provider_transaction_ref: string | null;
  created_at: string;
  updated_at: string;
}
