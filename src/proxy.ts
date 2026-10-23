import { NextRequest, NextResponse } from "next/server";

// yahan par commit ke liye change kiya hai
export function proxy(req: NextRequest) {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Basic ")) {
    const pass = atob(h.slice(6)).split(":").slice(1).join(":");
    if (pass === process.env.APP_PASSWORD) return NextResponse.next();
  }
  return new NextResponse("Auth required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="tracker"' },
  });
}

export const config = {
  matcher: ["/((?!_next|manifest.webmanifest|icon-).*)"],
};
