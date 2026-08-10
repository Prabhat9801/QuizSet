import type { Transaction } from '@/types';
import { apiGet, apiPost } from './http';
import { paiseToRupees, rupeesToPaise } from './money';

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

/**
 * NAMING MISMATCH: `studentProfileId` (backend) vs `studentId` (frontend
 * `Transaction`) — same rename pattern as `attempts.ts`.
 * PAISE MISMATCH: `Transaction.amount` (frontend, rupees) vs `totalPaise`
 * (backend) — same money.ts boundary conversion as courses/live tests.
 * `platformSharePaise`/`coachingSharePaise` (the 50% commission split,
 * computed and stored server-side — see `payments.ts`'s own comment) have
 * no frontend `Transaction` field at all and are dropped when mapping —
 * mock.ts's `Transaction` never modeled a commission split, only the single
 * customer-facing `amount`.
 */
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

export const paymentService = {
  /**
   * `input.studentId` is NOT sent: `POST /api/payments` requires the caller
   * to already be role `student` and always uses `req.auth.userId` as the
   * payer, never a body field — the same "don't trust the client" rule as
   * `attemptService.save()`. The 50/50 platform/coaching commission split
   * is computed and stored server-side (see the route's own comment in
   * `payments.ts`), so it isn't sent either.
   */
  async purchase(input: {
    tenantId: string;
    studentId: string;
    kind: Transaction['kind'];
    refId: string;
    label: string;
    amount: number;
  }): Promise<Transaction> {
    const row = await apiPost<PaymentApiRow>('/api/payments', {
      tenantId: input.tenantId,
      kind: input.kind,
      refId: input.refId,
      label: input.label,
      totalPaise: rupeesToPaise(input.amount),
    });
    return mapPayment(row);
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
