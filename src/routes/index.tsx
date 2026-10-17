import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CISA Coach — Study notes & practice MCQs" },
      { name: "description", content: "Turn your CISA study books into AI note cards, practice questions and timed mock exams." },
      { property: "og:title", content: "CISA Coach — Study notes & practice MCQs" },
      { property: "og:description", content: "Turn your CISA study books into AI note cards, practice questions and timed mock exams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/home" }); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) { toast.success("Check your email to confirm your account."); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/home" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen flex-col bg-hero text-primary-foreground">
      <div className="flex flex-1 flex-col justify-end px-6 pb-10 pt-16">
        <ShieldCheck className="h-10 w-10 text-accent" />
        <h1 className="mt-4 text-4xl font-bold leading-tight">CISA Coach</h1>
        <p className="mt-3 max-w-xs text-primary-foreground/75">Your books, turned into note cards, practice questions and full mock exams — across all five domains.</p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-t-3xl bg-card px-6 pb-10 pt-8 text-card-foreground">
        <h2 className="text-xl font-semibold">{mode === "in" ? "Welcome back" : "Create your account"}</h2>
        <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
        <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
        <Button type="submit" disabled={busy} className="h-12 w-full text-base">{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-center text-sm text-muted-foreground">
          {mode === "in" ? "First time? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
