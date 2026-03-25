import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { code, verifier } = await req.json();
  if (!code || !verifier) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? "https://mingo-bingo.vercel.app/api/spotify/callback";

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      code_verifier: verifier,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.error_description ?? "Exchange failed" }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });
}
