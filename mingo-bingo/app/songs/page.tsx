"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Track } from "@/app/api/spotify/route";
import { KEYS } from "@/lib/keys";

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(digest));
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function clearTokens() {
  localStorage.removeItem(KEYS.spAccess);
  localStorage.removeItem(KEYS.spRefresh);
  localStorage.removeItem(KEYS.spExpires);
  localStorage.removeItem(KEYS.spotifyConnected);
}

async function getAccessToken(): Promise<string | null> {
  try {
    const token = localStorage.getItem(KEYS.spAccess);
    const expires = Number(localStorage.getItem(KEYS.spExpires) ?? "0");
    const refresh = localStorage.getItem(KEYS.spRefresh);

    if (!refresh) return null;
    if (token && Date.now() < expires - 60_000) return token;

    const res = await fetch("/api/spotify/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const newExpires = Date.now() + data.expires_in * 1000;
    localStorage.setItem(KEYS.spAccess, data.access_token);
    localStorage.setItem(KEYS.spExpires, String(newExpires));
    return data.access_token;
  } catch {
    return null;
  }
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
        <span className="text-zinc-500"> &mdash; </span>
        <span className="text-zinc-400">{track.artist}</span>
      </p>
    </div>
  );
}

export default function SongsPage() {
  return (
    <Suspense>
      <SongsContent />
    </Suspense>
  );
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
  const exchangeAttempted = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");

    // PKCE: complete the exchange if we got a code back from Spotify
    if (code && !exchangeAttempted.current) {
      exchangeAttempted.current = true;
      handleCodeExchange(code);
      return;
    }

    // Normal init
    try {
      const savedUrl = localStorage.getItem(KEYS.songsUrl);
      const savedName = localStorage.getItem(KEYS.songsName);
      const savedTracks = localStorage.getItem(KEYS.songsTracks);
      const savedCalled = localStorage.getItem(KEYS.calledSongs);

      if (savedUrl) setPlaylistUrl(savedUrl);
      if (savedName) setPlaylistName(savedName);
      if (savedTracks) setTracks(JSON.parse(savedTracks));
      if (savedCalled) setCalledSongs(new Set(JSON.parse(savedCalled)));

      if (searchParams.get("disconnected") === "1") {
        clearTokens();
        setConnected(false);
      } else if (searchParams.get("auth_error") === "1") {
        setError("Spotify connection failed. Try again.");
        setConnected(!!localStorage.getItem(KEYS.spRefresh));
      } else {
        setConnected(!!localStorage.getItem(KEYS.spRefresh));
      }
    } catch {}
    setMounted(true);
  }, [searchParams]);

  async function handleCodeExchange(code: string) {
    const verifier = sessionStorage.getItem("pkce_verifier");
    sessionStorage.removeItem("pkce_verifier");

    try {
      if (!verifier) throw new Error("Missing verifier");

      const res = await fetch("/api/spotify/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, verifier }),
      });
      if (!res.ok) throw new Error("Exchange failed");

      const data = await res.json();
      const expires = Date.now() + data.expires_in * 1000;

      localStorage.setItem(KEYS.spAccess, data.access_token);
      localStorage.setItem(KEYS.spRefresh, data.refresh_token);
      localStorage.setItem(KEYS.spExpires, String(expires));
      localStorage.setItem(KEYS.spotifyConnected, "true");

      window.history.replaceState({}, "", "/songs");
      setConnected(true);
    } catch {
      setError("Login failed. Please try again.");
    }

    // Load any saved playlist state
    try {
      const savedUrl = localStorage.getItem(KEYS.songsUrl);
      const savedName = localStorage.getItem(KEYS.songsName);
      const savedTracks = localStorage.getItem(KEYS.songsTracks);
      const savedCalled = localStorage.getItem(KEYS.calledSongs);
      if (savedUrl) setPlaylistUrl(savedUrl);
      if (savedName) setPlaylistName(savedName);
      if (savedTracks) setTracks(JSON.parse(savedTracks));
      if (savedCalled) setCalledSongs(new Set(JSON.parse(savedCalled)));
    } catch {}

    setMounted(true);
  }

  async function handleConnect() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem("pkce_verifier", verifier);
    window.location.href = `/api/spotify/login?code_challenge=${encodeURIComponent(challenge)}`;
  }

  function handleDisconnect() {
    clearTokens();
    setConnected(false);
  }

  function isPlayed(track: Track) {
    return calledSongs.has(track.name.toLowerCase().trim());
  }

  async function loadPlaylist() {
    const url = playlistUrl.trim();
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        clearTokens();
        setConnected(false);
        return;
      }

      const res = await fetch(`/api/spotify?playlist=${encodeURIComponent(url)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.status === 401) {
        clearTokens();
        setConnected(false);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Failed to load playlist");

      setTracks(data.tracks);
      setPlaylistName(data.name);
      localStorage.setItem(KEYS.songsUrl, url);
      localStorage.setItem(KEYS.songsName, data.name);
      localStorage.setItem(KEYS.songsTracks, JSON.stringify(data.tracks));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function unloadPlaylist() {
    setTracks([]);
    setPlaylistName(null);
    setPlaylistUrl("");
    localStorage.removeItem(KEYS.songsUrl);
    localStorage.removeItem(KEYS.songsName);
    localStorage.removeItem(KEYS.songsTracks);
  }

  if (!mounted) return null;

  const unplayed = tracks.filter((t) => !isPlayed(t));
  const played = tracks.filter((t) => isPlayed(t));
  const isLoaded = tracks.length > 0;

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <h1 className="text-xl font-black tracking-tight text-white uppercase">Songs</h1>

        {/* TEMP DEBUG - remove after fixing */}
        <div className="text-xs text-zinc-600 bg-zinc-900 rounded p-2 break-all">
          <p>refresh: {typeof window !== "undefined" ? (localStorage.getItem("sp_refresh") ? "✓ exists" : "✗ missing") : "?"}</p>
          <p>access: {typeof window !== "undefined" ? (localStorage.getItem("sp_access") ? "✓ exists" : "✗ missing") : "?"}</p>
          <p>verifier: {typeof window !== "undefined" ? (sessionStorage.getItem("pkce_verifier") ? "✓ exists" : "✗ missing") : "?"}</p>
          <p>url: {typeof window !== "undefined" ? window.location.search : "?"}</p>
        </div>

        {!connected ? (
          <div className="flex flex-col gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5">
            <p className="text-white text-sm font-semibold">Connect Spotify</p>
            <p className="text-zinc-400 text-xs">Sign in with Spotify to load playlist songs.</p>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={handleConnect}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors"
            >
              Connect with Spotify
            </button>
          </div>
        ) : (
          <>
            {isLoaded ? (
              <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="flex flex-col min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{playlistName}</p>
                  <p className="text-zinc-500 text-xs">{tracks.length} songs</p>
                </div>
                <button
                  onClick={unloadPlaylist}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-700 border border-red-800 text-red-300 hover:text-white text-xs font-semibold transition-colors"
                >
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

            {!isLoaded && !loading && !error && (
              <p className="text-zinc-600 text-sm text-center py-8">
                Paste a Spotify playlist URL above to load songs
              </p>
            )}

            <button
              onClick={handleDisconnect}
              className="text-zinc-600 hover:text-zinc-400 text-xs text-center transition-colors"
            >
              Disconnect Spotify
            </button>
          </>
        )}

        {unplayed.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Unplayed — {unplayed.length}
            </p>
            <div className="flex flex-col divide-y divide-zinc-800/60">
              {unplayed.map((track, i) => (
                <TrackRow key={i} track={track} played={false} />
              ))}
            </div>
          </div>
        )}

        {played.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Played — {played.length}
            </p>
            <div className="flex flex-col divide-y divide-zinc-800/60">
              {played.map((track, i) => (
                <TrackRow key={i} track={track} played={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
