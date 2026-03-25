import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/songs?auth_error=1", req.url));

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI ?? "https://mingo-bingo.vercel.app/api/spotify/callback";

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.redirect(new URL("/songs?auth_error=1", req.url));

  const response = NextResponse.redirect(new URL("/songs?auth=1", req.url));
  const secure = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", secure };

  response.cookies.set("sp_access", data.access_token, { ...opts, maxAge: data.expires_in });
  response.cookies.set("sp_refresh", data.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 60 });
  response.cookies.set("sp_expires", String(Date.now() + data.expires_in * 1000), { ...opts, maxAge: data.expires_in });

  return response;
}
