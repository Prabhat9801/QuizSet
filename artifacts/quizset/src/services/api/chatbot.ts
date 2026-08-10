import type { ChatbotConfig } from '@/types';
import { apiGet, apiPost, apiPut } from './http';

export type ChatReply = {
  reply: string;
  usage: { used: number; freeLimit: number; cap: number; isPaid: boolean };
};

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

  /** The real AI call — `POST /api/chatbot/chat`. Server does the config/
   * usage-limit checks, calls the LLM, and persists both sides of the
   * exchange; the client just sends the raw message and gets a reply back. */
  async chat(message: string): Promise<ChatReply> {
    return apiPost<ChatReply>('/api/chatbot/chat', { message });
  },
};

export type ChatbotUsage = { studentProfileId: string; tenantId: string; periodMonth: string; messageCount: number; isPaid: boolean };

function currentPeriodMonth(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM' — matches the api-server route's convention
}

export const chatbotUsageService = {
  async get(tenantId: string, studentProfileId: string): Promise<ChatbotUsage> {
    return apiGet<ChatbotUsage>('/api/chatbot/usage', { tenantId, studentProfileId, periodMonth: currentPeriodMonth() });
  },
};
