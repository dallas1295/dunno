import { tokenService } from "@/services/token";
import { ResponseUtil } from "@/utils/response";
import { NextApiRequest, NextApiResponse } from "next";
import { JWTPayload } from "jose";

export async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<JWTPayload | null> {
  try {
    const token = req.cookies["accessToken"];
    if (!token) {
      ResponseUtil.unauthorized(res, "No access token cookie");
      return null;
    }

    if (await tokenService.isTokenBlacklisted(token)) {
      ResponseUtil.unauthorized(res, "Token has been blacklisted");
      return null;
    }

    const payload = await tokenService.verifyToken(token);
    return payload;
  } catch (error: any) {
    if (error?.code === "ERR_JWT_EXPIRED") {
      ResponseUtil.unauthorized(res, "Token expired");
    } else if (error?.code === "ERR_JWT_INVALID") {
      ResponseUtil.unauthorized(res, "Token invalid");
    } else {
      console.error("Authentication error:", error);
      ResponseUtil.internalError(res, "Internal server error");
    }
    return null;
  }
}
