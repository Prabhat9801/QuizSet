# Platform Owner Guide — Coaching se Requirement Aane Par Kya Karna Hai

Ye guide un-technical platform-owner-workflow ke liye hai: jab koi coaching
naye course/exam ke liye questions maangti hai, VS Code + Claude Code use
karke poora kaam kaise complete karna hai — request dekhna se lekar course
students ko live dikhne tak.

---

## 🚀 SIRF EK PROMPT — Claude Khud Sab Kar Dega

Roz-roz manual steps follow karne ki zaroorat nahi. VS Code me is QuizSet
project ko kholo, Claude Code chalu karo, aur neeche wala **poora prompt
copy-paste kar do** (kisi specific coaching/course ka naam bhar ke, ya
khaali chhod do to Claude khud pehli pending request uthayega). Claude
khud request padhega, syllabus/notes dekhega, questions generate karega,
validate + seed karega, aur status update karega — aapko sirf beech-beech
me confirm karna hoga (jaise "haan ye questions theek hain, aage badho").

```
Tum ek QuizSet platform-owner assistant ho. Is repo (QuizSet) me ek
pending question-bank request ko poora end-to-end handle karo.

=== VARIABLES (yahan bhar do, jo pata hai wahi; baaki khaali chhod do) ===
Coaching:           [YAHAN COACHING KA NAAM DAALO, ya khaali chhodo]
Course:             [YAHAN COURSE KA NAAM DAALO, ya khaali chhodo]
Syllabus file path: [agar syllabus file kisi specific jagah rakhi hai, uska path]
Extra credentials:  [agar koi naya API key/access chahiye is baar (jaise koi
                     alag storage/service), yahan naam=value daalo — normal
                     kaam ke liye kuch nahi chahiye, DATABASE_URL already
                     artifacts/api-server/.env me hai]
Extra notes:        [koi bhi khaas instruction is specific request ke liye]
===========================================================================

Follow ye poora process khud:

1. artifacts/api-server/src/routes/question-bank-requests.ts aur
   lib/db/src/schema/question-bank-requests.ts padho taaki schema samajh
   sako. Phir live database se (DATABASE_URL artifacts/api-server/.env
   me hai) pending question_bank_requests dekho — agar coaching/course
   naam diya hai to wahi match karo, nahi to sabse purani "Pending"
   request uthao. Mujhe uska poora detail dikhao (coaching, course,
   subjects, questionsRequired, difficulty, unitsTopics, syllabusFileName)
   aur confirm karo ki yehi request process karni hai.

2. Agar request me syllabusFileName diya hai, mujhse poochho ki wo file
   kahan rakhi hai (ya agar coaching ne unitsTopics text me hi likh diya
   hai, wahi use karo). Us syllabus/notes se units aur topics ka breakdown
   nikaalo.

3. Har unit/topic ke liye khud MCQ questions generate karo — poore
   questionsRequired count tak, requested difficulty ke hisaab se, aur
   requested subjects cover karte hue. Har question ka correctIndex
   options (A/B/C/D) pe cycle karo — sab ek hi option pe mat jhukao. Har
   question ke saath ek chhota explanation bhi likho.

4. In questions ko is exact JSON format me likho, ek folder me (per-topic
   alag file, jaise scratch/seed/<topic-slug>.json):
   { "unitName": "...", "topicName": "...",
     "questions": [{ "question": "...", "options": ["...","...","...","..."],
     "correctIndex": 0-3, "explanation": "..." }, ...] }

5. `pnpm --filter @workspace/scripts run seed-questions -- --coaching
   "<naam>" --course "<naam>" --dir <folder> --dry-run` chalao. Result
   mujhe dikhao (kitne naye, kitne duplicate, koi error/answer-skew
   warning) — mujhse confirm lo ki insert kar dena hai.

6. Confirm milne par wahi command bina --dry-run ke chalao, taaki
   questions genuinely database me chale jaayein.

7. Jis question_banks row me ye gaye (course.questionBankId se pata
   chalega), uska status database me check karo — agar abhi
   "Generating" hai, mujhe bata do aur poochho kya "Platform Review" me
   badalna hai (ye status app ke UI se badalna safe hai; agar main
   seedhe DB se badalne ko kahoon, tabhi karo, warna sirf bata do ki
   app me jaake ye status khud badal loon).

8. Aakhir me ek chhota summary do: kitne questions, kaunse topics, kya
   review ke liye ready hai, aur agla step kya hai (mujhe app me jaake
   kya karna hai).

Har step ke beech, agar kuch ambiguous ho (naam match na ho, syllabus
file na mile, request hi na mile), rukna aur mujhse poochna — khud guess
karke aage mat badhna.
```

**Bas itna hi karna hai** — poora upar wala process manual reference/troubleshooting
ke liye neeche bhi likha hai, agar kabhi step-by-step khud karna ho ya
Claude ke bina samajhna ho ki peeche kya ho raha hai.

---

## Poora Flow — Ek Nazar Me (Manual/Reference)

```
1. Coaching request bharti hai (app me)
        |
        v
2. Aap (platform owner) app me request dekhte ho
        |
        v
3. VS Code + Claude Code khol ke questions generate karte ho
        |
        v
4. seed-questions script se questions database me daalte ho
        |
        v
5. App me jaake bank ka status review karte ho (Platform Review)
        |
        v
6. Coaching ko dikhta hai (Coaching Review) — wo edit kar sakti hai
        |
        v
7. Coaching "Finalized" karti hai
        |
        v
8. Coaching course "Publish" karti hai — STUDENTS KO DIKHNE LAGTA HAI
```

---

## Step 1 — Request Dekhna

App me login karo (platform owner account se) → **Question Requests** page
(`/platform/question-requests`).

Yahan dikhega:
- Kaunsi coaching ne maanga
- Kaunsa course/exam ke liye
- Kitne questions chahiye
- Subjects, difficulty
- Agar coaching ne syllabus file upload ki hai, wo bhi milegi
- Agar coaching ne khud units/topics likh diye hain, wo bhi dikhega

**Yahi se pura pata chal jaata hai ki kya generate karna hai.**

---

## Step 2 — VS Code + Claude Code Khol ke Questions Generate Karna

Apna QuizSet project VS Code me kholo (`c:\Users\ACER\Desktop\QuizSet`),
Claude Code chalu karo.

### Claude ko exactly kya bolna hai

Claude ko prompt do jisme ye sab included ho:
- Subject/exam ka naam
- Kaunsa unit/topic
- Kitne questions chahiye
- Difficulty level
- **Output format bilkul ye wala JSON hona chahiye** (neeche diya hai)

**Example prompt:**

> "SSC CGL 2026 ke liye 'Percentage' topic (Quantitative Aptitude unit) pe
> 50 MCQ questions banao, Medium difficulty. Har question ka answer
> alag-alag option (A/B/C/D) pe cycle karo, sirf ek option pe mat jhukao.
> Output isi JSON format me do — koi extra text nahi, sirf JSON:
>
> ```json
> {
>   "unitName": "Quantitative Aptitude",
>   "topicName": "Percentage",
>   "questions": [
>     {
>       "question": "...",
>       "options": ["...", "...", "...", "..."],
>       "correctIndex": 0,
>       "explanation": "..."
>     }
>   ]
> }
> ```
> "

Claude ka output ek `.json` file me save kar lo (jaise `percentage.json`),
ek folder me (jaise `~/quizset-seed/ssc-cgl/`).

**Zaroori baatein:**
- Har question me **exactly 4 options** honi chahiye
- `correctIndex` 0, 1, 2, ya 3 hona chahiye (matlab A=0, B=1, C=2, D=3)
- `explanation` dena best practice hai (student ko turant samajh aaye)
- Agar bahut saare topics hain, har topic ki alag `.json` file bana lo — ek
  hi folder me sab daal do, script sabko ek saath process kar dega

---

## Step 3 — Questions Ko Database Me Daalna (seed-questions script)

Ye naya script hai (`scripts/src/seed-questions.ts`) jo Claude ke banaye
JSON files ko ek saath database me daal deta hai — ek-ek karke app me
type karne ki zaroorat nahi.

### Pehli baar chalane se pehle: `.env` check karo

`artifacts/api-server/.env` me `DATABASE_URL` hona chahiye (already set
hai — same file jisme Razorpay/OpenAI keys bhi hain).

### Command (dry-run se shuru karo — kuch insert nahi hoga, sirf check)

```
pnpm --filter @workspace/scripts run seed-questions -- \
  --coaching "Sunrise Academy" \
  --course "SSC CGL 2026" \
  --dir "C:\Users\ACER\quizset-seed\ssc-cgl\" \
  --dry-run
```

- `--coaching` — coaching ka naam (poora ya hissa, jaise "Sunrise" bhi chalega)
- `--course` — course ka naam (poora ya hissa)
- `--dir` — jahan Claude ki JSON files rakhi hain (sab `.json` files uthayega)
- `--dry-run` — sirf check karega, kuch database me nahi daalega

Ye output dega:
- Kitne naye questions milenge
- Kitne already exist karte hain (duplicate, skip ho jaayenge)
- Koi galat-format question hai to error dikhayega (kis file, kis number pe)
- Answer spread (A/B/C/D me kitna balance hai) — agar bahut skewed hai to
  warning dega

### Jab sab sahi lage, `--dry-run` hata ke asli run karo

```
pnpm --filter @workspace/scripts run seed-questions -- \
  --coaching "Sunrise Academy" \
  --course "SSC CGL 2026" \
  --dir "C:\Users\ACER\quizset-seed\ssc-cgl\"
```

Ab questions genuinely database me chale jaayenge, us course ke question
bank me.

### Ek file test karni ho (poora folder nahi)

```
pnpm --filter @workspace/scripts run seed-questions -- \
  --coaching "Sunrise" --course "SSC CGL" --file "percentage.json" --dry-run
```

### ⚠️ Important — Course ka pehle se question bank hona chahiye

Agar course ke paas abhi koi question bank nahi hai (coaching ne request
bhari hai lekin app me bank abhi link nahi hua), script ye error dega:

```
"X" ka abhi koi question bank nahi hai. Pehle app me ek Question Bank
Request banayein (ya CourseEdit se ek bank link karein).
```

Isko fix karne ke liye pehle app me jaake (ya coaching ki request se hi)
ek Question Bank record ban jaana chahiye us course ke against — normally
ye coaching ki request submit karne se hi ho jaata hai.

---

## Step 4 — App Me Jaake Review Karna

Script chalane ke baad, app me wapas jaao:
`/platform/question-banks/<bank-id>` (ya Question Banks list se dhoondo).

Bank ka status abhi `"Generating"` hoga (default). Ye chaar stages me
guzarta hai:

```
Generating         <- abhi yahi hoga, seedhe seed-questions script ke baad
     |                 (sirf aapko dikhta hai, coaching ko nahi)
     v
Platform Review    <- aap khud check karo (spelling, sahi answer, etc.)
     |
     v
Coaching Review    <- ab coaching ko dikhta hai, wo khud edit bhi kar sakti hai
     |
     v
Finalized           <- coaching approve kar chuki hai, course ab publish ho sakta hai
```

Jab aap satisfied ho jaao apne review se, status ko **"Platform Review" →
"Coaching Review"** me badal do — ab coaching ko dikhega apne dashboard me.

---

## Step 5 — Coaching Apna Kaam Karti Hai

Coaching apne dashboard se bank dekhegi, questions edit kar sakti hai
(agar kuch galat laga), aur satisfy hone par status **"Finalized"** kar
degi.

---

## Step 6 — Course Publish, Students Ko Dikhta Hai

Bank "Finalized" hone ke baad, coaching apna course "Draft" se "Published"
status me badal degi. **Isi waqt se students ko wo course dikhne lagta hai**
apni practice-library me — sab practice modes (Full/Topic-wise/Unit-wise/
Multi-unit/Custom/Practice Sets) turant available ho jaate hain, kyunki wo
sab seedhe questions ke `subject`/`unit`/`topic` columns se hi derive hote
hain — koi extra kaam nahi karna padta.

---

## Quick Reference — Poora Command Cheat-Sheet

```bash
# 1. Request dekho app me: /platform/question-requests

# 2. Claude se JSON generate karo, folder me save karo

# 3. Dry-run check karo
pnpm --filter @workspace/scripts run seed-questions -- \
  --coaching "<naam>" --course "<naam>" --dir "<folder path>" --dry-run

# 4. Asli insert
pnpm --filter @workspace/scripts run seed-questions -- \
  --coaching "<naam>" --course "<naam>" --dir "<folder path>"

# 5. App me status: Generating -> Platform Review

# 6. Coaching khud karegi: Coaching Review -> Finalized -> Course Publish
```

---

## Common Problems

| Problem | Fix |
|---|---|
| "Coaching X nahi mili" | Exact ya partial naam try karo, error message me saari coachings ki list milegi |
| "Course X nahi mila" | Error message me us coaching ke saare courses ki list milegi |
| "Question bank nahi hai" | Coaching ki request se bank link honi chahiye pehle |
| "options 4 nahi mile" | Claude ke output me kisi question me 4 se kam/zyada options hain — file fix karo |
| "correctIndex invalid" | 0-3 ke bahar koi value hai — Claude se dobara format confirm karwao |
| "mojibake hai" | Text me `Ã—` jaisi garbled characters hain — file encoding issue, UTF-8 me save karo |
| Answer spread warning | Zyada questions ek hi option (jaise sab "A") pe hain — Claude ko bolo answer position cycle kare |
