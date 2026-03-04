"use client";

import { useState, useEffect } from "react";
import { PROBABILITIES } from "@/lib/probabilities";
import { loadCount, saveCount, resetCount } from "@/lib/storage";
import { Counter } from "@/components/Counter";
import { SongButton } from "@/components/SongButton";
import { ProbabilityPanel } from "@/components/ProbabilityPanel";
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

export default function Home() {
  const [count, setCount] = useState(0);
  const [showReset, setShowReset] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load persisted count after mount (avoids SSR mismatch)
  useEffect(() => {
    setCount(loadCount());
    setMounted(true);
  }, []);

  function handleSongPlayed() {
    if (count >= 75) return;
    const next = count + 1;
    setCount(next);
    saveCount(next);
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
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Mingo Bingo
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5 tracking-widest uppercase">
            RNG Tracker
          </p>
        </div>

        {/* Counter */}
        <Counter count={count} />

        {/* Big button */}
        <SongButton onClick={handleSongPlayed} disabled={count >= 75} />

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

        {/* Reset */}
        <button
          onClick={() => setShowReset(true)}
          className="text-xs text-zinc-700 hover:text-zinc-500 transition-colors mx-auto"
        >
          Reset Game
        </button>
      </div>

      {/* Reset confirmation dialog */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xs mx-auto">
          <DialogHeader>
            <DialogTitle>Reset the game?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              This will set the song count back to zero.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowReset(false)}
              className="text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
