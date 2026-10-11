import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ASSOCIE_ONLY_PREFIXES = ["/depenses", "/tresorerie", "/investissement", "/historique", "/equipe", "/parametres"];
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const claims = token
    ? await jwtVerify(token, secret, { algorithms: ["HS256"] })
        .then((r) => r.payload)
        .catch(() => null)
    : null;

  if (!claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (claims.role === "CHATTEUR" && ASSOCIE_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|icons/|sw.js|manifest.webmanifest).*)"],
};
