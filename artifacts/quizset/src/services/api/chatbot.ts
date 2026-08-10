import type { ChatbotConfig } from '@/types';
import { apiGet, apiPut } from './http';

// `chatbot_configs` (lib/db/src/schema/chatbot.ts) matches the frontend
// `ChatbotConfig` type field-for-field, INCLUDING `priceRupeesPerMonth`
// already being rupees on the backend too — no naming/units mismatch here,
// unlike courses/live-tests/payments. See money.ts's top comment.
//
// ROUTE NOTE: the real routes (artifacts/api-server/src/routes/chatbot.ts)
// are `GET`/`PUT /api/chatbot/config/:tenantId` — singular "config", nested
// under `/chatbot`, and `PUT` (not `POST`) for the upsert. `chatbot.ts` also
// exposes `usage`/`messages` sub-resources that mock.ts's
// `chatbotConfigService` has no counterpart for (no `chatbotUsageService`/
// `chatbotMessageService` exists in mock.ts), so — matching this file's
// "same shape as mock.ts" contract — they're intentionally not built here.

export const chatbotConfigService = {
  async get(tenantId: string): Promise<ChatbotConfig> {
    // The route itself already returns mock.ts's exact default-shape object
    // when no row exists yet for this tenant (see `DEFAULT_CONFIG` in
    // `chatbot.ts`) — no client-side fallback needed here, unlike most
    // other `get()`s in this client.
    return apiGet<ChatbotConfig>(`/api/chatbot/config/${tenantId}`);
  },

  async save(tenantId: string, data: Partial<ChatbotConfig>): Promise<ChatbotConfig> {
    return apiPut<ChatbotConfig>(`/api/chatbot/config/${tenantId}`, data);
  },
};
