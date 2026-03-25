import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: { Authorization: authHeader },
    cache: "no-store",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? "Failed" }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playlists = data.items?.map((p: any) => ({
    id: p.id,
    name: p.name,
    total: p.tracks?.total ?? 0,
    image: p.images?.[0]?.url ?? null,
  })) ?? [];

  return NextResponse.json({ playlists });
}
