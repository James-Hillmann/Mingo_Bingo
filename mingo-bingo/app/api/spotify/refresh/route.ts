import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { refresh_token } = await req.json();
  if (!refresh_token) {
    return NextResponse.json({ error: "Missing refresh_token" }, { status: 400 });
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.error_description ?? "Refresh failed" }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.access_token,
    expires_in: data.expires_in,
  });
}
