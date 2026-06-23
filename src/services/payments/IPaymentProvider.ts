// Every payment provider (M-Pesa, e-Mola, a future cash-on-delivery "provider",
// even a fake provider for testing) implements this same interface. The rest of
// the app — order creation, the payments route — only ever talks to THIS shape,
// never to M-Pesa or e-Mola specifically. This is the same idea as a C++/C#
// abstract base class / interface: callers depend on the contract, not the
// concrete implementation behind it.

export interface InitiatePaymentInput {
  orderId: number;
  amountCents: number;
  customerPhone: string; // the phone number the payment request is sent to
}

export interface InitiatePaymentResult {
  // Whether the provider ACCEPTED the request for processing.
  // This is NOT the same as "payment succeeded" — mobile money payments are
  // asynchronous: the customer still has to approve a prompt on their phone.
  // "accepted" just means "the provider is now attempting it".
  status: "accepted" | "rejected";
  providerTransactionRef: string | null; // the ID the provider gives us to track this payment
  message?: string;
}

export type PaymentStatus = "pending" | "confirmed" | "failed";

export interface CheckStatusResult {
  status: PaymentStatus;
  providerTransactionRef: string;
}

export interface IPaymentProvider {
  // Human-readable name, used for logging and stored in the payments table's `provider` column.
  readonly providerName: "mpesa" | "emola" | "cash";

  // Start a payment attempt. For mobile money, this is what triggers the
  // "approve this payment" prompt on the customer's phone.
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;

  // Ask the provider "what actually happened with this payment?" — used both
  // for polling and for handling the provider's callback/webhook.
  checkStatus(providerTransactionRef: string): Promise<CheckStatusResult>;
}
