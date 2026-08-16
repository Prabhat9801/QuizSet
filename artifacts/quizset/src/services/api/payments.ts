import type { Transaction } from '@/types';
import { apiGet, apiPost } from './http';
import { paiseToRupees } from './money';

type PaymentApiRow = {
  id: string;
  tenantId: string;
  studentProfileId: string;
  kind: Transaction['kind'];
  refId: string;
  label: string;
  totalPaise: number;
  platformSharePaise: number;
  coachingSharePaise: number;
  status: Transaction['status'];
  createdAt: string;
};

function mapPayment(row: PaymentApiRow): Transaction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    studentId: row.studentProfileId,
    kind: row.kind,
    refId: row.refId,
    label: row.label,
    amount: paiseToRupees(row.totalPaise),
    status: row.status,
    createdAt: row.createdAt,
  };
}

type CreateOrderResponse = {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  razorpayKeyId: string;
};

// Razorpay's Checkout widget is a browser global (`window.Razorpay`) loaded
// from their own script — not an npm package, per Razorpay's own integration
// docs. Loaded lazily (only when a purchase is actually attempted) rather
// than as a static <script> tag in index.html, since most page loads never
// trigger a payment.
let razorpayScriptPromise: Promise<void> | null = null;
function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve();
  }
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the Razorpay checkout script.'));
      document.head.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

interface RazorpayInstance {
  open(): void;
}
interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}

export const paymentService = {
  /**
   * Real Razorpay flow: create-order (server looks up the actual price and
   * creates a real order) -> open Razorpay's own Checkout widget -> on
   * success, verify (server independently checks the signature and only
   * then marks the payment Success + computes the commission split). There
   * is no client-side "just tell the server it succeeded" step anymore —
   * see artifacts/api-server/src/routes/payments.ts's file-top comment for
   * why that was removed.
   *
   * `input.amount`/`input.studentId`/`input.tenantId` are NOT sent to
   * create-order — the server re-derives all of that from `kind`/`refId`
   * (see resolvePurchase() server-side) specifically so a client can't
   * assert its own price. They're kept as parameters here only because
   * existing call sites (StudentCourseLibrary.tsx, AI.tsx) already pass a
   * `label` for a friendly toast/receipt line before the real amount comes
   * back from the server.
   */
  async purchase(input: { tenantId: string; studentId: string; kind: Transaction['kind']; refId: string; label: string; amount: number }): Promise<Transaction> {
    void input.amount; // display-only hint from the caller; the server computes the real amount.
    const order = await apiPost<CreateOrderResponse>('/api/payments/create-order', { kind: input.kind, refId: input.refId });

    await loadRazorpayCheckout();

    const verified = await new Promise<{ ok: boolean; payment: PaymentApiRow }>((resolve, reject) => {
      const Razorpay = (window as unknown as { Razorpay: RazorpayConstructor }).Razorpay;
      const rzp = new Razorpay({
        key: order.razorpayKeyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: 'QuizSet',
        description: input.label,
        prefill: {},
        handler: (response: RazorpaySuccessResponse) => {
          apiPost<{ ok: boolean; payment: PaymentApiRow }>('/api/payments/verify', {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
            .then(resolve)
            .catch(reject);
        },
        modal: {
          ondismiss: () => reject(new Error('Payment was cancelled.')),
        },
      });
      rzp.open();
    });

    return mapPayment(verified.payment);
  },

  /**
   * SHAPE MISMATCH, not units/naming — flagged as its own case: mock.ts's
   * `hasPurchased()` is SYNCHRONOUS (it reads localStorage directly, no
   * await). A real lookup is inherently async, so this can't be a byte-for-
   * byte drop-in with identical behavior. Kept as a stub that always
   * returns `false` so the file still exports something under the exact
   * mock.ts name/signature; `hasPurchasedAsync()` below is the real
   * implementation. Any call site that needs the real answer must be
   * migrated to it when this client is actually wired in — that migration
   * touches page files, out of scope for this change.
   */
  hasPurchased(studentId: string, kind: Transaction['kind'], refId: string): boolean {
    void studentId;
    void kind;
    void refId;
    return false;
  },

  /**
   * `GET /api/payments` has no `kind`/`refId`/`studentId` query filters —
   * for a student caller it always returns every one of their own payments
   * (the server infers the student from the JWT), so the kind/refId/status
   * filtering mock.ts did in-memory happens client-side here instead.
   */
  async hasPurchasedAsync(studentId: string, kind: Transaction['kind'], refId: string): Promise<boolean> {
    const rows = await apiGet<PaymentApiRow[]>('/api/payments');
    return rows.some(
      (r) => r.studentProfileId === studentId && r.kind === kind && r.refId === refId && r.status === 'Success',
    );
  },

  async list(tenantId?: string): Promise<Transaction[]> {
    const rows = await apiGet<PaymentApiRow[]>('/api/payments', tenantId ? { tenantId } : undefined);
    return rows.map(mapPayment);
  },
};
