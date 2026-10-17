import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./run-id.server";

export type AskSource = { n: number; documentId: string; title: string; section: number; domain: number; excerpt: string };
export type AskMetadata = { sources?: AskSource[] };

const STOP = new Set("the a an and or of to in on for is are was what which how why when who does do i me my it this that with be can should about explain tell".split(" "));

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function handleAsk(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return json(401, "Please sign in again.");
  const userId = userData.user.id;

  const body = (await request.json()) as { messages?: UIMessage<AskMetadata>[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json(400, "No question received.");
  const question = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
  if (!question) return json(400, "No question received.");

  // Retrieve relevant book sections with keyword search (OR of meaningful terms)
  const terms = question.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  let sources: AskSource[] = [];
  if (terms.length) {
    const { data, error } = await supabase.rpc("search_chunks", { q: terms.join(" or "), n: 6 });
    if (error) console.error("search_chunks", error);
    sources = (data ?? []).map((r, i) => ({ n: i + 1, documentId: r.document_id, title: r.title, section: r.idx + 1, domain: r.domain, excerpt: r.content.slice(0, 220) }));
    var contexts = (data ?? []).map((r, i) => `[S${i + 1}] "${r.title}", Section ${r.idx + 1} (CISA Domain ${r.domain})\n${r.content}`);
  }
  const ctx = typeof contexts !== "undefined" && contexts.length ? contexts.join("\n\n---\n\n") : "No matching sections were found in the candidate's books.";

  const instructions = `You are a CISA exam tutor. Answer the candidate's question using ONLY the study material excerpts below from their own books.
- Cite every claim with the source tag in square brackets, e.g. [S1] or [S2][S4].
- Explain from the IS auditor's perspective and note how it might be tested on the exam when useful.
- If the excerpts don't cover the question, say so clearly, give a brief general answer marked "(not from your books)", and suggest what to look up.
- Use concise markdown.

STUDY MATERIAL:
${ctx}`;

  // Save the user's message before streaming
  const { error: saveErr } = await supabase.from("chat_messages").insert({ user_id: userId, msg_id: last.id, role: "user", parts: last.parts as never });
  if (saveErr) console.error("save user msg", saveErr);

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI is not configured.");
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] },
    },
  } as Parameters<typeof streamText>[0]);

  const response = result.toUIMessageStreamResponse<UIMessage<AskMetadata>>({
    originalMessages: messages,
    sendReasoning: true,
    messageMetadata: ({ part }) => (part.type === "start" ? { sources } : undefined),
    onFinish: async ({ responseMessage }) => {
      const { error } = await supabase.from("chat_messages").insert({
        user_id: userId, msg_id: responseMessage.id, role: "assistant",
        parts: responseMessage.parts as never, metadata: (responseMessage.metadata ?? { sources }) as never,
      });
      if (error) console.error("save assistant msg", error);
    },
    onError: (err) => {
      console.error("ask stream", err);
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 402) return "AI credits have run out. Add credits in Settings → Plans & credits.";
      if (status === 429) return "Too many requests right now — please wait a moment and try again.";
      return "Sorry, the answer couldn't be generated. Please try again.";
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
