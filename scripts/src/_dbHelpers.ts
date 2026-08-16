// Shared helpers for the local CLI scripts the platform owner runs on their
// own machine to get Claude-generated questions into a coaching's course.
// Unlike the sibling repo (quiz-ITI), which talks to Supabase's client SDK
// with a service-role key, QuizSet already has a real Postgres connection
// via @workspace/db (Drizzle) — these scripts reuse that directly instead of
// inventing a second DB-access path.

import { and, asc, eq, ilike } from "drizzle-orm";
import { db, courses, tenants } from "@workspace/db";

/** Tiny `--flag value` / `--flag=value` / `--flag` parser — no CLI-arg
 * dependency needed for a handful of scripts. */
export function parseArgs(argv: string[]): { args: Record<string, string | true>; positional: string[] } {
  const args: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      args[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      args[body] = argv[++i];
    } else {
      args[body] = true;
    }
  }
  return { args, positional };
}

export function die(err: Error): never {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
}

/**
 * Resolves `--coaching <partial name>` + `--course <partial name>` to real
 * DB rows, so the platform owner never has to hunt down a UUID by hand.
 * Case-insensitive substring match; throws with the available options
 * listed when the match is missing or ambiguous — matching the pattern
 * quiz-ITI's resolveExam() already established for this exact workflow.
 */
export async function resolveCourse(
  coachingRef: string | undefined,
  courseRef: string | undefined,
): Promise<{ tenantId: string; tenantName: string; courseId: string; courseName: string; questionBankId: string | null }> {
  if (!coachingRef) throw new Error("--coaching <naam ka hissa> chahiye");
  if (!courseRef) throw new Error("--course <naam ka hissa> chahiye");

  const tenantMatches = await db.select().from(tenants).where(ilike(tenants.name, `%${coachingRef}%`));
  if (tenantMatches.length === 0) {
    const all = await db.select({ name: tenants.name }).from(tenants).orderBy(asc(tenants.name));
    throw new Error(
      `Coaching "${coachingRef}" nahi mili. Available:\n` + all.map((t) => `  - ${t.name}`).join("\n"),
    );
  }
  if (tenantMatches.length > 1) {
    throw new Error(
      `"${coachingRef}" se ek se zyada coaching match hui:\n` +
        tenantMatches.map((t) => `  - ${t.name}`).join("\n"),
    );
  }
  const tenant = tenantMatches[0];

  const scoped = await db
    .select()
    .from(courses)
    .where(and(eq(courses.tenantId, tenant.id), ilike(courses.name, `%${courseRef}%`)));
  if (scoped.length === 0) {
    const allForTenant = await db.select({ name: courses.name }).from(courses).where(eq(courses.tenantId, tenant.id));
    throw new Error(
      `"${tenant.name}" me course "${courseRef}" nahi mila. Available:\n` +
        (allForTenant.length ? allForTenant.map((c) => `  - ${c.name}`).join("\n") : "  (koi course nahi)"),
    );
  }
  if (scoped.length > 1) {
    throw new Error(`"${courseRef}" se ek se zyada course match hue:\n` + scoped.map((c) => `  - ${c.name}`).join("\n"));
  }
  const course = scoped[0];

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    courseId: course.id,
    courseName: course.name,
    questionBankId: course.questionBankId,
  };
}
