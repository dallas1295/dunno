import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { tokenService } from "@/services/token";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    if (await tokenService.isTokenBlacklisted(token)) {
      return NextResponse.json(
        { success: false, message: "Token has been blacklisted." },
        { status: 401 },
      );
    }

    await tokenService.verifyToken(token);
    return NextResponse.next();
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Invalid or expired token." },
      { status: 401 },
    );
  }
}

export const config = {
  matcher: ["/((?!api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)"],
};
