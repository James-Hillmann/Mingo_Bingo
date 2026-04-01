"use client";

import { useState, useEffect, useRef } from "react";
import { KEYS } from "@/lib/keys";
import { saveCount, resetCount } from "@/lib/storage";

const MAX_BOARDS = 20;
const MAX_SUGGESTIONS = 6;

// ─── Types ────────────────────────────────────────────────────────────────────

type Cell = { text: string };
type Board = { name: string; grid: Cell[][] };
type HitCoord = { row: number; col: number };
type CalledResult = {
  song: string;
  hits: { boardIndex: number; coords: HitCoord[]; status: "blackout" | "double" | "bingo" | null }[];
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

function MiniBingoBoard({ board, hitCoords, calledSongs }: {
  board: Board;
  hitCoords: HitCoord[];
  calledSongs: Set<string>;
}) {
  const hitSet = new Set(hitCoords.map(c => `${c.row},${c.col}`));
  return (
    <div className="inline-grid grid-cols-5 gap-px shrink-0">
      {board.grid.map((row, ri) =>
        row.map((cell, ci) => {
          const isHit = hitSet.has(`${ri},${ci}`);
          const called = !!cell.text.trim() && calledSongs.has(normalize(cell.text));
          let bg = "bg-zinc-600";
          if (isHit) bg = "bg-green-500";
          else if (called) bg = "bg-zinc-950";
          return <div key={`${ri}-${ci}`} className={`w-2 h-2 ${bg} rounded-[1px]`} />;
        })
      )}
    </div>
  );
}

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
  const [showAllCalled, setShowAllCalled] = useState(false);
  const [lastResult, setLastResult] = useState<CalledResult | null>(null);
  const [mounted, setMounted] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{
    bi: number; ri: number; ci: number; tick: number;
  } | null>(null);
  const [songNames, setSongNames] = useState<string[]>([]);
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const [fillTrigger, setFillTrigger] = useState<FillTrigger | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done">("idle");
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const boardRefs = useRef<(HTMLDivElement | null)[]>([]);

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
      setSpotifyConnected(!!localStorage.getItem(KEYS.spRefresh));
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
    saveCount(calledSongs.size);
  }, [calledSongs, mounted]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardOffset(window.innerHeight - vv.height - vv.offsetTop);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

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
    const source = songNames.length > 0
      ? songNames
      : [...new Set(boards.flatMap(b => b.grid.flat().map(c => c.text.trim()).filter(Boolean)))];
    if (!query.trim() || source.length === 0) return [];
    const q = normalize(query);
    const startsWith = source.filter(s => normalize(s).startsWith(q)).sort((a, b) => a.length - b.length);
    const contains = source.filter(s => !normalize(s).startsWith(q) && normalize(s).includes(q)).sort((a, b) => a.length - b.length);
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }

  function advanceFocus(bi: number, ri: number, ci: number) {
    const nextCi = ci + 1;
    const nextRi = ri + (nextCi > 4 ? 1 : 0);
    const wrappedCi = nextCi > 4 ? 0 : nextCi;
    if (nextRi > 4) return;
    setFocusTarget((prev) => ({ bi, ri: nextRi, ci: wrappedCi, tick: (prev?.tick ?? 0) + 1 }));
  }

  async function identifyShow(songName: string) {
    const q = songName.trim();
    if (!q) return;
    const allShows = [...new Set(boards.flatMap((b) => b.grid.flat().map((c) => c.text.trim()).filter(Boolean)))];
    if (allShows.length === 0) return;
    setLookupState("loading");
    setLookupResult(null);
    try {
      const res = await fetch("/api/identify-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songName: q, shows: allShows }),
      });
      const data = await res.json();
      setLookupResult(data.show ?? null);
      setLookupState("done");
    } catch {
      setLookupState("idle");
    }
  }

  function callSong(override?: string, prevToRemove?: string) {
    const q = (override ?? searchQuery).trim();
    if (!q) return;
    const matchingTexts = new Set<string>();
    boards.forEach((board) => {
      board.grid.flat().forEach((cell) => {
        if (cell.text.trim() && normalize(cell.text).includes(normalize(q)))
          matchingTexts.add(normalize(cell.text));
      });
    });
    const resolved = matchingTexts.size === 1 ? [...matchingTexts][0] : normalize(q);
    const newCalledSongs = new Set([...calledSongs, resolved]);
    if (prevToRemove) newCalledSongs.delete(prevToRemove);
    setCalledSongs(newCalledSongs);
    const isCalledIn = (text: string, called: Set<string>) => !!text.trim() && called.has(normalize(text));
    const getBingoStatusWith = (board: Board, called: Set<string>): "blackout" | "double" | "bingo" | null => {
      const g = board.grid;
      const hit = (r: number, c: number) => isCalledIn(g[r][c].text, called);
      const lines = [
        [0,1,2,3,4].map(c => hit(0,c)), [0,1,2,3,4].map(c => hit(1,c)),
        [0,1,2,3,4].map(c => hit(2,c)), [0,1,2,3,4].map(c => hit(3,c)),
        [0,1,2,3,4].map(c => hit(4,c)), [0,1,2,3,4].map(r => hit(r,0)),
        [0,1,2,3,4].map(r => hit(r,1)), [0,1,2,3,4].map(r => hit(r,2)),
        [0,1,2,3,4].map(r => hit(r,3)), [0,1,2,3,4].map(r => hit(r,4)),
        [0,1,2,3,4].map(i => hit(i,i)), [0,1,2,3,4].map(i => hit(i,4-i)),
      ];
      const completed = lines.filter(l => l.every(Boolean)).length;
      if (g.flat().every(cell => isCalledIn(cell.text, called))) return "blackout";
      if (completed >= 2) return "double";
      if (completed >= 1) return "bingo";
      return null;
    };
    const hits: CalledResult["hits"] = [];
    boards.forEach((board, bi) => {
      const coords: HitCoord[] = [];
      board.grid.forEach((row, ri) =>
        row.forEach((cell, ci) => {
          if (normalize(cell.text) === resolved) coords.push({ row: ri, col: ci });
        })
      );
      if (coords.length) hits.push({ boardIndex: bi, coords, status: getBingoStatusWith(board, newCalledSongs) });
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

  const usedOnActiveBoard = activeEdit
    ? new Set(boards[activeEdit.bi]?.grid.flat().map(c => normalize(c.text)).filter(Boolean))
    : new Set<string>();
  const suggestions = activeEdit
    ? getSuggestions(activeEdit.query).sort((a, b) => {
        const aUsed = usedOnActiveBoard.has(normalize(a)) ? 1 : 0;
        const bUsed = usedOnActiveBoard.has(normalize(b)) ? 1 : 0;
        return aUsed - bUsed;
      })
    : [];
  const callSuggestions = searchQuery.trim()
    ? getSuggestions(searchQuery)
        .filter((s) => normalize(s) !== normalize(searchQuery))
        .sort((a, b) => {
          const aCalled = calledSongs.has(normalize(a)) ? 1 : 0;
          const bCalled = calledSongs.has(normalize(b)) ? 1 : 0;
          return aCalled - bCalled;
        })
    : [];

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight text-white uppercase">My Boards</h1>
          {calledSongs.size > 0 && (
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1">
              {calledSongs.size} called
            </span>
          )}
        </div>

        {/* Search / call a song */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter a song name…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (lastResult) setLastResult(null); setLookupState("idle"); setLookupResult(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") callSong(); }}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={() => callSong()}
              disabled={!searchQuery.trim()}
              className="px-4 py-3 rounded-lg bg-green-700 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-semibold transition-colors"
            >
              Call
            </button>
          </div>

          {callSuggestions.length > 0 && (
            <div className="flex flex-col rounded-lg overflow-hidden border border-zinc-700">
              {callSuggestions.map((s) => {
                const alreadyCalled = calledSongs.has(normalize(s));
                return (
                  <button
                    key={s}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => { setSearchQuery(s); if (lastResult) setLastResult(null); }}
                    className={`text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-b border-zinc-700 last:border-0 transition-colors ${alreadyCalled ? "line-through text-red-500" : "text-zinc-200"}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}

          {lastResult && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 flex flex-col gap-2">
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                "{lastResult.song}"
              </p>
              <div className="flex flex-wrap gap-3 items-start">
                {boards.map((board, bi) => {
                  const hit = lastResult.hits.find((h) => h.boardIndex === bi);
                  const status = hit?.status ?? null;
                  return (
                    <div key={bi} className="flex flex-col items-center gap-1">
                      <p className="text-zinc-500 text-[10px]">{board.name || `Board ${bi + 1}`}</p>
                      <button onClick={() => boardRefs.current[bi]?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                        <MiniBingoBoard board={board} hitCoords={hit?.coords ?? []} calledSongs={calledSongs} />
                      </button>
                      {status === "blackout" && <span className="text-[10px] font-bold uppercase tracking-wide bg-yellow-500 text-black rounded px-1.5 py-0.5">Blackout!</span>}
                      {status === "double" && <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-600 text-white rounded px-1.5 py-0.5">Double Bingo!</span>}
                      {status === "bingo" && <span className="text-[10px] font-bold uppercase tracking-wide bg-green-600 text-white rounded px-1.5 py-0.5">Bingo!</span>}
                    </div>
                  );
                })}
              </div>
              {lastResult.hits.length === 0 && lookupState === "idle" && spotifyConnected && (
                <button
                  onClick={() => identifyShow(lastResult.song)}
                  className="self-start text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Which show is this?
                </button>
              )}
              {lookupState === "loading" && (
                <p className="text-zinc-500 text-xs">Asking Claude...</p>
              )}
              {lookupState === "done" && lookupResult && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-zinc-300 text-xs">Sounds like <span className="text-white font-semibold">{lookupResult}</span></span>
                  <button
                    onClick={() => { callSong(lookupResult, lastResult?.song ?? undefined); setLookupState("idle"); setLookupResult(null); setLastResult(null); }}
                    className="text-xs bg-green-700 hover:bg-green-600 text-white rounded-lg px-3 py-1 font-semibold transition-colors"
                  >
                    Call it
                  </button>
                </div>
              )}
              {lookupState === "done" && !lookupResult && (
                <p className="text-zinc-500 text-xs">Claude couldn't match it to a show on the board</p>
              )}
            </div>
          )}

          {calledSongs.size > 0 && (
            <div className="pt-1">
              <div className={`flex flex-wrap gap-1 ${!showAllCalled ? "max-h-18 overflow-hidden" : ""}`}>
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
              {calledSongs.size > 10 && (
                <button
                  onClick={() => setShowAllCalled((v) => !v)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 mt-1 transition-colors"
                >
                  {showAllCalled ? "show less" : `view more (${calledSongs.size})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Boards */}
        {boards.map((board, bi) => (
          <div key={bi} ref={(el) => { boardRefs.current[bi] = el; }} className="flex flex-col gap-2">
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

            {/* Inline suggestions — desktop only */}
            {activeEdit?.bi === bi && suggestions.length > 0 && (
              <div className="hidden md:flex flex-col rounded-lg overflow-hidden border border-zinc-700">
                {suggestions.map((s) => {
                  const used = usedOnActiveBoard.has(normalize(s));
                  return (
                    <button
                      key={s}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => handleSuggestionTap(s)}
                      className={`text-left px-3 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border-b border-zinc-700 last:border-0 transition-colors ${used ? "line-through text-red-500" : "text-zinc-200"}`}
                    >
                      {s}
                    </button>
                  );
                })}
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
            resetCount();
          }}
          className="text-xs text-zinc-700 hover:text-red-500 transition-colors mx-auto pb-4"
        >
          Reset everything
        </button>
      </div>

      {/* Fixed suggestion bar — sits above keyboard on mobile */}
      {activeEdit && suggestions.length > 0 && (
        <div className="md:hidden fixed left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-700 flex overflow-x-auto" style={{ bottom: keyboardOffset }}>
          {suggestions.map((s) => {
            const used = usedOnActiveBoard.has(normalize(s));
            return (
              <button
                key={s}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionTap(s)}
                className={`shrink-0 px-4 py-3 text-sm hover:bg-zinc-700 active:bg-zinc-600 border-r border-zinc-700 last:border-0 transition-colors whitespace-nowrap ${used ? "line-through text-red-500" : "text-zinc-200"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
