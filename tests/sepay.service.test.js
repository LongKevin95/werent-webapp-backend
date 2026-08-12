import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

describe("SePay service", () => {
  it("signs checkout fields in SePay's required field order", async () => {
    vi.resetModules();
    vi.stubEnv("SEPAY_SECRET_KEY", "test-secret");
    const { signSepayCheckoutFields } = await import(
      "../src/services/sepay.service.js"
    );
    const fields = {
      order_amount: "100000",
      merchant: "MERCHANT_123",
      currency: "VND",
      operation: "PURCHASE",
      order_description: "Payment for order #12345",
      order_invoice_number: "INV_20231201_001",
      success_url: "https://example.com/payment/success",
      error_url: "https://example.com/payment/error",
      cancel_url: "https://example.com/payment/cancel",
    };
    const signedString =
      "order_amount=100000,merchant=MERCHANT_123,currency=VND,operation=PURCHASE,order_description=Payment for order #12345,order_invoice_number=INV_20231201_001,success_url=https://example.com/payment/success,error_url=https://example.com/payment/error,cancel_url=https://example.com/payment/cancel";
    const expectedSignature = crypto
      .createHmac("sha256", "test-secret")
      .update(signedString)
      .digest("base64");

    expect(signSepayCheckoutFields(fields)).toBe(expectedSignature);
  });
});
