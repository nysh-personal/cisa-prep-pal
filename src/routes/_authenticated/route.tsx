import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Home, Layers, ListChecks, MessageCircleQuestion, Timer } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
  },
  component: Layout,
});

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/library", label: "Library", icon: BookOpen },
  { to: "/ask", label: "Ask", icon: MessageCircleQuestion },
  { to: "/cards", label: "Cards", icon: Layers },
  { to: "/practice", label: "Practice", icon: ListChecks },
  { to: "/exam", label: "Exam", icon: Timer },
] as const;

function Layout() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-background pb-24 sm:max-w-2xl lg:max-w-3xl">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-lg grid-cols-6 pb-[env(safe-area-inset-bottom)] sm:max-w-2xl lg:max-w-3xl">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary font-semibold" }}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
