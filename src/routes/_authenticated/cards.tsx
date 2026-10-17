import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DomainPicker } from "@/components/DomainPicker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cards")({
  head: () => ({ meta: [{ title: "Note cards — CISA Coach" }, { name: "description", content: "Flip through AI note cards by CISA domain." }, { property: "og:title", content: "Note cards — CISA Coach" }, { property: "og:description", content: "Flip through AI note cards by CISA domain." }] }),
  component: Cards,
});

function Cards() {
  const [domain, setDomain] = useState<number | null>(null);
  const [onlyNew, setOnlyNew] = useState(true);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const { data: cards, refetch } = useQuery({
    queryKey: ["cards", domain, onlyNew],
    queryFn: async () => {
      let q = supabase.from("cards").select("*").order("created_at").limit(1000);
      if (domain) q = q.eq("domain", domain);
      if (onlyNew) q = q.eq("known", false);
      return (await q).data ?? [];
    },
  });
  useEffect(() => { setI(0); setFlipped(false); }, [domain, onlyNew]);

  const card = cards?.[i];
  async function mark(known: boolean) {
    if (!card) return;
    if (known) await supabase.from("cards").update({ known: true }).eq("id", card.id);
    setFlipped(false);
    if (known && onlyNew) { await refetch(); } else setI((x) => Math.min(x + 1, (cards?.length ?? 1) - 1));
  }

  return (
    <div className="p-5 pt-10">
      <h1 className="text-3xl font-bold">Note cards</h1>
      <div className="mt-4"><DomainPicker value={domain} onChange={setDomain} /></div>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={onlyNew} onCheckedChange={setOnlyNew} />Hide cards I know</label>

      {!card ? (
        <p className="mt-10 text-center text-muted-foreground">No cards here yet. Generate them from Home.</p>
      ) : (
        <>
          <p className="mt-5 text-xs text-muted-foreground">{i + 1} / {cards!.length} · Domain {card.domain}{card.topic ? ` · ${card.topic}` : ""}</p>
          <div className="mt-2 [perspective:1200px]" onClick={() => setFlipped((f) => !f)}>
            <div className={cn("flip-card relative h-80 w-full", flipped && "rotate-y-180")}>
              <div className="backface-hidden absolute inset-0 flex items-center justify-center rounded-3xl bg-card p-6 text-center shadow-card">
                <p className="font-display text-2xl leading-snug">{card.front}</p>
              </div>
              <div className="backface-hidden rotate-y-180 absolute inset-0 flex items-center overflow-y-auto rounded-3xl bg-primary p-6 text-primary-foreground shadow-card">
                <p className="leading-relaxed">{card.back}</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Tap card to flip</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12" onClick={() => mark(false)}>Review again</Button>
            <Button className="h-12" onClick={() => mark(true)}>Got it</Button>
          </div>
          <div className="mt-3 flex justify-between text-sm">
            <button disabled={i === 0} onClick={() => { setI(i - 1); setFlipped(false); }} className="text-muted-foreground disabled:opacity-40">← Previous</button>
            <button disabled={i >= cards!.length - 1} onClick={() => { setI(i + 1); setFlipped(false); }} className="text-muted-foreground disabled:opacity-40">Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
