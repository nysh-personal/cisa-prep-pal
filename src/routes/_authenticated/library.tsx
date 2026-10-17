import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractText, chunkText } from "@/lib/extract";
import { classifyText } from "@/lib/domains";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Library — CISA Coach" }, { name: "description", content: "Upload your CISA PDFs and ebooks." }, { property: "og:title", content: "Library — CISA Coach" }, { property: "og:description", content: "Upload your CISA PDFs and ebooks." }] }),
  component: Library,
});

function Library() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<{ msg: string; pct: number } | null>(null);
  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await supabase.from("documents").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        setProg({ msg: `Opening ${file.name}`, pct: 0 });
        const text = await extractText(file, (msg, pct) => setProg({ msg, pct: pct * 70 }));
        const chunks = chunkText(text);
        if (!chunks.length) throw new Error(`No readable text in ${file.name} (scanned PDFs aren't supported)`);
        const { data: doc, error } = await supabase.from("documents").insert({ title: file.name.replace(/\.[^.]+$/, ""), chunk_count: chunks.length }).select().single();
        if (error) throw error;
        for (let i = 0; i < chunks.length; i += 50) {
          const rows = chunks.slice(i, i + 50).map((content, j) => ({ document_id: doc.id, idx: i + j, content, domain: classifyText(content) }));
          const { error: e2 } = await supabase.from("chunks").insert(rows);
          if (e2) throw e2;
          setProg({ msg: `Saving sections ${Math.min(i + 50, chunks.length)} / ${chunks.length}`, pct: 70 + (30 * (i + 50)) / chunks.length });
        }
        toast.success(`${file.name}: ${chunks.length} sections added`);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    setProg(null);
    if (input.current) input.current.value = "";
    qc.invalidateQueries();
  }

  async function remove(id: string) {
    if (!confirm("Delete this book and everything generated from it?")) return;
    await supabase.from("documents").delete().eq("id", id);
    qc.invalidateQueries();
  }

  return (
    <div className="p-5 pt-10">
      <h1 className="text-3xl font-bold">Library</h1>
      <p className="mt-1 text-sm text-muted-foreground">Add PDFs or EPUBs. Files are read on your phone; only the text is saved.</p>

      <input ref={input} type="file" accept=".pdf,.epub,.txt" multiple className="hidden" onChange={(e) => handle(e.target.files)} />
      <button disabled={!!prog} onClick={() => input.current?.click()} className="mt-5 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-card p-8 disabled:opacity-60">
        <Upload className="h-7 w-7 text-accent" />
        <span className="font-medium">Add study material</span>
        <span className="text-xs text-muted-foreground">PDF · EPUB · TXT</span>
      </button>

      {prog && (
        <div className="mt-4 rounded-xl bg-card p-4 shadow-card">
          <p className="mb-2 text-sm">{prog.msg}</p>
          <Progress value={prog.pct} />
        </div>
      )}

      <div className="mt-6 space-y-2">
        {docs?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-card">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <Link to="/library/$docId" params={{ docId: d.id }} className="min-w-0 flex-1">
              <p className="truncate font-medium">{d.title}</p>
              <p className="text-xs text-primary">{d.chunk_count} sections · Review domains →</p>
            </Link>
            <Button size="icon" variant="ghost" onClick={() => remove(d.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
