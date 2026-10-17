import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DOMAINS, examAllocation } from "@/lib/domains";
import { QuestionView, type Q } from "@/components/QuestionView";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/exam")({
  head: () => ({ meta: [{ title: "Mock exam — CISA Coach" }, { name: "description", content: "Timed 150-question CISA mock exam weighted by domain." }, { property: "og:title", content: "Mock exam — CISA Coach" }, { property: "og:description", content: "Timed 150-question CISA mock exam weighted by domain." }] }),
  component: Exam,
});

const DURATION = 4 * 60 * 60;
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]!; b[i] = b[j]!; b[j] = t; } return b; };

function Exam() {
  const [qs, setQs] = useState<Q[] | null>(null);
  const [ans, setAns] = useState<Record<number, number>>({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [result, setResult] = useState<null | { correct: number; total: number; by: Record<number, { c: number; n: number }> }>(null);
  const { data: history, refetch } = useQuery({ queryKey: ["attempts"], queryFn: async () => (await supabase.from("exam_attempts").select("*").order("created_at", { ascending: false }).limit(5)).data ?? [] });

  useEffect(() => {
    if (!qs || result) return;
    const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); submit(); return 0; } return l - 1; }), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, result]);

  async function start() {
    const alloc = examAllocation(150);
    const picked: Q[] = [];
    for (const d of DOMAINS) {
      const { data } = await supabase.from("questions").select("id, domain, stem, options, answer, explanation").eq("domain", d.id).limit(1000);
      picked.push(...shuffle(data ?? []).slice(0, alloc[d.id]));
    }
    if (picked.length < 10) { toast.error("You need at least 10 questions. Generate MCQs from Home first."); return; }
    if (picked.length < 150) toast.info(`Only ${picked.length} questions available — exam shortened.`);
    setQs(shuffle(picked)); setAns({}); setI(0); setLeft(Math.round(DURATION * picked.length / 150)); setResult(null);
  }

  const latest = useRef({ qs, ans });
  latest.current = { qs, ans };
  function submit() {
    const { qs: cur, ans: a } = latest.current;
    if (!cur) return;
    const by: Record<number, { c: number; n: number }> = {};
    let correct = 0;
    cur.forEach((q, k) => { const r = (by[q.domain] ??= { c: 0, n: 0 }); r.n++; if (a[k] === q.answer) { r.c++; correct++; } });
    setResult({ correct, total: cur.length, by });
    supabase.from("exam_attempts").insert({ total: cur.length, correct, by_domain: by }).then(() => refetch());
  }

  const fmt = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (result) {
    const pct = Math.round((result.correct / result.total) * 100);
    return (
      <div className="p-5 pt-10">
        <h1 className="text-3xl font-bold">Your result</h1>
        <div className="mt-5 rounded-3xl bg-hero p-6 text-primary-foreground">
          <p className="text-5xl font-bold font-display">{pct}%</p>
          <p className="mt-1 text-primary-foreground/75">{result.correct} of {result.total} correct · {pct >= 70 ? "On track to pass" : "Keep practising — aim for 70%+"}</p>
        </div>
        <div className="mt-5 space-y-3">
          {DOMAINS.map((d) => { const r = result.by[d.id]; if (!r) return null; const p = Math.round((r.c / r.n) * 100); return (
            <div key={d.id}><div className="mb-1 flex justify-between text-sm"><span>D{d.id} {d.short}</span><span>{r.c}/{r.n}</span></div><Progress value={p} /></div>
          ); })}
        </div>
        <Button className="mt-6 h-12 w-full" variant="outline" onClick={() => { setResult(null); setQs(null); }}>Review done</Button>
        <ReviewList qs={qs!} ans={ans} />
      </div>
    );
  }

  if (!qs) {
    return (
      <div className="p-5 pt-10">
        <h1 className="text-3xl font-bold">Mock exam</h1>
        <p className="mt-2 text-sm text-muted-foreground">150 questions in 4 hours, split by the official domain weights. Answers are revealed at the end.</p>
        <Button className="mt-6 h-12 w-full" onClick={start}>Start exam</Button>
        {!!history?.length && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Recent attempts</h2>
            {history.map((h) => (
              <div key={h.id} className="mt-2 flex justify-between rounded-xl bg-card p-4 text-sm shadow-card">
                <span>{new Date(h.created_at).toLocaleDateString()}</span>
                <span className="font-semibold">{Math.round((h.correct / h.total) * 100)}% · {h.correct}/{h.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const answered = Object.keys(ans).length;
  return (
    <div className="p-5 pt-8">
      <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between bg-background/95 px-5 py-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">Q {i + 1}/{qs.length} · {answered} answered</span>
        <span className={left < 600 ? "font-mono font-semibold text-destructive" : "font-mono font-semibold"}>{fmt(left)}</span>
      </div>
      <Progress value={(answered / qs.length) * 100} className="h-1" />
      <div className="mt-5"><QuestionView q={qs[i]!} picked={ans[i] ?? null} onPick={(o) => setAns({ ...ans, [i]: o })} reveal={false} /></div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-12" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
        {i < qs.length - 1
          ? <Button className="h-12" onClick={() => setI(i + 1)}>Next</Button>
          : <Button className="h-12" onClick={() => confirm(`Submit with ${answered}/${qs.length} answered?`) && submit()}>Submit</Button>}
      </div>
      <button className="mt-4 w-full text-center text-sm text-muted-foreground" onClick={() => confirm(`Submit now with ${answered}/${qs.length} answered?`) && submit()}>Finish early</button>
    </div>
  );
}

function ReviewList({ qs, ans }: { qs: Q[]; ans: Record<number, number> }) {
  const wrong = qs.map((q, k) => ({ q, k })).filter(({ q, k }) => ans[k] !== q.answer);
  if (!wrong.length) return null;
  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-lg font-semibold">Questions to review ({wrong.length})</h2>
      {wrong.map(({ q, k }) => <div key={q.id} className="rounded-2xl bg-card p-4 shadow-card"><QuestionView q={q} picked={ans[k] ?? null} onPick={() => {}} reveal /></div>)}
    </div>
  );
}
