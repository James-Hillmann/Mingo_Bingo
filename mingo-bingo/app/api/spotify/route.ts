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

  // Use the single playlist endpoint — includes name + first 100 tracks
  // Avoids /playlists/{id}/tracks which Spotify blocks for some app configurations
  const playlistRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=name,tracks.items(track(name,artists(name),album(images))),tracks.next`,
    { headers, cache: "no-store" }
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playlistData: any = await playlistRes.json();

  if (!playlistRes.ok) {
    return NextResponse.json(
      { error: `${playlistData?.error?.message ?? "Failed"} (${playlistRes.status})` },
      { status: playlistRes.status === 401 ? 401 : 500 }
    );
  }

  const tracks: Track[] = [];
  for (const item of playlistData?.tracks?.items ?? []) {
    const t = item?.track;
    if (!t?.name) continue;
    tracks.push({
      name: t.name,
      artist: t.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Unknown",
      image: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
    });
  }

  return NextResponse.json({ name: playlistData.name ?? "Playlist", tracks });
}
