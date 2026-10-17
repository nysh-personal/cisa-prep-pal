import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DOMAINS } from "@/lib/domains";
import { daysUntil } from "@/lib/plan";
import { fetchCoverage, pendingChunks, type Kind } from "@/lib/generate";
import { generateCards, generateMcqs } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Sparkle, Square } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Dashboard — CISA Coach" }, { name: "description", content: "Your CISA domain coverage and AI generation." }, { property: "og:title", content: "Dashboard — CISA Coach" }, { property: "og:description", content: "Your CISA domain coverage and AI generation." }] }),
  component: Home,
});

function Home() {
  const qc = useQueryClient();
  const { data: cov } = useQuery({ queryKey: ["coverage"], queryFn: fetchCoverage });
  const genCards = useServerFn(generateCards);
  const genMcq = useServerFn(generateMcqs);
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const stop = useRef(false);

  async function run(kind: Kind, domain: number | null) {
    stop.current = false;
    setRunning(`${kind}-${domain ?? "all"}`);
    let made = 0;
    try {
      const ids = await pendingChunks(kind, domain, 500);
      if (!ids.length) { toast.info("Everything in this domain is already covered."); return; }
      for (let i = 0; i < ids.length && !stop.current; i++) {
        setStatus(`Section ${i + 1} of ${ids.length} · ${made} created`);
        const r = kind === "cards" ? await genCards({ data: { chunkId: ids[i] } }) : await genMcq({ data: { chunkId: ids[i] } });
        made += r.count;
        if (i % 3 === 2) qc.invalidateQueries({ queryKey: ["coverage"] });
      }
      toast.success(`Created ${made} ${kind === "cards" ? "note cards" : "questions"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(null); setStatus("");
      qc.invalidateQueries();
    }
  }

  const totalChunks = cov ? Object.values(cov).reduce((a, c) => a + c.total, 0) : 0;

  return (
    <div>
      <header className="bg-hero px-5 pb-8 pt-10 text-primary-foreground">
        <div className="flex items-center justify-between">
          <p className="text-sm text-primary-foreground/70">CISA Coach</p>
          <button onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut className="h-5 w-5 text-primary-foreground/70" /></button>
        </div>
        <h1 className="mt-3 text-3xl font-bold">Five domains.<br />Every topic covered.</h1>
        {running && (
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-primary-foreground/10 p-3 text-sm">
            <Sparkle className="h-4 w-4 animate-spin text-accent" />
            <span className="flex-1">{status || "Starting…"}</span>
            <Button size="sm" variant="secondary" onClick={() => (stop.current = true)}><Square className="mr-1 h-3 w-3" />Stop</Button>
          </div>
        )}
      </header>

      {cov && totalChunks === 0 && (
        <div className="m-5 rounded-2xl border border-dashed bg-card p-6 text-center">
          <p className="font-medium">Start by adding your study materials</p>
          <p className="mt-1 text-sm text-muted-foreground">PDF or EPUB — each section is sorted into a CISA domain.</p>
          <Button asChild className="mt-4"><Link to="/library">Open library</Link></Button>
        </div>
      )}

      {totalChunks > 0 && (
        <div className="mx-5 mt-5 grid grid-cols-2 gap-2">
          <Button disabled={!!running} onClick={() => run("cards", null)}>Cards for all</Button>
          <Button disabled={!!running} variant="secondary" onClick={() => run("mcq", null)}>MCQs for all</Button>
        </div>
      )}

      {totalChunks > 0 && (
        <Link to="/plan" className="mx-5 mt-5 flex items-center justify-between rounded-2xl bg-accent p-4 text-accent-foreground shadow-card">
          <span><span className="block text-xs font-semibold uppercase tracking-wider">Study plan</span><span className="font-display text-lg font-bold">Today's sections →</span></span>
          <span className="text-right text-sm">{daysUntil(new Date().toLocaleDateString("en-CA"))} days<br />to exam</span>
        </Link>
      )}

      {totalChunks > 0 && (
        <Link to="/coverage" className="mx-5 mt-3 block rounded-xl border bg-card p-3 text-center text-sm font-medium text-primary">View coverage report — find gaps →</Link>
      )}

      <div className="space-y-3 p-5">
        {DOMAINS.map((d) => {
          const c = cov?.[d.id];
          const pc = c && c.total ? Math.round((c.cards / c.total) * 100) : 0;
          const pq = c && c.total ? Math.round((c.mcq / c.total) * 100) : 0;
          return (
            <div key={d.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain {d.id} · {Math.round(d.weight * 100)}%</p>
                <p className="text-xs text-muted-foreground">{c?.total ?? 0} sections</p>
              </div>
              <h3 className="mt-1 text-lg font-semibold leading-snug">{d.name}</h3>
              <div className="mt-3 space-y-2 text-xs">
                <Row label={`Cards · ${c?.cardCount ?? 0}`} pct={pc} />
                <Row label={`Questions · ${c?.qCount ?? 0}`} pct={pq} />
              </div>
              {!!c?.total && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" disabled={!!running || pc === 100} onClick={() => run("cards", d.id)}>{pc === 100 ? "Cards done" : "Make cards"}</Button>
                  <Button size="sm" variant="outline" disabled={!!running || pq === 100} onClick={() => run("mcq", d.id)}>{pq === 100 ? "MCQs done" : "Make MCQs"}</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between"><span>{label}</span><span className="text-muted-foreground">{pct}% covered</span></div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
