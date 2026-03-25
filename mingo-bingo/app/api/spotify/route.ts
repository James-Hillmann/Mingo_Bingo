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

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }
  const token = authHeader.slice(7);

  const headers = { Authorization: `Bearer ${token}` };

  const [metaRes, tracksRes] = await Promise.all([
    fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, { headers, cache: "no-store" }),
    fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, { headers, cache: "no-store" }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [metaData, firstPage]: [any, any] = await Promise.all([metaRes.json(), tracksRes.json()]);

  if (!metaRes.ok) {
    return NextResponse.json(
      { error: `meta ${metaRes.status}: ${JSON.stringify(metaData)}` },
      { status: metaRes.status === 401 ? 401 : 500 }
    );
  }
  if (!tracksRes.ok) {
    return NextResponse.json(
      { error: `tracks ${tracksRes.status}: ${JSON.stringify(firstPage)}` },
      { status: tracksRes.status === 401 ? 401 : 500 }
    );
  }

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
