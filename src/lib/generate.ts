import { supabase } from "@/integrations/supabase/client";

export type Kind = "cards" | "mcq";

/** Next unprocessed chunk ids for a domain (or all). */
export async function pendingChunks(kind: Kind, domain: number | null, limit: number) {
  let q = supabase.from("chunks").select("id").eq(kind === "cards" ? "cards_done" : "mcq_done", false).order("created_at").order("idx").limit(limit);
  if (domain) q = q.eq("domain", domain);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((r) => r.id);
}

export type Coverage = Record<number, { total: number; cards: number; mcq: number; cardCount: number; qCount: number }>;

export async function fetchCoverage(): Promise<Coverage> {
  const cov: Coverage = {};
  for (let d = 1; d <= 5; d++) cov[d] = { total: 0, cards: 0, mcq: 0, cardCount: 0, qCount: 0 };
  const count = async (table: "chunks" | "cards" | "questions", d: number, extra?: "cards_done" | "mcq_done") => {
    let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("domain", d);
    if (extra) q = q.eq(extra, true);
    const { count } = await q;
    return count ?? 0;
  };
  await Promise.all([1, 2, 3, 4, 5].map(async (d) => {
    const [total, cards, mcq, cardCount, qCount] = await Promise.all([
      count("chunks", d), count("chunks", d, "cards_done"), count("chunks", d, "mcq_done"), count("cards", d), count("questions", d),
    ]);
    cov[d] = { total, cards, mcq, cardCount, qCount };
  }));
  return cov;
}
