"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PROBABILITIES } from "@/lib/probabilities";
import { loadCount, saveCount, resetCount } from "@/lib/storage";
import { Counter } from "@/components/Counter";
import { SongButton } from "@/components/SongButton";
import { ProbabilityPanel } from "@/components/ProbabilityPanel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "@/components/LanguageProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${s}s`;
}

type TimerSnapshot = { lastSongTime: number | null; intervals: number[] };

function useTimeSinceLastSong() {
  const [lastSongTime, setLastSongTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [intervals, setIntervals] = useState<number[]>([]);
  const [history, setHistory] = useState<TimerSnapshot[]>([]);

  useEffect(() => {
    if (lastSongTime === null) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastSongTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSongTime]);

  function recordSong() {
    const now = Date.now();
    setHistory((prev) => [...prev, { lastSongTime, intervals }]);
    if (lastSongTime !== null) {
      const gap = Math.floor((now - lastSongTime) / 1000);
      setIntervals((prev) => [gap, ...prev].slice(0, 3));
    }
    setLastSongTime(now);
    setElapsed(0);
  }

  function undoSong() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setLastSongTime(snapshot.lastSongTime);
      setIntervals(snapshot.intervals);
      setElapsed(
        snapshot.lastSongTime
          ? Math.floor((Date.now() - snapshot.lastSongTime) / 1000)
          : 0
      );
      return prev.slice(0, -1);
    });
  }

  return { elapsed, lastSongTime, intervals, history, recordSong, undoSong };
}

export default function Home() {
  const [count, setCount] = useState(0);
  const [showReset, setShowReset] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslations();
  const { elapsed, lastSongTime, intervals, recordSong, undoSong } = useTimeSinceLastSong();
  const [countHistory, setCountHistory] = useState<number[]>([]);

  // Load persisted count after mount (avoids SSR mismatch)
  useEffect(() => {
    setCount(loadCount());
    setMounted(true);
  }, []);

  function handleSongPlayed() {
    if (count >= 75) return;
    setCountHistory((prev) => [...prev, count]);
    const next = count + 1;
    setCount(next);
    saveCount(next);
    recordSong();
  }

  function handleUndo() {
    if (countHistory.length === 0) return;
    const prev = countHistory[countHistory.length - 1];
    setCountHistory((h) => h.slice(0, -1));
    setCount(prev);
    saveCount(prev);
    undoSong();
  }

  function handleSlider(val: number[]) {
    const next = val[0];
    setCount(next);
    saveCount(next);
  }

  function handleReset() {
    setCount(0);
    resetCount();
    setShowReset(false);
  }

  const probs = PROBABILITIES[count] ?? { line: 0, twoLine: 0, blackout: 0 };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Header */}
        <div className="text-center relative">
          <div className="absolute right-0 top-0">
            <LanguageSwitcher />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            {t.appTitle}
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5 tracking-widest uppercase">
            {t.rngTracker}
          </p>
        </div>

        {/* Counter */}
        <Counter count={count} />

        {/* Big button + undo */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1">
            <SongButton onClick={handleSongPlayed} disabled={count >= 75} />
          </div>
          <button
            onClick={handleUndo}
            disabled={countHistory.length === 0}
            className={`px-3 rounded-2xl text-xs font-bold transition-all duration-100 select-none
              ${countHistory.length === 0
                ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-500 active:scale-95 active:bg-red-700 text-white shadow-lg shadow-red-900/40 cursor-pointer"
              }`}
          >
            Undo
          </button>
        </div>

        {/* Timer since last song */}
        <div className="text-center text-sm text-zinc-500 space-y-1">
          <div>
            {lastSongTime === null
              ? "No song played yet"
              : `Last song: ${formatSeconds(elapsed)} ago`}
          </div>
          {intervals.length > 0 && (
            <div className="text-xs text-zinc-600 space-y-0.5">
              {intervals.map((s, i) => (
                <div key={i}>#{i + 1}: {formatSeconds(s)}</div>
              ))}
            </div>
          )}
        </div>

        {/* Slider */}
        <div className="space-y-3">
          <Slider
            min={0}
            max={75}
            step={1}
            value={[count]}
            onValueChange={handleSlider}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-zinc-600">
            <span>0</span>
            <span>75</span>
          </div>
        </div>

        {/* Probabilities */}
        <ProbabilityPanel
          line={probs.line}
          twoLine={probs.twoLine}
          blackout={probs.blackout}
          count={count}
        />

        {/* Boards link */}
        <Link
          href="/boards"
          className="w-full flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 rounded-xl py-3 text-sm font-semibold text-zinc-300 hover:text-white transition-colors"
        >
          📋 My Boards
        </Link>

        {/* Reset */}
        <button
          onClick={() => setShowReset(true)}
          className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors mx-auto"
        >
          {t.resetGame}
        </button>
      </div>

      {/* Reset confirmation dialog */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xs mx-auto">
          <DialogHeader>
            <DialogTitle>{t.resetTitle}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t.resetDescription}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowReset(false)}
              className="text-zinc-400 hover:text-white"
            >
              {t.cancel}
            </Button>
            <Button
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {t.reset}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
