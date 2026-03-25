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

  const expires = Date.now() + data.expires_in * 1000;

  // Store tokens in localStorage via JS — avoids all iOS cookie restrictions
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#09090b;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#a1a1aa}</style>
</head><body><p>Connecting to Spotify\u2026</p>
<script>
try {
  localStorage.setItem('sp_access', ${JSON.stringify(data.access_token)});
  localStorage.setItem('sp_refresh', ${JSON.stringify(data.refresh_token)});
  localStorage.setItem('sp_expires', ${JSON.stringify(String(expires))});
  localStorage.setItem('mingo-spotify-connected', 'true');
} catch(e) {}
window.location.replace('/songs?auth=1');
</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
