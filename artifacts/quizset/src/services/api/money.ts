/**
 * Paise <-> rupee conversion helpers.
 *
 * PAISE/RUPEE MISMATCH (documented per the task brief): the Drizzle schema
 * stores every money column as integer paise — `courses.mrpPaise` /
 * `salePaise`, `live_tests.pricePaise`, `payments.totalPaise` (see
 * `lib/db/src/schema/*.ts`) — to avoid floating-point rounding in Postgres.
 * The frontend `types.ts` shapes (`Course.mrp`/`sale`, `LiveTest.price`,
 * `Transaction.amount`) are plain `number` fields that `services/mock.ts`
 * always treated as rupees directly (e.g. `mrp: data.mrp ?? 0`, then
 * displayed via `formatRupees()` in `lib/format.ts`).
 *
 * Resolved at this API-client boundary: convert rupees -> paise right
 * before every write, and paise -> rupees right after every read, so
 * nothing above this file (pages, or anything shaped like mock.ts's
 * callers) ever has to know paise exist.
 *
 * One exception, NOT a mismatch: `chatbot_configs.priceRupeesPerMonth` is
 * rupees on the backend too (its name says so, and its frontend type field
 * `ChatbotConfig.priceRupeesPerMonth` matches exactly) — no conversion
 * happens for that field, see `services/api/chatbot.ts`.
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
