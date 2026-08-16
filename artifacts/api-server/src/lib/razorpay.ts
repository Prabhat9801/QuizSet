import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http-error";

// Deliberately plain `fetch` + Node's built-in `node:crypto` rather than the
// `razorpay` npm package — the whole surface this app needs (create one
// order, verify one signature) is two calls' worth of code, and avoiding the
// dependency keeps this file auditable end-to-end for a payment-security
// review. Ported from the working, previously-verified implementation in
// the sibling repo's Supabase Edge Functions
// (quiz-ITI/supabase/functions/{create-payment,verify-payment}/index.ts) —
// same HMAC-SHA256-over-"orderId|paymentId" scheme, same constant-time
// compare, adapted from Deno/Web-Crypto to Node's crypto module.

function requireRazorpayKeys(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpError(500, "Payments are not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  return { keyId, keySecret };
}

/** Creates a real Razorpay order for `amountPaise` (Razorpay's unit is
 * already paise for INR, so no conversion). `notes` are opaque metadata
 * Razorpay stores on the order and shows in their dashboard — useful for
 * manually reconciling a transaction, never trusted back as input. */
export async function createRazorpayOrder(
  amountPaise: number,
  notes: Record<string, string>,
): Promise<{ id: string; keyId: string }> {
  const { keyId, keySecret } = requireRazorpayKeys();

  let res: globalThis.Response;
  try {
    res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: amountPaise, currency: "INR", notes }),
    });
  } catch {
    throw new HttpError(502, "Could not reach Razorpay to create the order.");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(502, `Razorpay order creation failed: ${detail || res.statusText}`);
  }

  const order = (await res.json()) as { id?: string };
  if (!order.id) throw new HttpError(502, "Razorpay did not return an order id.");
  return { id: order.id, keyId };
}

/** Razorpay signs `${orderId}|${paymentId}` with HMAC-SHA256 using the key
 * secret; the client's Checkout callback hands back that signature, and
 * this is the one place that independently recomputes and compares it
 * (constant-time, via `timingSafeEqual`) rather than trusting the client's
 * claim that payment succeeded. */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = requireRazorpayKeys();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
