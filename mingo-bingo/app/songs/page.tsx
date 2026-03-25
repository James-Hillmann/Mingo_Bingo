"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Track } from "@/app/api/spotify/route";
import { KEYS } from "@/lib/keys";

// ── PKCE ─────────────────────────────────────────────────────────────────────

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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(digest);
}

// ── Token storage ─────────────────────────────────────────────────────────────

function saveTokens(access: string, refresh: string, expiresIn: number) {
  localStorage.setItem(KEYS.spAccess, access);
  localStorage.setItem(KEYS.spRefresh, refresh);
  localStorage.setItem(KEYS.spExpires, String(Date.now() + expiresIn * 1000));
}

function clearTokens() {
  [KEYS.spAccess, KEYS.spRefresh, KEYS.spExpires, KEYS.spotifyConnected].forEach((k) =>
    localStorage.removeItem(k)
  );
}

async function getToken(): Promise<string | null> {
  const access = localStorage.getItem(KEYS.spAccess);
  const expires = Number(localStorage.getItem(KEYS.spExpires) ?? "0");
  const refresh = localStorage.getItem(KEYS.spRefresh);
  if (!refresh) return null;

  // Return existing token if not expired
  if (access && Date.now() < expires - 60_000) return access;

  // Refresh
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
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [calledSongs, setCalledSongs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mounted, setMounted] = useState(false);
  const codeHandled = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const authError = searchParams.get("auth_error");

    if (code && !codeHandled.current) {
      codeHandled.current = true;
      handleExchange(code);
      return;
    }

    try {
      if (searchParams.get("disconnected") === "1") clearTokens();
      const url = localStorage.getItem(KEYS.songsUrl);
      const name = localStorage.getItem(KEYS.songsName);
      const saved = localStorage.getItem(KEYS.songsTracks);
      const called = localStorage.getItem(KEYS.calledSongs);
      if (url) setPlaylistUrl(url);
      if (name) setPlaylistName(name);
      if (saved) setTracks(JSON.parse(saved));
      if (called) setCalledSongs(new Set(JSON.parse(called)));
      if (authError) setError("Spotify connection failed. Try again.");
      setConnected(!!localStorage.getItem(KEYS.spRefresh));
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
      saveTokens(data.access_token, data.refresh_token, data.expires_in);
      window.history.replaceState({}, "", "/songs");
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    }
    // Load saved state
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
  }

  async function handleConnect() {
    setError(null);
    const verifier = makeVerifier();
    const challenge = await makeChallenge(verifier);
    sessionStorage.setItem("pkce_verifier", verifier);
    window.location.href = `/api/spotify/login?code_challenge=${encodeURIComponent(challenge)}`;
  }

  async function loadPlaylist() {
    const url = playlistUrl.trim();
    if (!url) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { clearTokens(); setConnected(false); return; }

      const res = await fetch(`/api/spotify?playlist=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401) { clearTokens(); setConnected(false); return; }
      if (!res.ok) throw new Error(`${data.error ?? "Failed"} (${res.status})`);

      alert(JSON.stringify(data._debug));
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

        {!connected ? (
          <div className="flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5">
            <p className="text-white text-sm font-semibold">Connect Spotify</p>
            <p className="text-zinc-400 text-xs">Sign in with Spotify to load playlist songs.</p>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={handleConnect}
              className="flex items-center justify-center px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
            >
              Connect with Spotify
            </button>
          </div>
        ) : (
          <>
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

            <button onClick={() => { clearTokens(); setConnected(false); }} className="text-zinc-600 hover:text-zinc-400 text-xs text-center transition-colors">
              Disconnect Spotify
            </button>

            {/* TEMP DEBUG */}
            <button onClick={async () => {
              const raw = localStorage.getItem("sp_access");
              const refresh = localStorage.getItem("sp_refresh");
              const expires = localStorage.getItem("sp_expires");
              const token = await getToken();
              const res = token ? await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } }) : null;
              const data = res ? await res.json() : null;
              alert(
                `sp_access: ${raw ? raw.slice(0,30)+"..." : "MISSING"}\n` +
                `sp_refresh: ${refresh ? refresh.slice(0,20)+"..." : "MISSING"}\n` +
                `sp_expires: ${expires ? new Date(Number(expires)).toISOString() : "MISSING"}\n` +
                `getToken(): ${token ? token.slice(0,30)+"..." : "NULL"}\n` +
                `/me status: ${res?.status ?? "not called"}\n` +
                `/me body: ${JSON.stringify(data)}`
              );
            }} className="text-zinc-700 text-xs text-center">
              Debug: test token
            </button>
          </>
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
