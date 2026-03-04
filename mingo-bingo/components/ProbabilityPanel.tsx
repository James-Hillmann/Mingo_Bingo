interface ProbabilityPanelProps {
  line: number;
  twoLine: number;
  blackout: number;
}

interface RowProps {
  label: string;
  sublabel: string;
  value: number;
  barColor: string;
}

function ProbRow({ label, sublabel, value, barColor }: RowProps) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="ml-2 text-xs text-zinc-500">{sublabel}</span>
        </div>
        <span
          className={`text-lg font-bold tabular-nums ${
            pct >= 75
              ? "text-emerald-400"
              : pct >= 40
              ? "text-amber-400"
              : "text-zinc-300"
          }`}
        >
          {pct}%
        </span>
      </div>
      {/* Custom progress bar */}
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

export function ProbabilityPanel({ line, twoLine, blackout }: ProbabilityPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
        Odds for a random board
      </p>
      <ProbRow
        label="5-in-a-row"
        sublabel="any line"
        value={line}
        barColor="#10b981"
      />
      <ProbRow
        label="Two lines"
        sublabel="on one board"
        value={twoLine}
        barColor="#f59e0b"
      />
      <ProbRow
        label="Blackout"
        sublabel="full board"
        value={blackout}
        barColor="#8b5cf6"
      />
    </div>
  );
}
