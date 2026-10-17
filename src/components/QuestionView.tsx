import { cn } from "@/lib/utils";

export type Q = { id: string; domain: number; stem: string; options: unknown; answer: number; explanation: string };

export function QuestionView({ q, picked, onPick, reveal }: { q: Q; picked: number | null; onPick: (i: number) => void; reveal: boolean }) {
  const opts = q.options as string[];
  return (
    <div>
      <p className="text-lg leading-relaxed">{q.stem}</p>
      <div className="mt-4 space-y-2">
        {opts.map((o, i) => {
          const correct = reveal && i === q.answer;
          const wrong = reveal && picked === i && i !== q.answer;
          return (
            <button key={i} disabled={reveal} onClick={() => onPick(i)}
              className={cn("flex w-full gap-3 rounded-xl border bg-card p-4 text-left text-sm transition",
                picked === i && !reveal && "border-primary ring-2 ring-primary/30",
                correct && "border-success bg-success/10",
                wrong && "border-destructive bg-destructive/10")}>
              <span className="font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
      {reveal && q.explanation && (
        <div className="mt-4 rounded-xl bg-secondary p-4 text-sm leading-relaxed">
          <p className="mb-1 font-semibold">Explanation</p>{q.explanation}
        </div>
      )}
    </div>
  );
}
