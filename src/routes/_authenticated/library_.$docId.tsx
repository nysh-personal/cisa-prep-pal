import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DOMAINS } from "@/lib/domains";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library_/$docId")({
  head: () => ({ meta: [{ title: "Sections — CISA Coach" }, { name: "description", content: "Review and re-sort book sections by CISA domain." }, { property: "og:title", content: "Sections — CISA Coach" }, { property: "og:description", content: "Review and re-sort book sections by CISA domain." }] }),
  component: Sections,
});

function Sections() {
  const { docId } = Route.useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["sections", docId],
    queryFn: async () => {
      const [doc, chunks] = await Promise.all([
        supabase.from("documents").select("title").eq("id", docId).single(),
        supabase.from("chunks").select("id, idx, domain, content").eq("document_id", docId).order("idx").limit(5000),
      ]);
      return { title: doc.data?.title ?? "", chunks: chunks.data ?? [] };
    },
  });

  async function move(chunkId: string, domain: number) {
    const results = await Promise.all([
      supabase.from("chunks").update({ domain }).eq("id", chunkId),
      supabase.from("cards").update({ domain }).eq("chunk_id", chunkId),
      supabase.from("questions").update({ domain }).eq("chunk_id", chunkId),
    ]);
    const err = results.find((r) => r.error)?.error;
    if (err) { toast.error(err.message); return; }
    toast.success(`Moved to Domain ${domain}`);
    qc.invalidateQueries();
  }

  const list = (data?.chunks ?? []).filter((c) => filter == null || c.domain === filter);

  return (
    <div className="p-5 pt-8">
      <Link to="/library" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Library</Link>
      <h1 className="mt-2 text-2xl font-bold leading-tight">{data?.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tap a domain number to move a section. Its cards and questions move with it.</p>

      <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
        {[null, 1, 2, 3, 4, 5].map((d) => (
          <button key={String(d)} onClick={() => setFilter(d)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium", filter === d ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
            {d == null ? `All (${data?.chunks.length ?? 0})` : `D${d} (${data?.chunks.filter((c) => c.domain === d).length ?? 0})`}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {list.map((c) => (
          <div key={c.id} className="rounded-2xl bg-card p-4 shadow-card">
            <p className="text-xs font-semibold text-muted-foreground">Section {c.idx + 1}</p>
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="mt-1 w-full text-left text-sm leading-relaxed">
              {open === c.id ? <span className="block max-h-80 overflow-y-auto whitespace-pre-wrap">{c.content}</span> : <span className="line-clamp-3">{c.content}</span>}
              <span className="mt-1 block text-xs text-primary">{open === c.id ? "Show less" : "Read more"}</span>
            </button>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {DOMAINS.map((d) => (
                <button key={d.id} title={d.name} onClick={() => c.domain !== d.id && move(c.id, d.id)}
                  className={cn("rounded-lg border py-2 text-xs font-semibold", c.domain === d.id ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
                  D{d.id}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{DOMAINS.find((d) => d.id === c.domain)?.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
