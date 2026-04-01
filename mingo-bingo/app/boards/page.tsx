"use client";

import { useState, useEffect, useRef } from "react";
import { KEYS } from "@/lib/keys";

const MAX_BOARDS = 20;
const MAX_SUGGESTIONS = 6;

// ─── Types ────────────────────────────────────────────────────────────────────

type Cell = { text: string };
type Board = { name: string; grid: Cell[][] };
type CalledResult = {
  song: string;
  hits: { boardIndex: number; positions: string[] }[];
};
type ActiveEdit = { bi: number; ri: number; ci: number; query: string };
type FillTrigger = { bi: number; ri: number; ci: number; value: string; key: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/[\u2018\u2019\u201A\u201B\u02BC\u0060]/g, "'");
}

const emptyBoard = (name = ""): Board => ({
  name,
  grid: Array(5)
    .fill(null)
    .map(() => Array(5).fill(null).map(() => ({ text: "" }))),
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function EditableCell({
  text,
  crossed,
  highlighted,
  onChange,
  onNext,
  onQueryChange,
  focusTick,
  fillTrigger,
}: {
  text: string;
  crossed: boolean;
  highlighted: boolean;
  onChange: (text: string) => void;
  onNext?: () => void;
  onQueryChange?: (q: string) => void;
  focusTick?: number;
  fillTrigger?: { value: string; key: number } | null;
}) {
  const [editing, setEditing] = useState(false);
  const prevTickRef = useRef(0);
  const prevFillKey = useRef(0);

  useEffect(() => {
    if (focusTick && focusTick !== prevTickRef.current) {
      prevTickRef.current = focusTick;
      setEditing(true);
    }
  }, [focusTick]);

  // When a suggestion is tapped from outside, fill and close
  useEffect(() => {
    if (fillTrigger && fillTrigger.key !== prevFillKey.current) {
      prevFillKey.current = fillTrigger.key;
      onChange(fillTrigger.value);
      setEditing(false);
      onQueryChange?.(fillTrigger.value);
    }
  }, [fillTrigger]);

  let className =
    "border rounded text-[9px] leading-tight p-1 flex items-center justify-center min-h-13 w-full text-center transition-colors ";
  if (crossed) {
    className += "bg-zinc-900 border-zinc-700 text-zinc-600 line-through";
  } else if (highlighted) {
    className += "bg-green-700 border-green-500 text-white font-semibold";
  } else {
    className += "bg-zinc-800 border-zinc-700 text-zinc-300";
  }

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={text}
        onChange={(e) => onQueryChange?.(e.target.value)}
        onBlur={(e) => {
          onChange(e.target.value);
          setEditing(false);
          onQueryChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onChange((e.target as HTMLInputElement).value);
            setEditing(false);
            onNext?.();
          }
        }}
        className="border border-blue-500 rounded text-[9px] p-1 text-white bg-zinc-900 w-full min-h-13 focus:outline-none text-center"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className={className}>
      {text ? text : <span className="text-zinc-600">—</span>}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([emptyBoard("Board 1")]);
  const [searchQuery, setSearchQuery] = useState("");
  const [calledSongs, setCalledSongs] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<CalledResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{
    bi: number; ri: number; ci: number; tick: number;
  } | null>(null);
  const [songNames, setSongNames] = useState<string[]>([]);
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const [fillTrigger, setFillTrigger] = useState<FillTrigger | null>(null);

  useEffect(() => {
    try {
      const savedBoards = localStorage.getItem(KEYS.boards);
      if (savedBoards) {
        const parsed = JSON.parse(savedBoards);
        const valid = parsed
          .filter((b: unknown) => b !== null && typeof b === "object" && "grid" in (b as object))
          .map((b: Board, i: number) => ({ ...b, name: b.name || `Board ${i + 1}` }));
        setBoards(valid.length > 0 ? valid : [emptyBoard("Board 1")]);
      }
      const savedSongs = localStorage.getItem(KEYS.calledSongs);
      if (savedSongs) setCalledSongs(new Set(JSON.parse(savedSongs)));

      // Load playlist songs for autocomplete
      const savedTracks = localStorage.getItem(KEYS.songsTracks);
      if (savedTracks) {
        const tracks: { name: string }[] = JSON.parse(savedTracks);
        setSongNames(tracks.map((t) => t.name));
      }
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(KEYS.boards, JSON.stringify(boards));
  }, [boards, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(KEYS.calledSongs, JSON.stringify([...calledSongs]));
  }, [calledSongs, mounted]);

  function isCalled(text: string) {
    return !!text.trim() && calledSongs.has(normalize(text));
  }

  function isMatch(text: string) {
    if (!searchQuery.trim() || !text.trim()) return false;
    return normalize(text).includes(normalize(searchQuery));
  }

  function getBingoStatus(board: Board): "blackout" | "double" | "bingo" | null {
    const g = board.grid;
    const hit = (r: number, c: number) => isCalled(g[r][c].text);
    const lines = [
      [0,1,2,3,4].map(c => hit(0,c)), [0,1,2,3,4].map(c => hit(1,c)),
      [0,1,2,3,4].map(c => hit(2,c)), [0,1,2,3,4].map(c => hit(3,c)),
      [0,1,2,3,4].map(c => hit(4,c)), [0,1,2,3,4].map(r => hit(r,0)),
      [0,1,2,3,4].map(r => hit(r,1)), [0,1,2,3,4].map(r => hit(r,2)),
      [0,1,2,3,4].map(r => hit(r,3)), [0,1,2,3,4].map(r => hit(r,4)),
      [0,1,2,3,4].map(i => hit(i,i)), [0,1,2,3,4].map(i => hit(i,4-i)),
    ];
    const completed = lines.filter(l => l.every(Boolean)).length;
    if (g.flat().every(cell => isCalled(cell.text))) return "blackout";
    if (completed >= 2) return "double";
    if (completed >= 1) return "bingo";
    return null;
  }

  function getSuggestions(query: string): string[] {
    if (!query.trim() || songNames.length === 0) return [];
    const q = normalize(query);
    const startsWith = songNames.filter(s => normalize(s).startsWith(q));
    const contains = songNames.filter(s => !normalize(s).startsWith(q) && normalize(s).includes(q));
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }

  function advanceFocus(bi: number, ri: number, ci: number) {
    const nextCi = ci + 1;
    const nextRi = ri + (nextCi > 4 ? 1 : 0);
    const wrappedCi = nextCi > 4 ? 0 : nextCi;
    if (nextRi > 4) return;
    setFocusTarget((prev) => ({ bi, ri: nextRi, ci: wrappedCi, tick: (prev?.tick ?? 0) + 1 }));
  }

  function callSong() {
    const q = searchQuery.trim();
    if (!q) return;
    const matchingTexts = new Set<string>();
    boards.forEach((board) => {
      board.grid.flat().forEach((cell) => {
        if (cell.text.trim() && normalize(cell.text).includes(normalize(q)))
          matchingTexts.add(normalize(cell.text));
      });
    });
    const resolved = matchingTexts.size === 1 ? [...matchingTexts][0] : normalize(q);
    setCalledSongs((prev) => new Set([...prev, resolved]));
    const hits: CalledResult["hits"] = [];
    boards.forEach((board, bi) => {
      const positions: string[] = [];
      board.grid.forEach((row, ri) =>
        row.forEach((cell, ci) => {
          if (normalize(cell.text) === resolved) positions.push(`Row ${ri + 1}, Col ${ci + 1}`);
        })
      );
      if (positions.length) hits.push({ boardIndex: bi, positions });
    });
    setLastResult({ song: resolved, hits });
    setSearchQuery("");
  }

  function addBoard() {
    if (boards.length >= MAX_BOARDS) return;
    setBoards((prev) => [...prev, emptyBoard(`Board ${prev.length + 1}`)]);
  }

  function removeBoard(bi: number) {
    setBoards((prev) => prev.filter((_, i) => i !== bi));
  }

  function updateCell(boardIndex: number, row: number, col: number, text: string) {
    setBoards((prev) => {
      const next = [...prev];
      const grid = next[boardIndex].grid.map((r) => r.map((c) => ({ ...c })));
      grid[row][col].text = text;
      next[boardIndex] = { ...next[boardIndex], grid };
      return next;
    });
  }

  function renameBoard(boardIndex: number, name: string) {
    setBoards((prev) => {
      const next = [...prev];
      next[boardIndex] = { ...next[boardIndex], name };
      return next;
    });
  }

  function handleSuggestionTap(suggestion: string) {
    if (!activeEdit) return;
    const { bi, ri, ci } = activeEdit;
    updateCell(bi, ri, ci, suggestion);
    setFillTrigger((prev) => ({ bi, ri, ci, value: suggestion, key: (prev?.key ?? 0) + 1 }));
    setActiveEdit(null);
    // advance to next cell after a tick
    setTimeout(() => advanceFocus(bi, ri, ci), 0);
  }

  const suggestions = activeEdit ? getSuggestions(activeEdit.query) : [];
  const callSuggestions = searchQuery.trim() ? getSuggestions(searchQuery) : [];
  const liveHits = searchQuery.trim()
    ? boards.flatMap((board, bi) => {
        const positions: string[] = [];
        board.grid.forEach((row, ri) =>
          row.forEach((cell, ci) => {
            if (isMatch(cell.text)) positions.push(`Row ${ri + 1}, Col ${ci + 1}`);
          })
        );
        return positions.length ? [{ boardIndex: bi, positions }] : [];
      })
    : null;

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <h1 className="text-xl font-black tracking-tight text-white uppercase">My Boards</h1>

        {/* Search / call a song */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter a song name…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (lastResult) setLastResult(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") callSong(); }}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={callSong}
              disabled={!searchQuery.trim()}
              className="px-4 py-3 rounded-lg bg-green-700 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-semibold transition-colors"
            >
              Call
            </button>
          </div>

          {callSuggestions.length > 0 && (
            <div className="flex flex-col rounded-lg overflow-hidden border border-zinc-700">
              {callSuggestions.map((s) => (
                <button
                  key={s}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => { setSearchQuery(s); if (lastResult) setLastResult(null); }}
                  className="text-left px-3 py-2 text-sm text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-b border-zinc-700 last:border-0 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {liveHits && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 flex flex-col gap-1">
              {liveHits.length === 0 ? (
                <p className="text-zinc-500 text-xs">Not found on any board</p>
              ) : liveHits.map((h) => (
                <p key={h.boardIndex} className="text-green-400 text-xs">
                  {boards[h.boardIndex]?.name || `Board ${h.boardIndex + 1}`}: {h.positions.join(" · ")}
                </p>
              ))}
            </div>
          )}

          {!searchQuery.trim() && lastResult && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 flex flex-col gap-1">
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-0.5">
                "{lastResult.song}"
              </p>
              {lastResult.hits.length === 0 ? (
                <p className="text-zinc-500 text-xs">Not found on any board</p>
              ) : lastResult.hits.map((h) => (
                <p key={h.boardIndex} className="text-green-400 text-xs">
                  {boards[h.boardIndex]?.name || `Board ${h.boardIndex + 1}`}: {h.positions.join(" · ")}
                </p>
              ))}
            </div>
          )}

          {calledSongs.size > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {[...calledSongs].reverse().map((s) => (
                <button
                  key={s}
                  onClick={() => setCalledSongs((prev) => { const next = new Set(prev); next.delete(s); return next; })}
                  className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-500 rounded px-2 py-0.5 line-through hover:border-red-800 hover:text-red-500 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Boards */}
        {boards.map((board, bi) => (
          <div key={bi} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                value={board.name}
                onChange={(e) => renameBoard(bi, e.target.value)}
                className="text-sm font-bold text-zinc-400 uppercase tracking-wider bg-transparent focus:outline-none focus:text-white placeholder-zinc-600 flex-1 min-w-0"
              />
              {(() => {
                const status = getBingoStatus(board);
                if (!status) return null;
                const styles = { blackout: "bg-yellow-400 text-black", double: "bg-purple-600 text-white", bingo: "bg-green-600 text-white" };
                const labels = { blackout: "BLACKOUT", double: "DOUBLE BINGO", bingo: "BINGO" };
                return <span className={`text-[10px] font-black px-2 py-0.5 rounded tracking-wider shrink-0 ${styles[status]}`}>{labels[status]}</span>;
              })()}
              {boards.length > 1 && (
                <button onClick={() => removeBoard(bi)} className="text-zinc-600 hover:text-red-400 text-lg leading-none transition-colors px-1" aria-label="Remove board">×</button>
              )}
            </div>

            <div className="grid grid-cols-5 gap-0.5">
              {board.grid.map((row, ri) =>
                row.map((cell, ci) => (
                  <EditableCell
                    key={`${ri}-${ci}`}
                    text={cell.text}
                    crossed={isCalled(cell.text)}
                    highlighted={!isCalled(cell.text) && isMatch(cell.text)}
                    onChange={(text) => updateCell(bi, ri, ci, text)}
                    onNext={() => advanceFocus(bi, ri, ci)}
                    onQueryChange={(q) => setActiveEdit(q.trim() ? { bi, ri, ci, query: q } : null)}
                    focusTick={focusTarget?.bi === bi && focusTarget?.ri === ri && focusTarget?.ci === ci ? focusTarget.tick : 0}
                    fillTrigger={fillTrigger?.bi === bi && fillTrigger?.ri === ri && fillTrigger?.ci === ci ? fillTrigger : null}
                  />
                ))
              )}
            </div>

            {/* Autocomplete suggestions for this board */}
            {activeEdit?.bi === bi && suggestions.length > 0 && (
              <div className="flex flex-col rounded-lg overflow-hidden border border-zinc-700">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionTap(s)}
                    className="text-left px-3 py-2 text-sm text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-b border-zinc-700 last:border-0 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {boards.length < MAX_BOARDS && (
          <button onClick={addBoard} className="w-full border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-xl py-4 text-sm text-zinc-600 hover:text-zinc-400 transition-colors">
            + Add Board
          </button>
        )}

        <p className="text-zinc-700 text-xs text-center">Tap any cell to edit it manually</p>

        <button
          onClick={() => {
            setBoards([emptyBoard("Board 1")]);
            setCalledSongs(new Set());
            setLastResult(null);
            setSearchQuery("");
            localStorage.removeItem(KEYS.boards);
            localStorage.removeItem(KEYS.calledSongs);
          }}
          className="text-xs text-zinc-700 hover:text-red-500 transition-colors mx-auto pb-4"
        >
          Reset everything
        </button>
      </div>
    </main>
  );
}
