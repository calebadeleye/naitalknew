import { useEffect, useState } from "react";
import { laravelApi } from "./api";

export type PaymentGatewayId = "paystack" | "flutterwave" | "stripe" | "paypal";
export type PaymentMethodId = PaymentGatewayId | "bank_transfer";

export type PaymentOption = { method: PaymentMethodId; label: string; currency: string };

const GATEWAYS: PaymentGatewayId[] = ["paystack", "flutterwave", "stripe", "paypal"];

export const isGateway = (method: PaymentMethodId): method is PaymentGatewayId => (GATEWAYS as string[]).includes(method);

let cached: { token: string; request: Promise<PaymentOption[]> } | null = null;

/**
 * The payment methods the admin has switched on (GET /client/payment-options).
 * Loaded once per session and shared by every payment panel on the page.
 * While loading — or if the request fails — this is null, so callers can
 * avoid flashing methods that may be switched off.
 */
export function usePaymentOptions(token: string): PaymentOption[] | null {
  const [options, setOptions] = useState<PaymentOption[] | null>(null);

  useEffect(() => {
    if (!token) return;
    if (!cached || cached.token !== token) {
      const request = laravelApi<{ methods: PaymentOption[] }>("/api/v1/client/payment-options", token).then((response) => response.methods);
      cached = { token, request };
      request.catch(() => {
        if (cached?.request === request) cached = null;
      });
    }

    let isCurrent = true;
    cached.request.then((methods) => isCurrent && setOptions(methods)).catch(() => isCurrent && setOptions([]));

    return () => {
      isCurrent = false;
    };
  }, [token]);

  return options;
}
