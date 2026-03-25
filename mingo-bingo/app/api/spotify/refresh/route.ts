import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { refresh_token } = await req.json();
  if (!refresh_token) return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token }).toString(),
  });

  if (!res.ok) return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  const data = await res.json();
  return NextResponse.json({ access_token: data.access_token, expires_in: data.expires_in });
}
