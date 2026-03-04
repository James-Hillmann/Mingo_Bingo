"use client";

import { useTranslations } from "@/components/LanguageProvider";

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
  impossibleLabel: string;
  oneInLabel: string;
}

function oneIn(value: number, count: number, minSongs: number): string | null {
  if (count < minSongs) return null;
  if (value <= 0) return "> 1,000,000";
  if (value >= 1) return "1";
  const x = 1 / value;
  return x >= 10 ? Math.round(x).toLocaleString() : x.toFixed(1);
}

function ProbRow({ label, sublabel, value, barColor, minSongs, count, impossibleLabel, oneInLabel }: RowProps) {
  const pct = Math.round(value * 100);
  const oneInVal = oneIn(value, count, minSongs);

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
            {oneInVal !== null ? `${oneInLabel} ${oneInVal}` : impossibleLabel}
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
  const { t } = useTranslations();
  const avgMarked = (count * 25 / 75).toFixed(1);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
          {t.oddsForRandomBoard}
        </p>
        <p className="text-xs text-zinc-500 tabular-nums">
          ~<span className="text-zinc-300 font-semibold">{avgMarked}</span>
          <span> {t.squares}</span>
        </p>
      </div>
      <ProbRow
        label={t.fiveInARow}
        sublabel={t.anyLine}
        value={line}
        barColor="#10b981"
        minSongs={5}
        count={count}
        impossibleLabel={t.impossible}
        oneInLabel={t.oneIn}
      />
      <ProbRow
        label={t.twoLines}
        sublabel={t.onOneBoard}
        value={twoLine}
        barColor="#f59e0b"
        minSongs={10}
        count={count}
        impossibleLabel={t.impossible}
        oneInLabel={t.oneIn}
      />
      <ProbRow
        label={t.blackout}
        sublabel={t.fullBoard}
        value={blackout}
        barColor="#8b5cf6"
        minSongs={25}
        count={count}
        impossibleLabel={t.impossible}
        oneInLabel={t.oneIn}
      />
    </div>
  );
}
