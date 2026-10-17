import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { BookMarked, Loader2, Trash2 } from "lucide-react";

type Source = { n: number; documentId: string; title: string; section: number; domain: number; excerpt: string };
type AskMessage = UIMessage<{ sources?: Source[] }>;

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({ meta: [{ title: "Ask your books — CISA Coach" }, { name: "description", content: "Ask questions about your CISA study materials and get answers with section references." }, { property: "og:title", content: "Ask your books — CISA Coach" }, { property: "og:description", content: "Ask questions about your CISA study materials and get answers with section references." }] }),
  component: AskPage,
});

function AskPage() {
  const { data: history, refetch } = useQuery({
    queryKey: ["chat-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_messages").select("msg_id, role, parts, metadata").order("created_at").limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.msg_id, role: r.role as AskMessage["role"], parts: r.parts as AskMessage["parts"], metadata: (r.metadata ?? undefined) as AskMessage["metadata"] }));
    },
    staleTime: Infinity,
  });
  if (!history) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  return <Chat initial={history} onCleared={refetch} />;
}

function Chat({ initial, onCleared }: { initial: AskMessage[]; onCleared: () => void }) {
  const transport = useMemo(() => new DefaultChatTransport<AskMessage>({
    api: "/api/ask",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
  }), []);
  const { messages, sendMessage, status, stop, setMessages } = useChat<AskMessage>({
    id: "ask",
    messages: initial,
    transport,
    onError: (e) => {
      let msg = e.message;
      try { msg = JSON.parse(e.message).error ?? msg; } catch { /* plain text */ }
      toast.error(msg || "Network error — please try again.");
    },
  });
  const busy = status === "submitted" || status === "streaming";

  async function clear() {
    if (!confirm("Clear the whole conversation?")) return;
    const { error } = await supabase.from("chat_messages").delete().not("id", "is", null);
    if (error) return toast.error(error.message);
    setMessages([]); onCleared();
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-8">
        <div>
          <h1 className="text-2xl font-bold">Ask your books</h1>
          <p className="text-xs text-muted-foreground">Answers cite the sections they come from.</p>
        </div>
        {messages.length > 0 && <button onClick={clear} aria-label="Clear conversation" className="p-2 text-muted-foreground"><Trash2 className="h-5 w-5" /></button>}
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="px-5">
          {messages.length === 0 ? (
            <ConversationEmptyState icon={<BookMarked className="h-10 w-10 text-accent" />} title="What would you like to understand?" description={'Try "What is the difference between RPO and RTO?" or "When should an auditor use statistical sampling?"'} />
          ) : messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent"}>
                {m.parts.map((p, i) => {
                  if (p.type === "text") return m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <p key={i}>{p.text}</p>;
                  if (p.type === "reasoning" && p.text && m.role === "assistant" && !m.parts.some((x) => x.type === "text" && x.text)) return <p key={i} className="text-xs italic text-muted-foreground">{p.text.slice(-200)}</p>;
                  return null;
                })}
                {m.role === "assistant" && !!m.metadata?.sources?.length && <Sources sources={m.metadata.sources} />}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <Message from="assistant"><MessageContent className="bg-transparent"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Searching your books…</span></MessageContent></Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="px-3 pb-3">
        <PromptInput onSubmit={({ text }) => { if (busy) { stop(); return; } if (text.trim()) sendMessage({ text }); }}>
          <PromptInputBody>
            <PromptInputTextarea autoFocus placeholder="Ask about any CISA topic in your books…" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-3 space-y-1.5 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sources</p>
      {sources.map((s) => (
        <Link key={s.n} to="/library/$docId" params={{ docId: s.documentId }} className="block rounded-lg bg-secondary px-3 py-2 text-xs">
          <span className="font-semibold">[S{s.n}] {s.title} · Section {s.section}</span>
          <span className="text-muted-foreground"> · D{s.domain}</span>
          <span className="mt-0.5 line-clamp-2 block text-muted-foreground">{s.excerpt}</span>
        </Link>
      ))}
    </div>
  );
}
