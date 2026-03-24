"use client";

import { useState } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Cell = { text: string };
type Board = {
  imageUrl: string;
  grid: Cell[][];
  processing: boolean;
  error?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyGrid = (): Cell[][] =>
  Array(5)
    .fill(null)
    .map(() => Array(5).fill(null).map(() => ({ text: "" })));

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function getCommonSongs(boards: (Board | null)[]): Set<string> {
  const ready = boards.filter((b): b is Board => b !== null && !b.processing);
  if (ready.length < 2) return new Set();

  const sets = ready.map(
    (b) =>
      new Set(
        b.grid
          .flat()
          .map((c) => c.text.toLowerCase().trim())
          .filter(Boolean)
      )
  );

  const common = new Set<string>();
  for (const song of sets[0]) {
    if (sets.slice(1).every((s) => s.has(song))) common.add(song);
  }
  return common;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
  return (
    <label className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-zinc-500 active:border-zinc-400 transition-colors">
      <span className="text-4xl">📷</span>
      <span className="text-zinc-300 text-sm font-medium">Tap to upload board photo</span>
      <span className="text-zinc-500 text-xs text-center">Photo of your music bingo card</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
    </label>
  );
}

function EditableCell({
  text,
  className,
  onChange,
}: {
  text: string;
  className: string;
  onChange: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={text}
        onBlur={(e) => {
          onChange(e.target.value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange((e.target as HTMLInputElement).value);
            setEditing(false);
          }
        }}
        className="border border-blue-500 rounded text-[9px] p-1 text-white bg-zinc-900 w-full min-h-13 focus:outline-none text-center"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`border rounded text-[9px] leading-tight p-1 flex items-center justify-center min-h-13 w-full text-center transition-colors ${className}`}
    >
      {text ? text : <span className="text-zinc-600">—</span>}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BoardsPage() {
  const [boards, setBoards] = useState<(Board | null)[]>([null, null]);
  const [searchQuery, setSearchQuery] = useState("");

  const commonSongs = getCommonSongs(boards);
  const anyReady = boards.some((b) => b && !b.processing);

  function isMatch(text: string): boolean {
    if (!searchQuery.trim() || !text.trim()) return false;
    return text.toLowerCase().includes(searchQuery.toLowerCase().trim());
  }

  function isCommon(text: string): boolean {
    return !!text.trim() && commonSongs.has(text.toLowerCase().trim());
  }

  function cellClass(text: string): string {
    if (isMatch(text)) return "bg-green-700 border-green-500 text-white font-semibold";
    if (isCommon(text)) return "bg-amber-900/50 border-amber-600 text-amber-200";
    return "bg-zinc-800 border-zinc-700 text-zinc-300";
  }

  async function handleUpload(boardIndex: number, file: File) {
    const imageUrl = URL.createObjectURL(file);
    setBoards((prev) => {
      const next = [...prev];
      next[boardIndex] = { imageUrl, grid: emptyGrid(), processing: true };
      return next;
    });

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");

      const img = await loadImage(imageUrl);
      const result = await worker.recognize(imageUrl);
      await worker.terminate();

      const grid = emptyGrid();
      const cellW = img.naturalWidth / 5;
      const cellH = img.naturalHeight / 5;

      // Flatten words from blocks → paragraphs → lines → words
      const words =
        result.data.blocks?.flatMap((b) =>
          b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words))
        ) ?? [];

      for (const word of words) {
        if (word.confidence < 25) continue;
        const cx = (word.bbox.x0 + word.bbox.x1) / 2;
        const cy = (word.bbox.y0 + word.bbox.y1) / 2;
        const col = Math.min(Math.floor(cx / cellW), 4);
        const row = Math.min(Math.floor(cy / cellH), 4);
        const cell = grid[row][col];
        cell.text = cell.text ? cell.text + " " + word.text : word.text;
      }

      setBoards((prev) => {
        const next = [...prev];
        next[boardIndex] = { imageUrl, grid, processing: false };
        return next;
      });
    } catch {
      setBoards((prev) => {
        const next = [...prev];
        if (next[boardIndex]) {
          next[boardIndex] = {
            ...next[boardIndex]!,
            processing: false,
            error: "Scan failed — tap any cell to edit it manually.",
          };
        }
        return next;
      });
    }
  }

  function updateCell(boardIndex: number, row: number, col: number, text: string) {
    setBoards((prev) => {
      const next = [...prev];
      if (next[boardIndex]) {
        const grid = next[boardIndex]!.grid.map((r) => r.map((c) => ({ ...c })));
        grid[row][col].text = text;
        next[boardIndex] = { ...next[boardIndex]!, grid };
      }
      return next;
    });
  }

  // Build search result summary
  const searchResults =
    searchQuery.trim() && anyReady
      ? boards.map((board, bi) => {
          if (!board || board.processing) return null;
          const hits: string[] = [];
          board.grid.forEach((row, ri) =>
            row.forEach((cell, ci) => {
              if (isMatch(cell.text)) hits.push(`Row ${ri + 1}, Col ${ci + 1}`);
            })
          );
          return { boardIndex: bi, hits };
        })
      : null;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">
            ←
          </Link>
          <h1 className="text-xl font-black tracking-tight text-white uppercase">My Boards</h1>
        </div>

        {/* Search */}
        {anyReady && (
          <div className="flex flex-col gap-1">
            <input
              type="text"
              placeholder="Search for a song…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
            />
            {searchResults && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 flex flex-col gap-1">
                {searchResults.map((r) => {
                  if (!r) return null;
                  if (r.hits.length === 0)
                    return (
                      <p key={r.boardIndex} className="text-zinc-500 text-xs">
                        Board {r.boardIndex + 1}: not found
                      </p>
                    );
                  return (
                    <p key={r.boardIndex} className="text-green-400 text-xs">
                      Board {r.boardIndex + 1}: {r.hits.join(" · ")}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Common songs banner */}
        {commonSongs.size > 0 && !searchQuery && (
          <div className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-3">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
              On both boards ({commonSongs.size})
            </p>
            <p className="text-amber-300/80 text-xs leading-relaxed">
              {[...commonSongs].join(" · ")}
            </p>
          </div>
        )}

        {/* Legend */}
        {anyReady && (
          <div className="flex gap-4 text-xs text-zinc-500 justify-center">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-900/50 border border-amber-600 inline-block" />
              Both boards
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-green-700 border border-green-500 inline-block" />
              Search match
            </span>
          </div>
        )}

        {/* Board 1 & 2 */}
        {([0, 1] as const).map((bi) => (
          <div key={bi} className="flex flex-col gap-3">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
              Board {bi + 1}
            </h2>

            {!boards[bi] ? (
              <UploadZone onUpload={(f) => handleUpload(bi, f)} />
            ) : boards[bi]!.processing ? (
              <div className="border border-zinc-700 rounded-xl p-6 text-center">
                <p className="text-zinc-400 text-sm animate-pulse">Scanning board…</p>
                <p className="text-zinc-600 text-xs mt-1">This may take a minute</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {boards[bi]!.error && (
                  <p className="text-amber-500 text-xs">{boards[bi]!.error}</p>
                )}

                {/* 5×5 grid */}
                <div className="grid grid-cols-5 gap-0.5">
                  {boards[bi]!.grid.map((row, ri) =>
                    row.map((cell, ci) => (
                      <EditableCell
                        key={`${ri}-${ci}`}
                        text={cell.text}
                        className={cellClass(cell.text)}
                        onChange={(text) => updateCell(bi, ri, ci, text)}
                      />
                    ))
                  )}
                </div>

                <label className="text-xs text-zinc-600 hover:text-zinc-400 text-center cursor-pointer mt-1">
                  Re-upload image
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(bi, f);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        ))}

        <p className="text-zinc-700 text-xs text-center pb-4">
          Tap any cell to edit it manually
        </p>
      </div>
    </main>
  );
}
