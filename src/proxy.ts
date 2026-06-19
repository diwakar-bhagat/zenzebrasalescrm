import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Routes that don't require authentication
const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/verify", "/api/public", "/api/webhooks"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes and static assets
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Only protect dashboard routes and dashboard API routes
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/dashboard") ||
    pathname.startsWith("/api/founder") ||
    pathname.startsWith("/api/sales") ||
    pathname === "/register";

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = req.cookies.get("zz_session")?.value;

  if (!sessionToken) {
    // Redirect to login for page requests, return 401 for API
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const check = await fetch(new URL("/api/auth/verify", req.url).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: sha256(sessionToken) }),
  });

  if (!check.ok) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
