"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Track } from "@/app/api/spotify/route";
import { KEYS } from "@/lib/keys";

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function makeVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return b64url(arr);
}
async function makeChallenge(verifier: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function clearTokens() {
  [KEYS.spAccess, KEYS.spRefresh, KEYS.spExpires].forEach((k) => localStorage.removeItem(k));
}

async function getToken(): Promise<string | null> {
  const access = localStorage.getItem(KEYS.spAccess);
  const expires = Number(localStorage.getItem(KEYS.spExpires) ?? "0");
  const refresh = localStorage.getItem(KEYS.spRefresh);
  if (!refresh) return null;
  if (access && Date.now() < expires - 60_000) return access;
  const res = await fetch("/api/spotify/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  localStorage.setItem(KEYS.spAccess, data.access_token);
  localStorage.setItem(KEYS.spExpires, String(Date.now() + data.expires_in * 1000));
  return data.access_token;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Playlist = { id: string; name: string; total: number; image: string | null };

// ── Components ────────────────────────────────────────────────────────────────

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
  const searchParams = useSearchParams();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [calledSongs, setCalledSongs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [songSearch, setSongSearch] = useState("");
  const codeHandled = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !codeHandled.current) {
      codeHandled.current = true;
      handleExchange(code);
      return;
    }
    try {
      const name = localStorage.getItem(KEYS.songsName);
      const saved = localStorage.getItem(KEYS.songsTracks);
      const called = localStorage.getItem(KEYS.calledSongs);
      if (name) setPlaylistName(name);
      if (saved) setTracks(JSON.parse(saved));
      if (called) setCalledSongs(new Set(JSON.parse(called)));
      const hasToken = !!localStorage.getItem(KEYS.spRefresh);
      setConnected(hasToken);
      if (hasToken && !saved) fetchPlaylists();
    } catch {}
    setMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExchange(code: string) {
    const verifier = sessionStorage.getItem("pkce_verifier");
    sessionStorage.removeItem("pkce_verifier");
    try {
      if (!verifier) throw new Error("Missing verifier — please try connecting again.");
      const res = await fetch("/api/spotify/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, verifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Exchange failed");
      localStorage.setItem(KEYS.spAccess, data.access_token);
      localStorage.setItem(KEYS.spRefresh, data.refresh_token);
      localStorage.setItem(KEYS.spExpires, String(Date.now() + data.expires_in * 1000));
      window.history.replaceState({}, "", "/songs");
      setConnected(true);
      fetchPlaylists();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
    try {
      const name = localStorage.getItem(KEYS.songsName);
      const saved = localStorage.getItem(KEYS.songsTracks);
      const called = localStorage.getItem(KEYS.calledSongs);
      if (name) setPlaylistName(name);
      if (saved) setTracks(JSON.parse(saved));
      if (called) setCalledSongs(new Set(JSON.parse(called)));
    } catch {}
    setMounted(true);
  }

  async function fetchPlaylists() {
    setLoadingPlaylists(true);
    try {
      const token = await getToken();
      if (!token) { clearTokens(); setConnected(false); return; }
      const res = await fetch("/api/spotify/playlists", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401) { clearTokens(); setConnected(false); return; }
      if (res.ok) setPlaylists(data.playlists);
    } catch {}
    setLoadingPlaylists(false);
  }

  async function loadPlaylist(id: string, name: string) {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { clearTokens(); setConnected(false); return; }
      const res = await fetch(`/api/spotify?playlist=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401) { clearTokens(); setConnected(false); return; }
      if (!res.ok) throw new Error(data.error ?? "Failed to load playlist");
      setTracks(data.tracks);
      setPlaylistName(name);
      localStorage.setItem(KEYS.songsName, name);
      localStorage.setItem(KEYS.songsTracks, JSON.stringify(data.tracks));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setError(null);
    const verifier = makeVerifier();
    const challenge = await makeChallenge(verifier);
    sessionStorage.setItem("pkce_verifier", verifier);
    window.location.href = `/api/spotify/login?code_challenge=${encodeURIComponent(challenge)}`;
  }

  function unload() {
    setTracks([]); setPlaylistName(null);
    [KEYS.songsName, KEYS.songsTracks].forEach((k) => localStorage.removeItem(k));
  }

  if (!mounted) return null;

  const unplayed = tracks.filter((t) => !calledSongs.has(t.name.toLowerCase().trim()));
  const played = tracks.filter((t) => calledSongs.has(t.name.toLowerCase().trim()));

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-xl font-black tracking-tight text-white uppercase">Songs</h1>

        {!connected ? (
          <div className="flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5">
            <p className="text-white text-sm font-semibold">Connect Spotify</p>
            <p className="text-zinc-400 text-xs">Sign in to load songs from your playlists.</p>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button onClick={handleConnect} className="flex items-center justify-center px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors">
              Connect with Spotify
            </button>
          </div>
        ) : tracks.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="flex flex-col min-w-0">
                <p className="text-white text-sm font-semibold truncate">{playlistName}</p>
                <p className="text-zinc-500 text-xs">{tracks.length} songs</p>
              </div>
              <button onClick={unload} className="shrink-0 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-700 border border-red-800 text-red-300 hover:text-white text-xs font-semibold transition-colors">
                Change
              </button>
            </div>

            <input
              type="text"
              placeholder="Search songs…"
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-500"
            />

            {songSearch.trim() ? (
              (() => {
                const q = songSearch.toLowerCase().trim();
                const results = tracks.filter((t) => t.name.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
                return results.length === 0 ? (
                  <p className="text-zinc-600 text-sm text-center py-4">No songs found</p>
                ) : (
                  <div className="flex flex-col divide-y divide-zinc-800/60">
                    {results.map((t, i) => <TrackRow key={i} track={t} played={calledSongs.has(t.name.toLowerCase().trim())} />)}
                  </div>
                );
              })()
            ) : (
              <>
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
              </>
            )}

            <button onClick={() => { clearTokens(); setConnected(false); setTracks([]); setPlaylistName(null); }} className="text-zinc-600 hover:text-zinc-400 text-xs text-center transition-colors">
              Disconnect Spotify
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-white text-sm font-semibold">Your Playlists</p>
                <button onClick={fetchPlaylists} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">Refresh</button>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              {loadingPlaylists ? (
                <p className="text-zinc-500 text-sm text-center py-6">Loading playlists…</p>
              ) : playlists.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-6">No playlists found</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {playlists.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => loadPlaylist(p.id, p.name)}
                      disabled={loading}
                      className="flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-50"
                    >
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" width={44} height={44} className="rounded w-11 h-11 object-cover shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded bg-zinc-800 shrink-0" />
                      )}
                      <div className="flex flex-col min-w-0">
                        <p className="text-white text-sm font-medium truncate">{p.name}</p>
                        <p className="text-zinc-500 text-xs">{p.total} songs</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => { clearTokens(); setConnected(false); }} className="text-zinc-600 hover:text-zinc-400 text-xs text-center transition-colors">
              Disconnect Spotify
            </button>
          </>
        )}
      </div>
    </main>
  );
}
