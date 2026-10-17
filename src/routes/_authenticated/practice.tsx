import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DomainPicker } from "@/components/DomainPicker";
import { QuestionView, type Q } from "@/components/QuestionView";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — CISA Coach" }, { name: "description", content: "Practice CISA-style MCQs with explanations." }, { property: "og:title", content: "Practice — CISA Coach" }, { property: "og:description", content: "Practice CISA-style MCQs with explanations." }] }),
  component: Practice,
});

function Practice() {
  const [domain, setDomain] = useState<number | null>(null);
  const [q, setQ] = useState<(Q & { times_seen: number; times_correct: number }) | null | undefined>(undefined);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [score, setScore] = useState({ c: 0, n: 0 });

  const next = useCallback(async () => {
    setPicked(null); setReveal(false);
    // Prefer least-seen questions, randomised among them
    let base = supabase.from("questions").select("*").order("times_seen").limit(30);
    if (domain) base = base.eq("domain", domain);
    const { data } = await base;
    setQ(data && data.length ? data[Math.floor(Math.random() * data.length)] : null);
  }, [domain]);

  useEffect(() => { next(); setScore({ c: 0, n: 0 }); }, [next]);

  async function check() {
    if (q == null || picked == null) return;
    setReveal(true);
    const ok = picked === q.answer;
    setScore((s) => ({ c: s.c + (ok ? 1 : 0), n: s.n + 1 }));
    await supabase.from("questions").update({ times_seen: q.times_seen + 1, times_correct: q.times_correct + (ok ? 1 : 0) }).eq("id", q.id);
  }

  return (
    <div className="p-5 pt-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Practice</h1>
        <span className="text-sm text-muted-foreground">{score.c}/{score.n} correct</span>
      </div>
      <div className="mt-4"><DomainPicker value={domain} onChange={setDomain} /></div>
      <div className="mt-6">
        {q === undefined ? <p className="text-muted-foreground">Loading…</p>
          : q === null ? <p className="mt-10 text-center text-muted-foreground">No questions yet. Generate MCQs from Home.</p>
          : (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain {q.domain}</p>
              <QuestionView q={q} picked={picked} onPick={setPicked} reveal={reveal} />
              <Button className="mt-5 h-12 w-full" disabled={!reveal && picked == null} onClick={reveal ? next : check}>
                {reveal ? "Next question" : "Check answer"}
              </Button>
            </>
          )}
      </div>
    </div>
  );
}
