import { useEffect, useState } from 'react';
import { Save, Send, Sparkles } from 'lucide-react';
import { Alert, Badge, Button, Card, Field, PageHeader, Tabs } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { chatbotConfigService, chatbotUsageService, paymentService, ApiError } from '@/services/api';
import { ChatbotConfig } from '@/types';
import { formatRupees } from '@/lib/format';

type Msg = { from: 'ai' | 'user'; text: string };

/** The actual chat UI — used by both the student page and the coaching's own
 * preview in Settings. Talks to the real `POST /api/chatbot/chat` endpoint —
 * the server enforces limits/config and persists history, so this component
 * only needs to reflect `usage` back from each reply, not track it itself. */
function ChatPanel({ suggestions, onUsage }: { suggestions: string[]; onUsage?: (used: number) => void }) {
  const [messages, setMessages] = useState<Msg[]>([{ from: 'ai', text: "Hi! I'm here to help you choose your next best study move. Ask me about a weak topic, your plan, or an exam strategy." }]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async (value?: string) => {
    const current = (value ?? text).trim();
    if (!current) return;
    setText('');
    setMessages((x) => [...x, { from: 'user', text: current }]);
    setLoading(true);
    // Reserve the reply's slot up front and append each streamed token to it
    // in place, so the student sees the answer arrive word-by-word instead
    // of waiting for the whole thing then getting it all at once.
    let started = false;
    try {
      const usage = await chatbotConfigService.chat(current, (chunk) => {
        setLoading(false);
        setMessages((x) => {
          if (!started) {
            started = true;
            return [...x, { from: 'ai', text: chunk }];
          }
          const next = [...x];
          next[next.length - 1] = { from: 'ai', text: next[next.length - 1].text + chunk };
          return next;
        });
      });
      onUsage?.(usage.used);
    } catch (err) {
      const message = err instanceof ApiError ? (err.data as { error?: string })?.error ?? err.message : err instanceof Error ? err.message : 'Kuch galat ho gaya, dobara koshish karein.';
      if (started) {
        setMessages((x) => [...x.slice(0, -1), { from: 'ai', text: message }]);
      } else {
        setMessages((x) => [...x, { from: 'ai', text: message }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="chat-card">
      <div className="chat-head">
        <div className="ai-avatar">
          <Sparkles size={17} />
        </div>
        <div>
          <b>QuizSet companion</b>
          <small>Focused on your progress</small>
        </div>
        <Badge tone="success">Online</Badge>
      </div>
      <div className="messages">
        {messages.map((m, i) => (
          <div className={`message ${m.from}`} key={i}>
            <span>{m.text}</span>
          </div>
        ))}
        {loading && (
          <div className="message ai">
            <span className="typing">
              Thinking<span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </div>
        )}
      </div>
      <div className="prompt-list inline">
        {suggestions.map((p) => (
          <button key={p} onClick={() => send(p)}>
            <Sparkles size={12} /> {p}
          </button>
        ))}
      </div>
      <div className="chat-compose">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask about Percentage, your plan…" />
        <Button onClick={() => send()}>
          <Send size={15} />
        </Button>
      </div>
    </Card>
  );
}

const SUGGESTIONS = ['Give me a shortcut for Percentage', "Why is Percentage my weak topic?", 'What should I do today?'];

/** Student side — gated entirely by what the coaching configured. */
export function StudentAI() {
  const { user, tenant, tenantId, toast } = useApp();
  const [config, setConfig] = useState<ChatbotConfig | null>(null);
  const [usage, setUsage] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!tenantId || !user) return;
    chatbotConfigService.get(tenantId).then(setConfig);
    chatbotUsageService.get(tenantId, user.id).then((u) => setUsage(u.messageCount));
    // hasPurchased() is a synchronous stub that always returns false (see
    // its own comment in payments.ts) — using it here made a real chatbot
    // purchase look unpurchased forever. hasPurchasedAsync() is the real,
    // server-backed check.
    paymentService.hasPurchasedAsync(user.id, 'chatbot', tenantId).then(setUnlocked);
  }, [tenantId, user]);

  if (!config || !user || !tenantId) return null;

  if (!config.enabled) {
    return (
      <>
        <PageHeader eyebrow="Study companion" title="AI Doubt Assistant" description={`${tenant.name} hasn't turned this on yet.`} />
        <Alert tone="warning">Ask your coaching to enable the AI assistant from their settings.</Alert>
      </>
    );
  }

  const remainingFree = Math.max(0, config.freeMessageLimit - usage);
  const overFreeLimit = usage >= config.freeMessageLimit;
  const needsPayment = overFreeLimit && config.priceRupeesPerMonth > 0 && !unlocked;
  const overHardCap = usage >= config.monthlyMessageCap;

  const unlock = async () => {
    await paymentService.purchase({ tenantId, studentId: user.id, kind: 'chatbot', refId: tenantId, label: 'AI Doubt Assistant', amount: config.priceRupeesPerMonth });
    setUnlocked(true);
    toast('Chatbot unlocked', `You now have access for the rest of this month.`);
  };

  return (
    <>
      <PageHeader eyebrow="Study companion" title="AI Doubt Assistant" description="Ask about a weak topic, a shortcut, or your study plan." action={<Badge tone={remainingFree > 3 || unlocked ? 'success' : 'warning'}>{unlocked ? 'Unlocked' : `${remainingFree} free left`}</Badge>} />
      {overHardCap ? (
        <Alert tone="danger">You've reached this month's message limit. It resets next month.</Alert>
      ) : needsPayment ? (
        <Card>
          <div className="card-title">
            <div>
              <h2>Free messages used up</h2>
              <p>Unlock unlimited access (up to the monthly cap) for {formatRupees(config.priceRupeesPerMonth)}/month.</p>
            </div>
          </div>
          <Button onClick={unlock}>
            <Save size={14} /> Unlock for {formatRupees(config.priceRupeesPerMonth)}
          </Button>
        </Card>
      ) : (
        <ChatPanel suggestions={SUGGESTIONS} onUsage={setUsage} />
      )}
    </>
  );
}

/** Coaching side — real settings (provider, price, limits) plus a live preview of the same chat experience. */
export function ChatbotSettings() {
  const { tenantId, toast } = useApp();
  const [tab, setTab] = useState('settings');
  const [form, setForm] = useState<ChatbotConfig | null>(null);

  useEffect(() => {
    if (tenantId) chatbotConfigService.get(tenantId).then(setForm);
  }, [tenantId]);

  if (!form || !tenantId) return null;

  const save = async () => {
    await chatbotConfigService.save(tenantId, form);
    toast('Chatbot settings saved', form.enabled ? 'Students can now use the AI assistant.' : 'The assistant is currently off for students.');
  };

  return (
    <>
      <PageHeader eyebrow="AI Assistant" title="Chatbot settings" description="Configure the assistant your students see — your API key stays server-side once a real backend is connected." />
      <Tabs tabs={[{ value: 'settings', label: 'Settings' }, { value: 'preview', label: 'Preview chat' }]} value={tab} onChange={setTab} />
      {tab === 'settings' ? (
        <Card>
          <label className="task" style={{ marginBottom: 16 }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            <span>Enable the AI assistant for students</span>
          </label>
          <div className="form-grid">
            <Field label="Provider">
              <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as ChatbotConfig['provider'] })}>
                <option>OpenAI</option>
                <option>Gemini</option>
                <option>Claude</option>
              </select>
            </Field>
            <Field label="Price (₹/month)">
              <input className="form-input" value={form.priceRupeesPerMonth} onChange={(e) => setForm({ ...form, priceRupeesPerMonth: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Free messages before paywall">
              <input className="form-input" value={form.freeMessageLimit} onChange={(e) => setForm({ ...form, freeMessageLimit: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Hard monthly cap per student">
              <input className="form-input" value={form.monthlyMessageCap} onChange={(e) => setForm({ ...form, monthlyMessageCap: Number(e.target.value) || 1 })} />
            </Field>
          </div>
          <Field label="System prompt">
            <textarea className="form-input" value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} placeholder="You are a friendly study assistant for..." />
          </Field>
          <div className="form-actions">
            <Button onClick={save}>
              <Save size={14} /> Save settings
            </Button>
          </div>
        </Card>
      ) : (
        <ChatPanel suggestions={SUGGESTIONS} />
      )}
    </>
  );
}
