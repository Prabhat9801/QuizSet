# MVP / Marketing-Launch Readiness — QuizSet — 2026-08-16

Ye QuizSet (`c:\Users\ACER\Desktop\QuizSet`) ke liye hai — **ye hi asli
launch/marketing wala product hai** (sibling repo `quiz-ITI` alag experiment
hai, isse mix na karein). Ye document poore codebase ke real survey (backend
routes, frontend services, `docs/PROJECT_HISTORY.md`, live-Supabase
verification logs) ke aadhar pe hai — sirf `CLAUDE.md` padh ke nahi, jo
outdated nikla (neeche note kiya hai).

> ✅ **Live-connection confirm kiya (2026-08-16)**: `api-server/.env` bana ke
> asli Supabase project (`zfzzutnskxjxkcdznblk`) se seedha connect karke
> verify kiya — **database live hai, poora schema (20 tables) already
> maujood hai**, aur `profiles` table me real data bhi hai. Matlab "backend
> ready hai" sirf design-level claim nahi — is session me khud connect karke
> confirm kiya gaya hai.

> ⚠️ **Pehla zaroori note**: Root `CLAUDE.md` khud stale hai — usme likha hai
> backend "actively being built" hai aur certificates/testimonials/revenue-split
> ko "planned, not yet built" bataya hai. Reality me ye sab **ban chuke hain
> aur live Supabase database ke against verify ho chuke hain** —
> `docs/PROJECT_HISTORY.md` real-time source-of-truth hai, `CLAUDE.md` nahi.

---

## ✅ Kya ban chuka hai aur REAL DATA se verify ho chuka hai

| Area | Status | Detail |
|---|---|---|
| Multi-tenant core | ✅ verified | `tenants` → `profiles` (role+tenantId) → `courses` → `questions`/`attempts`, real Supabase project pe schema push karke test kiya |
| Auth | ✅ real, verified | Supabase Auth — signup/login/password-reset (OTP), backend har request pe Supabase se JWT verify karta hai (`GET /auth/v1/user`) |
| Exam/Practice-Set creation | ✅ verified | `CourseCreate.tsx` wizard + `POST /api/courses`, live DB pe test |
| Question bank | ✅ verified, REAL DATA | Demo tenant me 9,603 + 5,100 = **14,703 real questions** (2 real source banks se) — placeholder/lorem-ipsum nahi |
| Practice quiz (6 modes) | ✅ verified | Full/Topic-wise/Unit-wise/Multi-unit/Custom/Practice-Sets, no-repeat tracking, opt-in timer (warn-only) |
| Live tests | ✅ verified | Scheduled, auto-submit timer, scope selection (full ya specific subject/unit/topic) |
| AI chatbot | ✅ **real OpenAI call**, mock nahi | `POST /api/chatbot/chat` — genuine streamed OpenAI response, usage-limit enforced, dono taraf ki baatcheet save hoti hai |
| Per-coaching branding | ✅ verified | Colour/logo/naam — turant reflect hota hai student ke session me bhi |
| Notifications | ✅ verified | Real `notifications` table, real action-points se trigger (payment, join, live-test-end, commission-trigger) |
| Commission/revenue-split ledger | ✅ verified (logic) | Pehla course 100% coaching, uske baad 50/50 — **server-side compute + store hota hai**, live demo data se confirm kiya |
| History/Review/Retry | ✅ verified | Course+mode filter, "Retry this quiz" (exact same questions), weak-topic surfacing |
| Certificates | ✅ built | Branded, "Powered by QuizSet" |
| Testimonials | ✅ built | Coaching → Platform do-step approval |

**Short version: feature-wise product bahut aage hai** — CLAUDE.md se bhi zyada
complete hai jitna wo document khud bolta hai.

---

## 🔌 Backend + Database — connection status (2026-08-16 verify)

| Cheez | Status |
|---|---|
| Supabase project | ✅ Live, exist karta hai (`zfzzutnskxjxkcdznblk`) |
| Schema | ✅ Poora pushed hai — 20 tables (`profiles`, `tenants`, `courses`, `questions`, `attempts`, `payments`, `notifications`, `live_tests`, `chatbot_*`, `testimonials`, `certificates`, `study_plans`, etc.) |
| Real data | ✅ `profiles` table me 3 rows already hain (demo tenant se) |
| `artifacts/api-server/.env` | ✅ Ab bana diya gaya (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`) — is machine par pehle nahi tha |
| `artifacts/quizset/.env` | ✅ Pehle se bhara hua tha (same project) |
| Dono `.env` files | ✅ `.gitignore` me hain, kabhi commit nahi hote |

**Seedha jawab: haan, backend aur database dono ready hain** — sirf code-level
nahi, balki abhi khud connect karke confirm kiya gaya hai.

> ⚠️ **Security note**: DB password aur OpenAI key is conversation me seedha
> paste kiye gaye the, jo permanently chat-history me reh jaate hain. Isliye:
> **OpenAI key ko turant rotate karo** (platform.openai.com/api-keys) aur
> **Supabase DB password badal do** jab convenient ho. Anon key + Project URL
> public-safe hain (frontend me already ship hote hain), unki chinta nahi.

---

## 🔴 LAUNCH-BLOCKING — real paisa/real users se pehle ye zaroor chahiye

Ye sabse important section hai — inme se koi bhi "chhota fix" nahi hai:

### 1. ✅ FIXED (2026-08-16) — Payment gateway ab real hai
Pehle `POST /api/payments` sirf ek DB row banata tha jo **client ne khud
bhej diya** (`totalPaise`, `status: "Success"` default) — koi
Razorpay/Stripe wired nahi tha.

**Ab real Razorpay flow hai:**
- `POST /api/payments/create-order` — server khud price nikalta hai
  (course/live-test/chatbot ki apni DB row se), ek real Razorpay order
  banata hai, `Pending` row save karta hai.
- Frontend Razorpay ka Checkout widget kholta hai (`checkout.razorpay.com`).
- `POST /api/payments/verify` — **YAHI EK JAGAH hai jaha payment "Success"
  ban sakta hai**: server khud HMAC-SHA256 signature recompute karke
  (constant-time compare) verify karta hai, tabhi commission-split compute
  hota hai aur access grant hota hai.
- Schema: `payments.provider`/`providerOrderId`/`providerPaymentId` add kiye,
  live DB pe push kar diya.
- `lib/razorpay.ts` (naya) — order-create + signature-verify, plain
  `node:crypto` + `fetch` se (koi extra npm dependency nahi).

⚠️ **Abhi Razorpay TEST keys chahiye** (`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`
`.env` me) taaki poora flow live test ho sake — code ready hai, keys milte
hi turant end-to-end verify kar sakte hain.

### 2. ✅ FIXED (2026-08-16) — Session/device-sharing protection
Pehle repo me khud documented tha (`PROJECT_HISTORY.md`, 2026-08-11 entry):
"a leaked/shared code is a real risk this project explicitly discussed and
decided NOT to solve with per-student verification." Koi session-limit,
device-binding nahi tha.

**Ab "ek account, ek waqt me ek hi device" enforce hota hai:**
- `profiles.activeSessionToken` column (live DB pe push kar diya)
- `POST /api/auth/claim-session` — har real login ke baad naya token set
  karta hai, jo bhi doosra device pehle se logged-in tha wo turant invalid
  ho jaata hai
- `authenticate` middleware har request pe token check karta hai
  (`X-Session-Token` header) — mismatch pe `401 SESSION_SUPERSEDED`
- Frontend: `AppContext` login ke baad claim karta hai (sirf genuine
  naye sign-in pe, background token-refresh pe nahi — warna apna hi
  doosra tab/device har ghante kick ho jaata), har 45s poll karta hai,
  aur kicked hone par login page pe explain karta hai kyun

**Known limitation (design se, bug nahi)**: Ye sirf "same waqt 2 log same
account use kar rahe hain" rokta hai — agar ek student login karke apna
password kisi ko de de (sequential handoff), koi bhi session-system ye
distinguish nahi kar sakta "owner ne khud device badla" vs "kisi aur ko de
diya".

### 3. ⏳ IN PROGRESS — Email, Gmail SMTP se fix ho raha hai
Password-reset aur signup-confirmation Supabase Auth ke default email se
jaate hain — koi custom SMTP configured nahi tha. Free-tier Supabase email
ka daily-send-limit bahut kam hai aur spam-folder me jaana common hai.

**Important: ye CODE change nahi hai.** Email-sending poori tarah Supabase
Auth khud karta hai (`supabase.auth.signUp()` /
`resetPasswordForEmail()` — dekhein `services/supabase.ts`) — is repo me
koi email-sending code hi nahi hai jo badalna ho. Fix Supabase
**Dashboard** me hai: Authentication → Emails → "Enable Custom SMTP",
Gmail App Password ke saath.

→ User Gmail account + App Password bana raha hai, Supabase dashboard me
khud configure karega. Note: Gmail SMTP ka bhi apna daily-limit (~500/din)
hai — chhoti coaching ke liye MVP ke liye theek hai, scale hone par
Resend/SendGrid jaisa dedicated transactional-email provider chahiye hoga.

### 4. **Zero automated tests**
Poore codebase me ek bhi `.test.ts`/`.spec.ts` nahi hai. Jo bhi verification
hui hai wo **manual** thi (typecheck/build + live-DB query se haath se check
karna) — koi regression-safety-net nahi hai. Agla feature add karte waqt purana
kuch tootne ka risk hai bina turant pata chale.
→ MVP ke liye critical nahi, lekin jaise-jaise feature badhenge, iske bina
bugs slip karte rahenge unnoticed.

### 5. ✅ CONFIRMED LIVE (2026-08-16) — https://quizset.onrender.com
Real health-check kiya gaya: `GET /api/healthz` → `200 {"status":"ok"}`.
`GET /api/profiles/me` (no auth) → `401 {"error":"Missing bearer token."}`
— exactly is repo ke `middlewares/auth.ts` jaisa hi. **Deployment genuinely
live hai aur is codebase ka hi hai.**

⚠️ **Lekin abhi PURANA build chal raha hai**: `POST /api/auth/claim-session`
aur `POST /api/payments/create-order` (dono is session me abhi-abhi add
kiye) live site pe `404` de rahe hain — matlab GitHub pe latest code
(`727f8dc`) push ho chuka hai, lekin Render ne abhi tak us commit se
redeploy nahi kiya. User Render dashboard se "Manual Deploy" trigger
karega — us `.env` me `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` bhi add
karna hoga taaki naya payment route kaam kare.

---

## ⚠️ Kam-urgent gaps (documented, jaanbujhkar chhoda gaya ya minor)

| Gap | Detail |
|---|---|
| PDF export | **Nahi bana** — sirf data-model me ek forward-looking comment hai ("future PDF export" ke liye), koi actual export function nahi |
| AI weak-topic detection | Chatbot sirf current-message se jawab deta hai, attempt-history se personalize nahi karta (explicitly cut) |
| Study-plan auto-generation | Bana hai, lekin simple even-spacing algorithm hai — "AI-personalized" nahi |
| Platform-wide charts | Recharts installed hai lekin use nahi ho raha — sab charts hand-made CSS bars hain |
| Support-ticket system | Explicitly cut, nahi banaya |
| Route guard 403 | Role-mismatch pe 403 page ke bajaye redirect kar deta hai |
| Demo/mock accounts ka password reset | Real accounts ke liye kaam karta hai, demo/mock accounts ke liye nahi (no real email hai unke paas) |

---

## 📋 Marketing/launch se pehle — priority order

```
🔴 MUST (paisa/real-user launch se pehle):
[x] Real payment gateway integrate karo — DONE (2026-08-16, code)
[x] Single-session/device-limit enforcement — DONE (2026-08-16, code)
[x] Live deployment confirm — DONE (2026-08-16), https://quizset.onrender.com
    live hai, healthz + auth dono verified
[ ] Render pe REDEPLOY trigger karo — GitHub pe latest code hai, Render
    abhi purana build serve kar raha hai (naye routes 404)
[ ] Render env vars me RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET add karo
    (test keys se shuru karo)
[ ] Supabase Dashboard → Auth → SMTP me Gmail App Password configure
    karo (in-progress, user khud kar raha hai)

🟡 SHOULD (launch ke turant baad, but soon):
[ ] Kam se kam critical-path automated tests (signup→payment→access)
[ ] PDF export (agar customers ise expect kar rahe hain)

🟢 LATER (feature backlog, launch-blocking nahi):
[ ] AI weak-topic detection (history-aware chatbot)
[ ] Platform-wide charts (Recharts already installed)
[ ] Support tickets
```

---

## Short answer (2026-08-16, updated)

**Feature-completeness ke hisaab se QuizSet bahut aage hai** — CLAUDE.md khud
jitna bolta hai usse zyada ban chuka hai, aur zyadatar cheezein sirf code nahi
balki **live Supabase data se verify** bhi ho chuki hain.

**Dono bade launch-blockers ab CODE-COMPLETE hain**: real Razorpay payment
gateway aur single-session/device-sharing protection — dono live database
pe push ho chuke hain aur GitHub pe committed/pushed hain.

**Live deployment bhi CONFIRMED hai** (https://quizset.onrender.com,
health-check verified) — lekin abhi **purana build** serve kar raha hai.
Asli MVP-launch ke liye ab sirf 3 chhote, non-code operational steps baaki
hain:
1. Render pe manual redeploy trigger karna (latest commit already GitHub pe hai)
2. Render env vars me Razorpay test keys add karna
3. Supabase dashboard me Gmail SMTP configure karna (in-progress)

Ye teeno "5 minute ka dashboard kaam" hain, koi naya code nahi likhna hai.
