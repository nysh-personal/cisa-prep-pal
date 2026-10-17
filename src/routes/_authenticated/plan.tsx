import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildPlan, daysUntil, EXAM_DATE, type PlanChunk } from "@/lib/plan";
import { domainById } from "@/lib/domains";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Circle, Flag, Timer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({ meta: [{ title: "Study plan — CISA Coach" }, { name: "description", content: "Daily CISA revision schedule balanced across all five domains." }, { property: "og:title", content: "Study plan — CISA Coach" }, { property: "og:description", content: "Daily CISA revision schedule balanced across all five domains." }] }),
  component: PlanPage,
});

const localDate = (d: Date) => d.toLocaleDateString("en-CA");
type Row = PlanChunk & { content: string; document_id: string; title: string };

function PlanPage() {
  const qc = useQueryClient();
  const today = localDate(new Date());
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["plan-chunks"],
    queryFn: async () => {
      const [docs, out] = [await supabase.from("documents").select("id, title"), [] as Row[]];
      const titles = Object.fromEntries((docs.data ?? []).map((d) => [d.id, d.title]));
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("chunks").select("id, domain, idx, studied_at, content, document_id").order("idx").range(from, from + 999);
        if (error) throw error;
        out.push(...data.map((c) => ({ ...c, studied_at: c.studied_at ? localDate(new Date(c.studied_at)) : null, title: titles[c.document_id] ?? "" })));
        if (data.length < 1000) break;
      }
      return out;
    },
  });

  async function toggle(c: Row) {
    const { error } = await supabase.from("chunks").update({ studied_at: c.studied_at ? null : new Date().toISOString() }).eq("id", c.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["plan-chunks"] });
  }

  const left = daysUntil(today);
  const plan = rows ? buildPlan(rows, today) : [];
  const total = rows?.length ?? 0;
  const done = rows?.filter((r) => r.studied_at).length ?? 0;
  const todayPlan = plan[0];
  const todayDone = todayPlan?.chunks.filter((c) => c.studied_at).length ?? 0;

  const perDomain = [1, 2, 3, 4, 5].map((d) => {
    const s = rows?.filter((r) => r.domain === d) ?? [];
    return { d, total: s.length, done: s.filter((r) => r.studied_at).length };
  });

  return (
    <div>
      <header className="bg-hero px-5 pb-6 pt-8 text-primary-foreground">
        <Link to="/home" className="inline-flex items-center gap-1 text-sm text-primary-foreground/70"><ArrowLeft className="h-4 w-4" />Home</Link>
        <h1 className="mt-2 text-3xl font-bold">Study plan</h1>
        <p className="mt-1 text-primary-foreground/75">
          {left > 0 ? `${left} day${left === 1 ? "" : "s"} until your exam on 7 Nov` : left === 0 ? "Exam day — good luck!" : "Exam date has passed"}
        </p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm"><span>{done} of {total} sections studied</span><span>{total ? Math.round((done / total) * 100) : 0}%</span></div>
          <Progress value={total ? (done / total) * 100 : 0} className="h-2 bg-primary-foreground/20" />
        </div>
      </header>

      {rows && total === 0 && (
        <p className="m-5 rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">Add books in the Library and your daily plan will appear here.</p>
      )}

      {total > 0 && (
        <div className="p-5">
          <div className="grid grid-cols-5 gap-2">
            {perDomain.map(({ d, total: t, done: dn }) => (
              <div key={d} className="rounded-xl bg-card p-2 text-center shadow-card">
                <p className="text-xs font-semibold text-muted-foreground">D{d}</p>
                <p className="font-display text-lg font-bold">{t ? Math.round((dn / t) * 100) : 0}%</p>
                <p className="text-[10px] text-muted-foreground">{dn}/{t}</p>
              </div>
            ))}
          </div>

          {todayPlan && (
            <section className="mt-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">Today</h2>
                {todayPlan.kind === "study" && <span className="text-sm text-muted-foreground">{todayDone}/{todayPlan.chunks.length} done</span>}
              </div>
              {todayPlan.kind === "study" ? (
                todayPlan.chunks.length === 0 ? <p className="mt-2 text-sm text-success">Everything is studied — use Practice and Cards to reinforce.</p> : (
                  <div className="mt-3 space-y-2">
                    {todayPlan.chunks.map((c) => {
                      const r = c as Row;
                      return (
                        <div key={r.id} className={cn("rounded-xl bg-card p-3 shadow-card", r.studied_at && "opacity-70")}>
                          <div className="flex items-start gap-3">
                            <button onClick={() => toggle(r)} aria-label={r.studied_at ? "Mark not studied" : "Mark studied"} className="mt-0.5">
                              {r.studied_at ? <Check className="h-6 w-6 rounded-full bg-success p-1 text-success-foreground" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
                            </button>
                            <button onClick={() => setOpen(open === r.id ? null : r.id)} className="min-w-0 flex-1 text-left">
                              <p className="text-xs font-semibold text-muted-foreground">D{r.domain} · {domainById(r.domain).short}</p>
                              <p className="truncate text-sm font-medium">{r.title} · Section {r.idx + 1}</p>
                              <p className={cn("mt-1 text-sm text-muted-foreground", open === r.id ? "max-h-96 overflow-y-auto whitespace-pre-wrap" : "line-clamp-2")}>{r.content}</p>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : <SpecialDay kind={todayPlan.kind} />}
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-xl font-semibold">Upcoming</h2>
            <div className="mt-3 space-y-2">
              {plan.slice(1, showAll ? undefined : 8).map((day) => {
                const counts = [1, 2, 3, 4, 5].map((d) => day.chunks.filter((c) => c.domain === d).length);
                return (
                  <div key={day.date} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-card">
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">{new Date(day.date + "T00:00").toLocaleDateString("en", { weekday: "short" })}</p>
                      <p className="font-display text-lg font-bold">{new Date(day.date + "T00:00").getDate()}</p>
                    </div>
                    {day.kind === "study" ? (
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{day.chunks.length} sections</p>
                        <p className="text-xs text-muted-foreground">{counts.map((n, i) => (n ? `D${i + 1}×${n}` : null)).filter(Boolean).join(" · ") || "Free day"}</p>
                      </div>
                    ) : <p className="flex-1 text-sm font-medium">{day.kind === "mock" ? "Full mock exam" : day.kind === "review" ? "Light review & rest" : "CISA exam day"}</p>}
                  </div>
                );
              })}
            </div>
            {plan.length > 8 && <button onClick={() => setShowAll(!showAll)} className="mt-3 w-full text-center text-sm text-primary">{showAll ? "Show less" : `Show all ${plan.length - 1} days`}</button>}
            <p className="mt-4 text-xs text-muted-foreground">The plan re-balances every day: fall behind and the remaining sections spread across the days left; get ahead and later days get lighter.</p>
          </section>
        </div>
      )}
    </div>
  );
}

function SpecialDay({ kind }: { kind: "mock" | "review" | "exam" | "study" }) {
  if (kind === "mock") return (
    <Link to="/exam" className="mt-3 flex items-center gap-3 rounded-xl bg-accent p-4 text-accent-foreground"><Timer className="h-6 w-6" /><span className="font-medium">Mock exam day — take a full 150-question exam →</span></Link>
  );
  if (kind === "review") return (
    <Link to="/cards" className="mt-3 block rounded-xl bg-card p-4 shadow-card"><p className="font-medium">Light review</p><p className="text-sm text-muted-foreground">Flip through cards you haven't marked as known, then rest well.</p></Link>
  );
  return <div className="mt-3 flex items-center gap-3 rounded-xl bg-card p-4 shadow-card"><Flag className="h-6 w-6 text-accent" /><p className="font-medium">Exam day ({EXAM_DATE}). You've got this.</p></div>;
}
