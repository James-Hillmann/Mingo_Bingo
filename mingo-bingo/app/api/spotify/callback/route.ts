import { NextRequest, NextResponse } from "next/server";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

  // iOS Safari ITP blocks cookies set on cross-site redirect responses.
  // Work around it by returning an HTML page that auto-submits a same-site
  // form POST — Safari treats that as first-party and allows the cookies.
  const html = `<!DOCTYPE html><html><body>
<form id="f" method="POST" action="/api/spotify/finalize">
  <input type="hidden" name="access" value="${escapeHtml(data.access_token)}">
  <input type="hidden" name="refresh" value="${escapeHtml(data.refresh_token)}">
  <input type="hidden" name="expires_in" value="${Number(data.expires_in)}">
</form>
<script>document.getElementById('f').submit();</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
