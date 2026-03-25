"use client";

import { useState, useEffect, Suspense } from "react";
import type { Track } from "@/app/api/spotify/route";
import { KEYS } from "@/lib/keys";

function TrackRow({ track, played }: { track: Track; played: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 ${played ? "opacity-40" : ""}`}>
      {track.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.image} alt="" width={48} height={48} className="rounded w-12 h-12 object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded bg-zinc-800 shrink-0" />
      )}
      <p className={`text-sm leading-snug min-w-0 ${played ? "line-through text-zinc-500" : "text-zinc-200"}`}>
        {track.name}
        <span className="text-zinc-500"> — </span>
        <span className="text-zinc-400">{track.artist}</span>
      </p>
    </div>
  );
}

export default function SongsPage() {
  return <Suspense><SongsContent /></Suspense>;
}

function SongsContent() {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [calledSongs, setCalledSongs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const url = localStorage.getItem(KEYS.songsUrl);
      const name = localStorage.getItem(KEYS.songsName);
      const saved = localStorage.getItem(KEYS.songsTracks);
      const called = localStorage.getItem(KEYS.calledSongs);
      if (url) setPlaylistUrl(url);
      if (name) setPlaylistName(name);
      if (saved) setTracks(JSON.parse(saved));
      if (called) setCalledSongs(new Set(JSON.parse(called)));
    } catch {}
    setMounted(true);
  }, []);

  async function loadPlaylist() {
    const url = playlistUrl.trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spotify?playlist=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load playlist");
      setTracks(data.tracks);
      setPlaylistName(data.name);
      localStorage.setItem(KEYS.songsUrl, url);
      localStorage.setItem(KEYS.songsName, data.name);
      localStorage.setItem(KEYS.songsTracks, JSON.stringify(data.tracks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function unload() {
    setTracks([]); setPlaylistName(null); setPlaylistUrl("");
    [KEYS.songsUrl, KEYS.songsName, KEYS.songsTracks].forEach((k) => localStorage.removeItem(k));
  }

  if (!mounted) return null;

  const unplayed = tracks.filter((t) => !calledSongs.has(t.name.toLowerCase().trim()));
  const played = tracks.filter((t) => calledSongs.has(t.name.toLowerCase().trim()));

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-xl font-black tracking-tight text-white uppercase">Songs</h1>

        {tracks.length > 0 ? (
          <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <div className="flex flex-col min-w-0">
              <p className="text-white text-sm font-semibold truncate">{playlistName}</p>
              <p className="text-zinc-500 text-xs">{tracks.length} songs</p>
            </div>
            <button onClick={unload} className="shrink-0 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-700 border border-red-800 text-red-300 hover:text-white text-xs font-semibold transition-colors">
              Unload
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste Spotify playlist URL…"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") loadPlaylist(); }}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={loadPlaylist}
                disabled={!playlistUrl.trim() || loading}
                className="px-4 py-3 rounded-lg bg-green-700 hover:bg-green-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-semibold transition-colors"
              >
                {loading ? "…" : "Load"}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        )}

        {tracks.length === 0 && !loading && !error && (
          <p className="text-zinc-600 text-sm text-center py-8">Paste a Spotify playlist URL above to load songs</p>
        )}

        {unplayed.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Unplayed — {unplayed.length}</p>
            <div className="flex flex-col divide-y divide-zinc-800/60">
              {unplayed.map((t, i) => <TrackRow key={i} track={t} played={false} />)}
            </div>
          </div>
        )}
        {played.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Played — {played.length}</p>
            <div className="flex flex-col divide-y divide-zinc-800/60">
              {played.map((t, i) => <TrackRow key={i} track={t} played={true} />)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
