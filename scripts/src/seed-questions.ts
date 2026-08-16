// Bulk-inserts Claude-generated questions into a coaching's course, for the
// platform owner's own local workflow: a coaching files a question-bank
// request -> the owner generates questions with Claude (in VS Code or
// wherever) into JSON files -> this script pushes them into Postgres in one
// shot, instead of the one-at-a-time `POST /api/questions` route the app UI
// uses (fine for a coaching editing a handful of questions, impractical for
// 50-500 at once).
//
// Usage:
//   pnpm --filter @workspace/scripts run seed-questions -- \
//     --coaching "Sunrise" --course "SSC CGL" --dir path/to/questions/ --dry-run
//
//   pnpm --filter @workspace/scripts run seed-questions -- \
//     --coaching "Sunrise" --course "SSC CGL" --file one.json
//
// Flags:
//   --coaching <partial name>   resolves the tenant
//   --course <partial name>     resolves the course (and its question bank)
//   --dir <path>                every *.json in a folder (non-recursive)
//   --file <path>                a single JSON file
//   --subject <name>            subject to stamp on inserted rows (default: course's own subject)
//   --dry-run                    validate and report, insert nothing
//   --json                       machine-readable output
//   --allow-dupes                skip the duplicate-text check
//
// Accepted JSON shapes (per file), matching the sibling repo's convention so
// the same Claude-generation prompts/output work unmodified:
//   { "questions": [ { question, options[4], correctIndex, explanation?, unit?, topic?, difficulty? }, ... ] }
//   [ { question, options[4], correctIndex, ... }, ... ]
// `unitName`/`topicName` at the file's top level are used as fallbacks for
// any question missing its own `unit`/`topic` — matches the per-topic-file
// layout the legacy question banks used.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, questionBanks, questions } from "@workspace/db";
import { die, parseArgs, resolveCourse } from "./_dbHelpers";

const INSERT_CHUNK = 300;
const VALID_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

// Markers of UTF-8 bytes that were decoded as Latin-1 somewhere upstream —
// e.g. "Ã—" where "×" belongs. Ported from quiz-ITI's seed-questions.mjs,
// which found this exact defect class in a real legacy bank.
const MOJIBAKE_MARKERS = ["Ã—", "â‰", "Î”", "Ã‚", "â€", "Â°"];

type RawQuestion = {
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  correct_index?: unknown;
  explanation?: unknown;
  unit?: unknown;
  unitName?: unknown;
  topic?: unknown;
  topicName?: unknown;
  difficulty?: unknown;
};

type NormalizedQuestion = {
  text: string;
  options: string[];
  answer: number;
  explanation: string;
  unit: string;
  topic: string;
  difficulty: (typeof VALID_DIFFICULTIES)[number];
};

function hasMojibake(q: NormalizedQuestion): boolean {
  const blob = `${q.text} ${q.options.join(" ")} ${q.explanation}`;
  return MOJIBAKE_MARKERS.some((m) => blob.includes(m));
}

function normalize(raw: RawQuestion, fallbackUnit: string, fallbackTopic: string): NormalizedQuestion {
  const rawDifficulty = String(raw.difficulty ?? "Medium").trim();
  const difficulty = (VALID_DIFFICULTIES as readonly string[]).includes(rawDifficulty)
    ? (rawDifficulty as (typeof VALID_DIFFICULTIES)[number])
    : "Medium";

  return {
    text: String(raw.question ?? "").trim(),
    options: Array.isArray(raw.options) ? raw.options.map((o) => String(o ?? "").trim()) : [],
    answer: Number(raw.correctIndex ?? raw.correct_index),
    explanation: String(raw.explanation ?? "").trim(),
    unit: String(raw.unit ?? raw.unitName ?? fallbackUnit).trim(),
    topic: String(raw.topic ?? raw.topicName ?? fallbackTopic).trim(),
    difficulty,
  };
}

function validate(q: NormalizedQuestion, label: string, allowMojibake: boolean): string | null {
  if (!q.text) return `${label}: question text khaali hai`;
  if (q.options.length !== 4) return `${label}: ${q.options.length} options mile, 4 chahiye`;
  if (q.options.some((o) => !o)) return `${label}: koi option khaali hai`;
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) {
    return `${label}: correctIndex "${q.answer}" invalid hai (0-3 hona chahiye)`;
  }
  if (!q.unit) return `${label}: unit khaali hai (--file/JSON me unit ya unitName dein)`;
  if (!q.topic) return `${label}: topic khaali hai (--file/JSON me topic ya topicName dein)`;
  if (!allowMojibake && hasMojibake(q)) {
    return `${label}: text me mojibake hai (jaise "Ã—" instead of "×") — file ko UTF-8 me theek karein`;
  }
  return null;
}

async function collectFiles(args: Record<string, string | true>): Promise<string[]> {
  if (typeof args.file === "string") return [path.resolve(args.file)];

  if (typeof args.dir !== "string") {
    throw new Error("--file ya --dir dein");
  }
  const dir = path.resolve(args.dir);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    throw new Error(`${dir} nahi mila.`);
  }
  const files = entries.filter((f) => f.toLowerCase().endsWith(".json")).sort();
  if (files.length === 0) throw new Error(`${dir} me koi .json file nahi mili`);
  return files.map((f) => path.join(dir, f));
}

async function main() {
  const { args } = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args["dry-run"]);
  const allowDupes = Boolean(args["allow-dupes"]);
  const asJson = Boolean(args.json);
  const log = (...m: unknown[]) => {
    if (!asJson) console.log(...m);
  };

  const coaching = typeof args.coaching === "string" ? args.coaching : undefined;
  const courseRef = typeof args.course === "string" ? args.course : undefined;
  const resolved = await resolveCourse(coaching, courseRef);

  log(`Target: ${resolved.tenantName} → ${resolved.courseName}`);
  if (dryRun) log("(dry run — kuch insert nahi hoga)\n");

  // A course must already have a question bank to seed into — this script
  // deliberately does NOT create one, since a bank's existence + status
  // (Generating/Platform Review/Coaching Review/Finalized) is a real
  // content-review pipeline the app UI drives; silently creating one here
  // would bypass that and leave the course pointing at a bank the coaching
  // never asked for.
  if (!resolved.questionBankId) {
    throw new Error(
      `"${resolved.courseName}" ka abhi koi question bank nahi hai. Pehle app me ek Question Bank Request ` +
        `banayein (ya CourseEdit se ek bank link karein), phir is script ko dobara chalayein.`,
    );
  }
  const [bank] = await db.select().from(questionBanks).where(eq(questionBanks.id, resolved.questionBankId)).limit(1);
  if (!bank) throw new Error(`Question bank ${resolved.questionBankId} nahi mila (dangling reference).`);

  const files = await collectFiles(args);

  const existingRows = await db
    .select({ text: questions.text })
    .from(questions)
    .where(eq(questions.questionBankId, bank.id));
  const existingTexts = new Set(existingRows.map((r) => r.text.trim()));
  if (!allowDupes) log(`Bank me pehle se ${existingTexts.size} unique questions hain.`);

  const toInsert: (typeof questions.$inferInsert)[] = [];
  const errors: string[] = [];
  let skippedExisting = 0;
  let skippedInBatch = 0;
  const seenInBatch = new Set<string>();

  for (const filePath of files) {
    const base = path.basename(filePath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(filePath, "utf-8"));
    } catch (err) {
      errors.push(`${base}: JSON parse fail — ${(err as Error).message}`);
      continue;
    }

    const list: RawQuestion[] = Array.isArray(parsed) ? parsed : ((parsed as { questions?: RawQuestion[] })?.questions ?? []);
    if (!Array.isArray(list) || list.length === 0) {
      errors.push(`${base}: koi question nahi mila`);
      continue;
    }
    const topLevel = Array.isArray(parsed) ? {} : (parsed as { unitName?: string; unit?: string; topicName?: string; topic?: string });
    const fallbackUnit = String(topLevel.unitName ?? topLevel.unit ?? "").trim();
    const fallbackTopic = String(topLevel.topicName ?? topLevel.topic ?? "").trim();

    let fileAdded = 0;
    list.forEach((raw, i) => {
      const label = `${base} #${i + 1}`;
      const q = normalize(raw, fallbackUnit, fallbackTopic);

      const problem = validate(q, label, Boolean(args["allow-mojibake"]));
      if (problem) {
        errors.push(problem);
        return;
      }

      const key = q.text.trim();
      if (!allowDupes && existingTexts.has(key)) {
        skippedExisting++;
        return;
      }
      if (!allowDupes && seenInBatch.has(key)) {
        skippedInBatch++;
        return;
      }
      seenInBatch.add(key);
      toInsert.push({
        questionBankId: bank.id,
        text: q.text,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        subject: typeof args.subject === "string" ? args.subject : bank.subject,
        unit: q.unit,
        topic: q.topic,
        difficulty: q.difficulty,
      });
      fileAdded++;
    });

    log(`  ${base}: ${fileAdded} naye`);
  }

  const spread = [0, 0, 0, 0];
  for (const q of toInsert) spread[q.answer]++;
  const skewed = toInsert.length > 0 && Math.max(...spread) > toInsert.length * 0.4;

  const summary = {
    tenant: resolved.tenantName,
    course: resolved.courseName,
    questionBankId: bank.id,
    filesRead: files.length,
    toInsert: toInsert.length,
    skippedExisting,
    skippedInBatch,
    errors,
    answerSpread: { A: spread[0], B: spread[1], C: spread[2], D: spread[3] },
    skewedAnswers: skewed,
    dryRun,
    inserted: 0,
  };

  log("");
  log(`Files read:        ${files.length}`);
  log(`Insert karne hain: ${toInsert.length}`);
  if (skippedExisting) log(`Skip (already in bank): ${skippedExisting}`);
  if (skippedInBatch) log(`Skip (duplicate in files): ${skippedInBatch}`);
  if (errors.length) {
    log(`\n⚠️  ${errors.length} question skip hue:`);
    for (const e of errors.slice(0, 25)) log(`   - ${e}`);
    if (errors.length > 25) log(`   … aur ${errors.length - 25}`);
  }
  if (toInsert.length) {
    log(`\nAnswer spread: A=${spread[0]} B=${spread[1]} C=${spread[2]} D=${spread[3]}`);
    if (skewed) log("⚠️  Answers ek hi option pe jhuke hain — generator me position cycle karwayein.");
  }

  if (dryRun || toInsert.length === 0) {
    log(dryRun ? "\nDry run khatam — insert nahi kiya." : "\nKuch insert karne ko nahi hai.");
    if (asJson) console.log(JSON.stringify(summary, null, 2));
    return;
  }

  log("");
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    await db.insert(questions).values(chunk);
    log(`  inserted ${Math.min(i + chunk.length, toInsert.length)}/${toInsert.length}`);
  }

  summary.inserted = toInsert.length;
  log(`\n✅ ${toInsert.length} questions "${resolved.courseName}" me add ho gaye.`);
  log(`   Bank status abhi "${bank.status}" hai — app me jaake review/status update karein.`);
  if (asJson) console.log(JSON.stringify(summary, null, 2));
}

main().catch(die);
