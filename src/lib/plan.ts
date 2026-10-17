// Study-plan scheduling (pure, testable).
export const EXAM_DATE = "2026-11-07";
/** Days before the exam reserved for no new sections: mock exam (−2) and light review (−1). */
export const RESERVED_DAYS = 2;

export type PlanChunk = { id: string; domain: number; idx: number; studied_at: string | null };
export type PlanDay = { date: string; kind: "study" | "mock" | "review" | "exam"; chunks: PlanChunk[] };

const DAY = 86400000;
export const toISO = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");

export function daysUntil(today: string, exam = EXAM_DATE) {
  return Math.round((parse(exam).getTime() - parse(today).getTime()) / DAY);
}

/** Interleave sections so each domain is spread evenly across the timeline, in book order within a domain. */
export function interleave(chunks: PlanChunk[]): PlanChunk[] {
  const byDomain = new Map<number, PlanChunk[]>();
  for (const c of chunks) byDomain.set(c.domain, [...(byDomain.get(c.domain) ?? []), c]);
  const keyed: { c: PlanChunk; k: number }[] = [];
  for (const list of byDomain.values()) {
    list.sort((a, b) => a.idx - b.idx);
    list.forEach((c, i) => keyed.push({ c, k: (i + 0.5) / list.length }));
  }
  return keyed.sort((a, b) => a.k - b.k || a.c.domain - b.c.domain).map((x) => x.c);
}

/**
 * Build the plan from today to the exam. Remaining (unstudied) sections are spread evenly
 * over the study days; sections already studied today stay on today's list.
 * The plan re-balances automatically if you fall behind or get ahead.
 */
export function buildPlan(all: PlanChunk[], today: string, exam = EXAM_DATE): PlanDay[] {
  const total = daysUntil(today, exam);
  if (total < 0) return [];
  const studyDays = Math.max(total - RESERVED_DAYS, total > 0 ? 1 : 0);
  const doneToday = all.filter((c) => c.studied_at && c.studied_at.slice(0, 10) === today);
  const remaining = interleave(all.filter((c) => !c.studied_at));
  const days: PlanDay[] = [];
  let cursor = 0;
  for (let i = 0; i <= total; i++) {
    const date = toISO(new Date(parse(today).getTime() + i * DAY));
    if (i === total) { days.push({ date, kind: "exam", chunks: [] }); continue; }
    if (i >= studyDays) { days.push({ date, kind: i === total - 1 && total >= 2 ? "review" : "mock", chunks: [] }); continue; }
    // Today's quota includes what was already finished today so the daily target stays stable.
    const pool = remaining.length - cursor + (i === 0 ? doneToday.length : 0);
    const quota = Math.ceil(pool / (studyDays - i));
    const take = i === 0 ? Math.max(quota - doneToday.length, 0) : quota;
    const chunks = remaining.slice(cursor, cursor + take);
    cursor += take;
    days.push({ date, kind: "study", chunks: i === 0 ? [...doneToday, ...chunks] : chunks });
  }
  return days;
}
