import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? "https://mingo-bingo.vercel.app/api/spotify/callback";
  const codeChallenge = req.nextUrl.searchParams.get("code_challenge") ?? "";

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "playlist-read-private playlist-read-collaborative");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", codeChallenge);

  return NextResponse.redirect(url);
}
