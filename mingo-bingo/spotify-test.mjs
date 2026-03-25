import { readFileSync } from "fs";

// Load .env.local
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=").map((s) => s.trim()))
);

const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
const PLAYLIST_URL = process.argv[2] ?? "https://open.spotify.com/playlist/0XJOupcauVg7Ne0YADo2rD";

const playlistId = PLAYLIST_URL.match(/playlist\/([A-Za-z0-9]+)/)?.[1] ?? PLAYLIST_URL;

console.log("Client ID:", CLIENT_ID ? CLIENT_ID.slice(0, 8) + "..." : "MISSING");
console.log("Client Secret:", CLIENT_SECRET ? "SET" : "MISSING");
console.log("Playlist ID:", playlistId);
console.log("");

// Step 1: Get client credentials token
console.log("--- Step 1: Client Credentials Token ---");
const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
  },
  body: new URLSearchParams({ grant_type: "client_credentials" }),
});
const tokenData = await tokenRes.json();
console.log("Status:", tokenRes.status);
if (!tokenRes.ok) { console.log("Error:", tokenData); process.exit(1); }
const token = tokenData.access_token;
console.log("Token:", token.slice(0, 20) + "...");
console.log("");

const headers = { Authorization: `Bearer ${token}` };

// Step 2: GET /playlists/{id}
console.log("--- Step 2: GET /playlists/{id} ---");
const metaRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,tracks.total`, { headers });
const metaData = await metaRes.json();
console.log("Status:", metaRes.status);
console.log("Data:", JSON.stringify(metaData).slice(0, 200));
console.log("");

const userToken = process.env.USER_TOKEN;

// Step 2b: check /me to verify token and see user id
console.log("--- Step 2b: GET /me (verify token) ---");
if (userToken) {
  const meRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const meData = await meRes.json();
  console.log("Status:", meRes.status);
  console.log("User ID:", meData.id);
  console.log("Display name:", meData.display_name);
} else {
  console.log("Skipped — no user token");
}
console.log("");

// Step 3: GET /playlists/{id}/items with user token (if provided)
console.log("--- Step 3: GET /playlists/{id}/items (user token, your playlist) ---");
if (!userToken) {
  console.log("Skipped — run with: USER_TOKEN=your_token node spotify-test.mjs");
} else {
  const itemsRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items?limit=5`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const itemsData = await itemsRes.json();
  console.log("Status:", itemsRes.status);
  if (itemsRes.ok) {
    const tracks = itemsData.items?.map((i) => (i?.item ?? i?.track)?.name).filter(Boolean);
    console.log("Tracks:", tracks);
  } else {
    console.log("Error:", itemsData);
  }
}
console.log("");

// Step 3b: same endpoint on a known Spotify public playlist
console.log("--- Step 3b: GET /playlists/{id}/items (user token, Spotify's own public playlist) ---");
// "Today's Top Hits" — owned by Spotify, definitely public
const publicId = "37i9dQZF1DXcBWIGoYBM5M";
if (!userToken) {
  console.log("Skipped — no user token");
} else {
  const pubRes = await fetch(`https://api.spotify.com/v1/playlists/${publicId}/items?limit=5`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const pubData = await pubRes.json();
  console.log("Status:", pubRes.status);
  if (pubRes.ok) {
    const tracks = pubData.items?.map((i) => (i?.item ?? i?.track)?.name).filter(Boolean);
    console.log("Tracks:", tracks);
  } else {
    console.log("Error:", pubData);
  }
}
console.log("");

// Step 4: GET /playlists/{id}/tracks (deprecated)
console.log("--- Step 4: GET /playlists/{id}/tracks (deprecated) ---");
const tracksRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=5`, { headers });
const tracksData = await tracksRes.json();
console.log("Status:", tracksRes.status);
console.log("Data:", JSON.stringify(tracksData).slice(0, 300));
