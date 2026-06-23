import type {
  IPaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  CheckStatusResult,
} from "./IPaymentProvider";

// Simulates a mobile money provider so we can build and test the rest of the
// payment flow (routes, order linkage, status updates) BEFORE we have real
// M-Pesa sandbox credentials wired in. Swapping this for MpesaPaymentProvider
// later should require changing ONE line where the provider is selected —
// nothing in routes or order logic should need to change at all. That's the
// whole point of coding against the interface.
export class FakePaymentProvider implements IPaymentProvider {
  readonly providerName = "mpesa" as const;

  // In-memory store simulating "what the provider's servers remember about each transaction".
  // A real provider would hold this on M-Pesa's servers, not ours — we only keep
  // OUR side (the `payments` table). This map exists purely to make the fake convincing.
  private transactions = new Map<string, PaymentStatusSim>();

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    // Simulate real network latency, so the rest of the app is forced to handle
    // the "this takes a moment" reality properly, instead of assuming instant responses.
    await delay(300);

    const ref = `FAKE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Simulate obviously-invalid phone numbers being rejected outright,
    // the way a real provider would.
    if (!input.customerPhone.startsWith("+258")) {
      return {
        status: "rejected",
        providerTransactionRef: null,
        message: "Invalid phone number for Mozambique mobile money",
      };
    }

    this.transactions.set(ref, { status: "pending", createdAt: Date.now() });
    return { status: "accepted", providerTransactionRef: ref };
  }

  async checkStatus(providerTransactionRef: string): Promise<CheckStatusResult> {
    await delay(100);

    const record = this.transactions.get(providerTransactionRef);
    if (!record) {
      throw new Error(`Unknown transaction reference: ${providerTransactionRef}`);
    }

    // Simulate the customer approving the payment on their phone ~2 seconds after
    // initiation. Real M-Pesa works the same way: pending until the customer acts.
    const elapsed = Date.now() - record.createdAt;
    if (record.status === "pending" && elapsed > 2000) {
      record.status = "confirmed";
    }

    return { status: record.status, providerTransactionRef };
  }
}

interface PaymentStatusSim {
  status: "pending" | "confirmed" | "failed";
  createdAt: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
