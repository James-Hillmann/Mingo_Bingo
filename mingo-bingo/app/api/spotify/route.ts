import { NextRequest, NextResponse } from "next/server";

export type Track = {
  name: string;
  artist: string;
  image: string | null;
};

function extractPlaylistId(input: string): string | null {
  const match = input.trim().match(/playlist\/([A-Za-z0-9]+)/);
  if (match) return match[1];
  if (/^[A-Za-z0-9]{22}$/.test(input.trim())) return input.trim();
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("playlist") ?? "";
  const playlistId = extractPlaylistId(raw);
  if (!playlistId) {
    return NextResponse.json({ error: "Invalid playlist URL or ID" }, { status: 400 });
  }

  // Get an app-level token via Client Credentials — works for public playlists without user auth
  const ccRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  if (!ccRes.ok) {
    return NextResponse.json({ error: "Failed to get app token" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ccData: any = await ccRes.json();
  const headers = { Authorization: `Bearer ${ccData.access_token}` };

  const [metaRes, tracksRes] = await Promise.all([
    fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, { headers, cache: "no-store" }),
    fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, { headers, cache: "no-store" }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metaData, firstPage]: [any, any] = await Promise.all([metaRes.json(), tracksRes.json()]);

  if (!metaRes.ok) return NextResponse.json({ error: `${metaData?.error?.message ?? "Failed"} (${metaRes.status})` }, { status: 500 });
  if (!tracksRes.ok) return NextResponse.json({ error: `${firstPage?.error?.message ?? "Failed"} (${tracksRes.status})` }, { status: 500 });

  const tracks: Track[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractItems(data: any) {
    for (const item of data?.items ?? []) {
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
    const res = await fetch(nextUrl, { headers, cache: "no-store" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    if (!res.ok) break;
    extractItems(data);
    nextUrl = data.next ?? null;
  }

  return NextResponse.json({ name: metaData.name ?? "Playlist", tracks });
}
