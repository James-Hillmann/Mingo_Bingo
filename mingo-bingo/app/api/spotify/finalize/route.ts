import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const access = form.get("access") as string;
  const refresh = form.get("refresh") as string;
  const expiresIn = Number(form.get("expires_in"));

  if (!access || !refresh) {
    return NextResponse.redirect(new URL("/songs?auth_error=1", req.url));
  }

  const secure = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", secure };

  const response = NextResponse.redirect(new URL("/songs?auth=1", req.url), { status: 303 });
  response.cookies.set("sp_access", access, { ...opts, maxAge: expiresIn });
  response.cookies.set("sp_refresh", refresh, { ...opts, maxAge: 60 * 60 * 24 * 60 });
  response.cookies.set("sp_expires", String(Date.now() + expiresIn * 1000), { ...opts, maxAge: expiresIn });

  return response;
}
