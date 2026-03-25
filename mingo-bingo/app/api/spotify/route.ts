import { NextRequest, NextResponse } from "next/server";

export type Track = {
  name: string;
  artist: string;
  image: string | null;
};

async function getValidToken(req: NextRequest): Promise<{ token: string; newCookies?: { access: string; expires: number } }> {
  const token = req.cookies.get("sp_access")?.value;
  const refreshToken = req.cookies.get("sp_refresh")?.value;
  const expiresAt = Number(req.cookies.get("sp_expires")?.value ?? "0");

  if (token && Date.now() < expiresAt - 60_000) return { token };
  if (!refreshToken) throw new Error("NOT_AUTHENTICATED");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
  });

  if (!res.ok) throw new Error("NOT_AUTHENTICATED");
  const data = await res.json();
  return {
    token: data.access_token,
    newCookies: { access: data.access_token, expires: Date.now() + data.expires_in * 1000 },
  };
}

async function fetchPlaylist(playlistId: string, token: string): Promise<{ name: string; tracks: Track[] }> {
  const headers = { Authorization: `Bearer ${token}` };

  const [metaRes, tracksRes] = await Promise.all([
    fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, { headers, cache: "no-store" }),
    fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, { headers, cache: "no-store" }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metaData, firstPage]: [any, any] = await Promise.all([metaRes.json(), tracksRes.json()]);

  if (!metaRes.ok) throw new Error(metaData?.error?.message ?? "Failed to fetch playlist");
  if (!tracksRes.ok) throw new Error(firstPage?.error?.message ?? "Failed to fetch tracks");

  const playlistName: string = metaData.name ?? "Playlist";
  const tracks: Track[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractItems(data: any) {
    if (!data) return;
    for (const item of data.items ?? []) {
      const t = item?.track;
      if (!t?.name) continue;
      tracks.push({
        name: t.name,
        artist: t.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Unknown",
        image: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
      });
    }
  }

  extractItems(firstPage);
  let nextUrl: string | null = firstPage?.next ?? null;

  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers, cache: "no-store" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    if (!res.ok) break;
    extractItems(data);
    nextUrl = data.next ?? null;
  }

  return { name: playlistName, tracks };
}

function extractPlaylistId(input: string): string | null {
  const clean = input.trim();
  const match = clean.match(/playlist\/([A-Za-z0-9]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9]{22}$/.test(clean)) return clean;
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("playlist") ?? "";
  const playlistId = extractPlaylistId(raw);

  if (!playlistId) {
    return NextResponse.json({ error: "Invalid playlist URL or ID" }, { status: 400 });
  }

  try {
    const { token, newCookies } = await getValidToken(req);
    const { name, tracks } = await fetchPlaylist(playlistId, token);

    const response = NextResponse.json({ name, tracks });
    if (newCookies) {
      const secure = process.env.NODE_ENV === "production";
      const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", secure };
      const maxAge = Math.floor((newCookies.expires - Date.now()) / 1000);
      response.cookies.set("sp_access", newCookies.access, { ...opts, maxAge });
      response.cookies.set("sp_expires", String(newCookies.expires), { ...opts, maxAge });
    }
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "NOT_AUTHENTICATED") {
      return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
