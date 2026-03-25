import { NextResponse } from "next/server";

export function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? "https://mingo-bingo.vercel.app/api/spotify/callback";
  const scope = "playlist-read-private playlist-read-collaborative";

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scope);
  url.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(url);
}
