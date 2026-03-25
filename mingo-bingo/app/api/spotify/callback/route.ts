import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/songs?auth_error=1", req.url));
  }

  return NextResponse.redirect(new URL(`/songs?code=${encodeURIComponent(code)}`, req.url));
}
