interface ProbabilityPanelProps {
  line: number;
  twoLine: number;
  blackout: number;
  count: number;
}

interface RowProps {
  label: string;
  sublabel: string;
  value: number;
  barColor: string;
  minSongs: number;
  count: number;
}

function oneIn(value: number, count: number, minSongs: number): string {
  if (count < minSongs) return "impossible";
  if (value <= 0) return "> 100,000";
  if (value >= 1) return "1";
  const x = 1 / value;
  return x >= 10 ? Math.round(x).toLocaleString() : x.toFixed(1);
}

function ProbRow({ label, sublabel, value, barColor, minSongs, count }: RowProps) {
  const pct = Math.round(value * 100);
  const oneInStr = oneIn(value, count, minSongs);
  const showOneIn = oneInStr !== "impossible";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="ml-2 text-xs text-zinc-500">{sublabel}</span>
        </div>
        <div className="text-right">
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
          <span className="ml-2 text-xs text-zinc-500 tabular-nums">
            {showOneIn ? `1 in ${oneInStr}` : "—"}
          </span>
        </div>
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

export function ProbabilityPanel({ line, twoLine, blackout, count }: ProbabilityPanelProps) {
  const avgMarked = (count * 25 / 75).toFixed(1);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
          Odds for a random board
        </p>
        <p className="text-xs text-zinc-500 tabular-nums">
          ~<span className="text-zinc-300 font-semibold">{avgMarked}</span>
          <span> / 25 squares</span>
        </p>
      </div>
      <ProbRow
        label="5-in-a-row"
        sublabel="any line"
        value={line}
        barColor="#10b981"
        minSongs={5}
        count={count}
      />
      <ProbRow
        label="Two lines"
        sublabel="on one board"
        value={twoLine}
        barColor="#f59e0b"
        minSongs={10}
        count={count}
      />
      <ProbRow
        label="Blackout"
        sublabel="full board"
        value={blackout}
        barColor="#8b5cf6"
        minSongs={25}
        count={count}
      />
    </div>
  );
}
