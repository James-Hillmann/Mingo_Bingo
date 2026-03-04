"use client";

import { useTranslations } from "@/components/LanguageProvider";

interface CounterProps {
  count: number;
  total?: number;
}

export function Counter({ count, total = 75 }: CounterProps) {
  const { t } = useTranslations();
  const pct = Math.round((count / total) * 100);

  return (
    <div className="text-center">
      <div className="text-7xl font-black tabular-nums tracking-tight text-white">
        {count}
        <span className="text-3xl font-semibold text-zinc-400"> / {total}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-500 uppercase tracking-widest">
        {t.songsPlayed} · {pct}%
      </p>
    </div>
  );
}
