import type { ChatbotConfig } from '@/types';
import { apiGet, apiPost, apiPostStream, apiPut } from './http';

export type ChatUsage = { used: number; freeLimit: number; cap: number; isPaid: boolean };

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

  /** The real AI call — `POST /api/chatbot/chat`, streamed as server-sent
   * events. Server does the config/usage-limit checks, calls the LLM, and
   * persists both sides of the exchange; the client sends the raw message
   * and gets each token via `onToken` as it arrives, then the final usage
   * once the reply is complete. Throws if the stream reports an error
   * (e.g. a limit/config rejection) — same as a normal ApiError elsewhere. */
  async chat(message: string, onToken: (chunk: string) => void): Promise<ChatUsage> {
    const res = await apiPostStream('/api/chatbot/chat', { message });
    if (!res.body) throw new Error('No response stream from the server.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = JSON.parse(trimmed.slice('data:'.length).trim()) as
          | { chunk: string }
          | { error: string }
          | { done: true; usage: ChatUsage };
        if ('error' in payload) throw new Error(payload.error);
        if ('chunk' in payload) onToken(payload.chunk);
        if ('done' in payload) return payload.usage;
      }
    }
    throw new Error('Stream ended without a usage summary.');
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
