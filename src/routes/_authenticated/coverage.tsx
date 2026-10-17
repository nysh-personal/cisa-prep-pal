import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DOMAINS } from "@/lib/domains";
import { DomainPicker } from "@/components/DomainPicker";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coverage")({
  head: () => ({ meta: [{ title: "Coverage report — CISA Coach" }, { name: "description", content: "See which study sections have note cards and practice questions." }, { property: "og:title", content: "Coverage report — CISA Coach" }, { property: "og:description", content: "See which study sections have note cards and practice questions." }] }),
  component: Coverage,
});

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

type Filter = "all" | "gaps" | "nocards" | "nomcq";

function Coverage() {
  const [domain, setDomain] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("gaps");

  const { data, isLoading } = useQuery({
    queryKey: ["coverage-report"],
    queryFn: async () => {
      const [docs, chunks, cards, qs] = await Promise.all([
        supabase.from("documents").select("id, title"),
        fetchAll((a, b) => supabase.from("chunks").select("id, document_id, idx, domain, content, cards_done, mcq_done").order("idx").range(a, b)),
        fetchAll((a, b) => supabase.from("cards").select("chunk_id").range(a, b)),
        fetchAll((a, b) => supabase.from("questions").select("chunk_id").range(a, b)),
      ]);
      const tally = (rows: { chunk_id: string | null }[]) => rows.reduce<Record<string, number>>((m, r) => { if (r.chunk_id) m[r.chunk_id] = (m[r.chunk_id] ?? 0) + 1; return m; }, {});
      const cc = tally(cards), qc = tally(qs);
      const titles = Object.fromEntries((docs.data ?? []).map((d) => [d.id, d.title]));
      return chunks.map((c) => ({ ...c, title: titles[c.document_id] ?? "", cardCount: cc[c.id] ?? 0, qCount: qc[c.id] ?? 0 }));
    },
  });

  const rows = (data ?? []).filter((r) => domain == null || r.domain === domain);
  const hasCards = (r: (typeof rows)[number]) => r.cardCount > 0;
  const hasQs = (r: (typeof rows)[number]) => r.qCount > 0;
  const shown = rows.filter((r) =>
    filter === "all" ? true : filter === "nocards" ? !hasCards(r) : filter === "nomcq" ? !hasQs(r) : !hasCards(r) || !hasQs(r));

  const stats = DOMAINS.map((d) => {
    const s = (data ?? []).filter((r) => r.domain === d.id);
    return { d, total: s.length, full: s.filter((r) => hasCards(r) && hasQs(r)).length };
  });

  return (
    <div className="p-5 pt-8">
      <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Home</Link>
      <h1 className="mt-2 text-3xl font-bold">Coverage report</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every section of your books, and whether it has note cards and practice questions.</p>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {stats.map(({ d, total, full }) => {
          const pct = total ? Math.round((full / total) * 100) : 0;
          return (
            <button key={d.id} onClick={() => setDomain(domain === d.id ? null : d.id)}
              className={cn("rounded-xl border bg-card p-2 text-center shadow-card", domain === d.id && "border-primary ring-2 ring-primary/30")}>
              <p className="text-xs font-semibold text-muted-foreground">D{d.id}</p>
              <p className={cn("font-display text-lg font-bold", total && pct < 100 ? "text-destructive" : "text-success")}>{total ? `${pct}%` : "—"}</p>
              <p className="text-[10px] text-muted-foreground">{full}/{total}</p>
            </button>
          );
        })}
      </div>
      {stats.some((s) => s.total === 0) && data && data.length > 0 && (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm">
          No material at all for {stats.filter((s) => s.total === 0).map((s) => `Domain ${s.d.id}`).join(", ")} — add a book that covers it, or move sections there from the Library.
        </p>
      )}

      <div className="mt-5"><DomainPicker value={domain} onChange={setDomain} /></div>
      <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-xs font-medium">
        {([["gaps", "Gaps"], ["nocards", "No cards"], ["nomcq", "No MCQs"], ["all", "All"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("rounded-lg py-2", filter === k ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{isLoading ? "Loading…" : `${shown.length} of ${rows.length} sections`}</p>
      <div className="mt-2 space-y-2">
        {shown.slice(0, 300).map((r) => (
          <Link key={r.id} to="/library/$docId" params={{ docId: r.document_id }} className="block rounded-xl bg-card p-3 shadow-card">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{r.title} · Section {r.idx + 1}</span>
              <span className="shrink-0 font-semibold">D{r.domain}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm">{r.content}</p>
            <div className="mt-2 flex gap-2 text-xs">
              <Badge ok={hasCards(r)} label={`${r.cardCount} cards`} />
              <Badge ok={hasQs(r)} label={`${r.qCount} MCQs`} />
            </div>
          </Link>
        ))}
        {shown.length > 300 && <p className="text-center text-xs text-muted-foreground">Showing first 300 — pick a domain to narrow down.</p>}
        {!isLoading && rows.length > 0 && shown.length === 0 && <p className="mt-6 text-center text-sm text-success">No gaps here — fully covered.</p>}
        {!isLoading && !data?.length && <p className="mt-6 text-center text-sm text-muted-foreground">No study material yet. Add books in the Library.</p>}
      </div>
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", ok ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{label}
    </span>
  );
}
