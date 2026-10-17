import { describe, expect, it } from "vitest";
import { buildPlan, daysUntil, EXAM_DATE } from "@/lib/plan";

const mk = (n: number, domain: number) => Array.from({ length: n }, (_, i) => ({ id: `${domain}-${i}`, domain, idx: i, studied_at: null as string | null }));

describe("study plan", () => {
  it("targets the Nov 7 2026 exam", () => {
    expect(EXAM_DATE).toBe("2026-11-07");
    expect(daysUntil("2026-10-17")).toBe(21);
  });

  it("schedules every unstudied section before the last two days (mock + review)", () => {
    const chunks = [...mk(40, 1), ...mk(30, 4), ...mk(25, 5)];
    const plan = buildPlan(chunks, "2026-10-17");
    const study = plan.filter((d) => d.kind === "study");
    expect(study.reduce((n, d) => n + d.chunks.length, 0)).toBe(95);
    expect(plan.at(-1)!.kind).toBe("exam");
    expect(plan.at(-2)!.kind).toBe("review");
    expect(plan.at(-3)!.kind).toBe("mock");
    expect(study.at(-1)!.date).toBe("2026-11-04");
  });

  it("mixes domains within each day", () => {
    const plan = buildPlan([...mk(20, 1), ...mk(20, 2)], "2026-10-17");
    const first = plan[0]!.chunks.map((c) => c.domain);
    expect(new Set(first).size).toBe(2);
  });
});
