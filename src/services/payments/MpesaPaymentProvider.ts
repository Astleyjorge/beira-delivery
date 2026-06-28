import crypto from "node:crypto";
import type {
  IPaymentProvider,
  InitiatePaymentInput,
  InitiatePaymentResult,
  CheckStatusResult,
} from "./IPaymentProvider";

// Configuration shape — all values come from environment variables,
// never hardcoded. This is passed in when the provider is created,
// keeping the provider itself free of any knowledge about where
// config comes from (file, env, secrets manager, etc.)
export interface MpesaConfig {
  apiKey: string;
  publicKey: string;
  serviceProviderCode: string;
  apiHost: string;   // api.sandbox.vm.co.mz (sandbox) or api.vm.co.mz (production)
  origin: string;    // developer.mpesa.vm.co.mz
}

// M-Pesa Mozambique response codes.
// INS-0 is the only "success" code — everything else is a failure.
const SUCCESS_CODE = "INS-0";

export class MpesaPaymentProvider implements IPaymentProvider {
  readonly providerName = "mpesa" as const;
  private readonly config: MpesaConfig;

  constructor(config: MpesaConfig) {
    this.config = config;
  }

  // ─── RSA encryption ──────────────────────────────────────────────────────
  //
  // The Vodacom Mozambique API does NOT accept the API key directly as a
  // Bearer token. Instead, you must:
  //   1. Take the raw API key string
  //   2. Encrypt it with the Public Key using RSA/PKCS#1 v1.5 padding
  //   3. Base64-encode the encrypted bytes
  //   4. Use that base64 string as the Bearer token
  //
  // This is unique to Vodacom MZ's API design. Node.js's built-in `crypto`
  // module handles this — no extra npm package needed.
  //
  // The Public Key from the portal is a raw base64 string (not PEM format),
  // so we wrap it in PEM headers before passing it to crypto.publicEncrypt.
  private generateBearerToken(): string {
    const publicKeyPem = [
      "-----BEGIN PUBLIC KEY-----",
      this.config.publicKey,
      "-----END PUBLIC KEY-----",
    ].join("\n");

    const encrypted = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PADDING, // PKCS#1 v1.5, NOT OAEP
      },
      Buffer.from(this.config.apiKey, "utf8")
    );

    return encrypted.toString("base64");
  }

  // ─── Shared request helper ───────────────────────────────────────────────
  //
  // All M-Pesa API calls share the same auth headers and base URL pattern,
  // so we centralise that here rather than repeating it in every method.
  private async mpesaRequest(
    path: string,
    body: Record<string, string | number>
  ): Promise<Record<string, string>> {
    const bearerToken = this.generateBearerToken();
    const url = `https://${this.config.apiHost}/ipg/v1x/${path}`;

    // fetch() is built into Node 22 — no axios or node-fetch needed.
    // This is our first real outbound HTTP call in the whole project.
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        Origin: this.config.origin,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // HTTP-level failure (5xx, network error, etc.) before we even get
      // an M-Pesa response code. Throw immediately so the caller retries.
      throw new Error(
        `M-Pesa HTTP error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<Record<string, string>>;
  }

  // ─── C2B Single Stage (STK Push) ─────────────────────────────────────────
  //
  // Sends a payment request to the customer's phone. The customer then sees
  // an M-Pesa prompt and must enter their PIN to approve.
  // The API response tells us immediately whether the request was accepted —
  // but NOT whether the customer approved it (that comes via checkStatus).
  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    // M-Pesa expects the amount in whole units (not cents), so we convert.
    // Our DB stores everything as integer cents: 35000 cents = 350.00 MZN
    const amountInMzn = (input.amountCents / 100).toFixed(2);

    // transaction_reference: our internal order reference (max 20 chars)
    // third_party_reference: a secondary reference we can use for lookups
    const transactionRef = `ORD-${input.orderId}-${Date.now()}`.slice(0, 20);
    const thirdPartyRef = `BD-${input.orderId}`;

    try {
      const data = await this.mpesaRequest("c2bPayment/singleStage/", {
        input_TransactionReference: transactionRef,
        input_CustomerMSISDN: input.customerPhone,    // e.g. "258841234567"
        input_Amount: amountInMzn,                    // e.g. "350.00"
        input_ThirdPartyReference: thirdPartyRef,
        input_ServiceProviderCode: this.config.serviceProviderCode, // "171717" in sandbox
      });

      if (data.output_ResponseCode === SUCCESS_CODE) {
        // Payment request sent to customer's phone — they still need to approve it.
        // output_TransactionID is what we use for future status checks.
        return {
          status: "accepted",
          providerTransactionRef: data.output_TransactionID,
          message: data.output_ResponseDesc,
        };
      }

      // M-Pesa returned a non-zero response code — request was rejected.
      // Common codes: INS-6 (transaction failed), INS-9 (request timeout),
      // INS-10 (duplicate transaction), INS-2006 (insufficient balance)
      return {
        status: "rejected",
        providerTransactionRef: null,
        message: `M-Pesa rejected: [${data.output_ResponseCode}] ${data.output_ResponseDesc}`,
      };
    } catch (err) {
      // Network-level failure — treat as rejection so the caller can retry
      return {
        status: "rejected",
        providerTransactionRef: null,
        message: err instanceof Error ? err.message : "Unknown M-Pesa error",
      };
    }
  }

  // ─── Transaction status query ─────────────────────────────────────────────
  //
  // Asks M-Pesa "what happened with this transaction?"
  // Call this after initiatePayment returns "accepted" to find out
  // whether the customer actually approved their PIN prompt.
  async checkStatus(providerTransactionRef: string): Promise<CheckStatusResult> {
    try {
      const data = await this.mpesaRequest("queryTransactionStatus/", {
        input_QueryReference: providerTransactionRef,
        input_ServiceProviderCode: this.config.serviceProviderCode,
        input_ThirdPartyReference: providerTransactionRef,
      });

      if (data.output_ResponseCode === SUCCESS_CODE) {
        return { status: "confirmed", providerTransactionRef };
      }

      // INS-9 (timeout/pending) means the customer hasn't responded yet.
      // Any other non-zero code means it definitively failed.
      const isPending = data.output_ResponseCode === "INS-9";
      return {
        status: isPending ? "pending" : "failed",
        providerTransactionRef,
      };
    } catch {
      // If the status check itself fails (network error, etc.), treat as
      // still pending — we'll retry later rather than marking it failed prematurely.
      return { status: "pending", providerTransactionRef };
    }
  }

  // ─── Static factory method ────────────────────────────────────────────────
  //
  // Reads config from environment variables and creates the provider.
  // Call this in routes/payments.ts instead of the constructor directly:
  //   const provider = MpesaPaymentProvider.fromEnv();
  // This keeps all env var reading in one place, making it easy to validate
  // that all required variables are present at startup.
  static fromEnv(): MpesaPaymentProvider {
    const required = [
      "MPESA_API_KEY",
      "MPESA_PUBLIC_KEY",
      "MPESA_SERVICE_PROVIDER_CODE",
      "MPESA_API_HOST",
      "MPESA_ORIGIN",
    ];

    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required M-Pesa environment variables: ${missing.join(", ")}`
      );
    }

    return new MpesaPaymentProvider({
      apiKey: process.env.MPESA_API_KEY!,
      publicKey: process.env.MPESA_PUBLIC_KEY!,
      serviceProviderCode: process.env.MPESA_SERVICE_PROVIDER_CODE!,
      apiHost: process.env.MPESA_API_HOST!,
      origin: process.env.MPESA_ORIGIN!,
    });
  }
}
