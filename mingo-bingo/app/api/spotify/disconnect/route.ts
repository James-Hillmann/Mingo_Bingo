import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/songs?disconnected=1", req.url));
  response.cookies.delete("sp_access");
  response.cookies.delete("sp_refresh");
  response.cookies.delete("sp_expires");
  return response;
}
