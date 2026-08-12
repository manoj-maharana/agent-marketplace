import { ArrowRight, LayoutGrid, MessagesSquare, Plug, Puzzle, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  { icon: LayoutGrid, label: "Browse and install ready-made agents" },
  { icon: Puzzle, label: "Give agents live, callable skills" },
  { icon: Users, label: "Run multi-agent groups that collaborate" },
  { icon: Plug, label: "Connect MCP servers" },
];

export function Landing() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto bg-bg text-text">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
            <Sparkles className="size-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Agent Marketplace</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted">
          <Sparkles className="size-3.5 text-accent" />
          Built on Azure OpenAI
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your own AI agent marketplace
        </h1>
        <p className="mt-4 max-w-xl text-base text-text-muted">
          Browse and install agents, give them real callable skills, and chat with them — or jump
          straight into a freeform assistant that doesn't need an agent picked first.
        </p>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
          <Link
            to="/home"
            className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-6 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <LayoutGrid className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Open Marketplace</h2>
              <p className="mt-1 text-sm text-text-muted">
                Browse agents, skills, and MCP servers, and build your own.
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1 text-sm font-medium text-accent">
              Get started
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            to="/assistant"
            className="group flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-6 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <MessagesSquare className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Open Assistant</h2>
              <p className="mt-1 text-sm text-text-muted">
                Jump straight into chat — no need to pick an agent first.
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1 text-sm font-medium text-accent">
              Start chatting
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <div className="mt-12 grid w-full grid-cols-2 gap-x-8 gap-y-3 text-left sm:grid-cols-4">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" />
              <span className="text-xs text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 pb-6 text-center text-xs text-text-faint">
        Created and developed with ❤️ by Manoj Maharana
      </footer>
    </div>
  );
}
