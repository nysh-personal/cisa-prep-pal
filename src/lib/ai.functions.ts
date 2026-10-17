import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DOMAIN_NAMES: Record<number, string> = {
  1: "Information Systems Auditing Process",
  2: "Governance and Management of IT",
  3: "IS Acquisition, Development and Implementation",
  4: "IS Operations and Business Resilience",
  5: "Protection of Information Assets",
};

async function callMiniMax(prompt: string): Promise<string> {
  const key = process.env["MINIMAX_API_KEY"];
  if (!key) throw new Error("MiniMax key is not configured");
  const res = await fetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "MiniMax-M2",
      messages: [
        { role: "system", content: "You are an expert ISACA CISA exam coach. Reply ONLY with a valid JSON array, no prose." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("MiniMax error", res.status, t);
    throw new Error(res.status === 429 ? "MiniMax rate limit reached — wait a moment and retry." : `MiniMax request failed (${res.status})`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; base_resp?: { status_msg?: string } };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(json.base_resp?.status_msg || "MiniMax returned no content");
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function parseArray(text: string): unknown[] {
  const s = text.indexOf("["), e = text.lastIndexOf("]");
  if (s === -1 || e === -1) throw new Error("AI reply was not JSON");
  const arr = JSON.parse(text.slice(s, e + 1));
  if (!Array.isArray(arr)) throw new Error("AI reply was not a list");
  return arr;
}

const input = z.object({ chunkId: z.string().uuid() });

export const generateCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: chunk, error } = await supabase.from("chunks").select("id, domain, content").eq("id", data.chunkId).single();
    if (error || !chunk) throw new Error("Section not found");
    const prompt = `CISA Domain ${chunk.domain}: ${DOMAIN_NAMES[chunk.domain]}.
From the study material below, write 6-10 revision note cards that together cover EVERY exam-relevant concept, definition, control, process step and "auditor's perspective" point in it. Skip anything not testable.
Each card: {"topic": short topic label, "front": a concise question or term, "back": a crisp answer (max 60 words) including why it matters to an IS auditor}.
Return a JSON array only.

MATERIAL:
${chunk.content}`;
    const items = parseArray(await callMiniMax(prompt));
    const rows = items
      .map((r) => r as { topic?: string; front?: string; back?: string })
      .filter((r) => r.front && r.back)
      .map((r) => ({ user_id: userId, chunk_id: chunk.id, domain: chunk.domain, topic: String(r.topic ?? ""), front: String(r.front), back: String(r.back) }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("cards").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    await supabase.from("chunks").update({ cards_done: true }).eq("id", chunk.id);
    return { count: rows.length };
  });

export const generateMcqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: chunk, error } = await supabase.from("chunks").select("id, domain, content").eq("id", data.chunkId).single();
    if (error || !chunk) throw new Error("Section not found");
    const prompt = `CISA Domain ${chunk.domain}: ${DOMAIN_NAMES[chunk.domain]}.
Write 5 original exam-style CISA multiple-choice questions based on the material below. Mirror ISACA style: scenario-based, from the IS auditor's viewpoint, often asking what is BEST, MOST important, PRIMARY or FIRST. Exactly 4 plausible options, one best answer. Spread questions across different concepts in the material.
Each item: {"stem": string, "options": [4 strings, no letter prefixes], "answer": index 0-3, "explanation": why the answer is best and why each distractor is weaker (max 90 words)}.
Return a JSON array only.

MATERIAL:
${chunk.content}`;
    const items = parseArray(await callMiniMax(prompt));
    const rows = items
      .map((r) => r as { stem?: string; options?: unknown; answer?: unknown; explanation?: string })
      .filter((r) => r.stem && Array.isArray(r.options) && r.options.length === 4 && Number(r.answer) >= 0 && Number(r.answer) <= 3)
      .map((r) => ({ user_id: userId, chunk_id: chunk.id, domain: chunk.domain, stem: String(r.stem), options: (r.options as unknown[]).map(String), answer: Number(r.answer), explanation: String(r.explanation ?? "") }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("questions").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    await supabase.from("chunks").update({ mcq_done: true }).eq("id", chunk.id);
    return { count: rows.length };
  });
