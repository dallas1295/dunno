import { JWTPayload, jwtVerify, SignJWT } from "jose";
import { User } from "@/models/user";
import { RedisManager } from "@/services/valkey";
import { secretKey, tokenConfig, TokenPair } from "@/utils/token";
import "dotenv/config";

export interface UserPayload extends JWTPayload {
  userId: string;
  username: string;
  type?: string;
  recoveryAvailable?: boolean;
}

export const tokenService = {
  generateTokenPair: async (user: User): Promise<TokenPair> => {
    const payload: UserPayload = {
      userId: user.userId,
      username: user.username,
    };
    try {
      const accessToken = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(tokenConfig.issuer)
        .setAudience(tokenConfig.audience)
        .setExpirationTime(tokenConfig.accessTokenExpiry)
        .sign(secretKey);

      const refreshToken = await new SignJWT({
        ...payload,
        type: "refresh",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(tokenConfig.issuer)
        .setAudience(tokenConfig.audience)
        .setExpirationTime(tokenConfig.refreshTokenExpiry)
        .sign(secretKey);

      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
      };
    } catch (error) {
      console.error("Error generating tokens:", error);
      throw new Error("Failed to generate tokens");
    }
  },

  verifyToken: async (token: string): Promise<UserPayload> => {
    try {
      const isBlacklisted = await tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error("Token is blacklisted");
      }

      const { payload } = await jwtVerify(token, secretKey, {
        issuer: tokenConfig.issuer,
        audience: tokenConfig.audience,
      });

      return payload as UserPayload;
    } catch (error) {
      console.error("Token verification failed:", error);
      throw new Error("Invalid token");
    }
  },

  refreshAccessToken: async (refreshToken: string): Promise<string> => {
    try {
      const payload = await tokenService.verifyToken(refreshToken);

      if (payload["type"] !== "refresh") {
        throw new Error("Invalid token type");
      }

      const { ["type"]: _tokenType, ...tokenPayload } = payload;
      return await new SignJWT(tokenPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(tokenConfig.issuer)
        .setAudience(tokenConfig.audience)
        .setExpirationTime(tokenConfig.accessTokenExpiry)
        .sign(secretKey);
    } catch (error) {
      console.error("Error refreshing token:", error);
      throw new Error("Failed to refresh token");
    }
  },

  blacklistTokens: async (tokens: string[]): Promise<void> => {
    try {
      await Promise.all(
        tokens.map(async (token) => {
          try {
            const payloadB64 = token.split(".")[1];
            if (payloadB64) {
              const payloadString = Buffer.from(
                payloadB64,
                "base64url",
              ).toString("utf8");
              const payload = JSON.parse(payloadString) as JWTPayload;

              if (payload.exp) {
                const keyRedis = `blacklist:${token}`;
                const timeDiff = payload.exp - Math.floor(Date.now() / 1000);
                if (timeDiff > 0) {
                  await RedisManager.setex(keyRedis, timeDiff, "true");
                }
              }
            }
          } catch (error) {
            // Log error for individual token processing but don't fail the whole batch
            console.error(
              `Failed to process token for blacklisting: ${token}`,
              error,
            );
          }
        }),
      );
    } catch (error) {
      // This will catch errors from Promise.all if it's configured to fail fast,
      // though with individual try/catch, it's less likely.
      console.error("Error blacklisting tokens:", error);
      throw new Error("Failed to blacklist tokens");
    }
  },

  isTokenBlacklisted: async (token: string): Promise<boolean> => {
    try {
      const keyRedis = `blacklist:${token}`;
      const client = await RedisManager.getClient();
      const result = await client.get(keyRedis);
      return result !== null;
    } catch (error) {
      console.error("Error checking blacklist:", error);
      throw new Error("Failed to check token blacklist");
    }
  },
  generateTempToken: async (
    userId: string,
    expiry: string,
    recoveryAvailable: boolean,
  ): Promise<string> => {
    try {
      const tempToken = await new SignJWT({
        userId,
        type: "temp",
        recoveryAvailable,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer(tokenConfig.issuer)
        .setAudience(tokenConfig.audience)
        .setExpirationTime(expiry)
        .sign(secretKey);

      return tempToken;
    } catch (error) {
      console.error("Error generating temporary token:", error);
      throw new Error("Failed to generate temporary token");
    }
  },

  verifyTempToken: async (token: string): Promise<UserPayload> => {
    try {
      const { payload } = await jwtVerify(token, secretKey, {
        issuer: tokenConfig.issuer,
        audience: tokenConfig.audience,
      });

      if (payload.type !== "temp") {
        throw new Error("Invalid temporary token");
      }

      return payload as UserPayload;
    } catch (error) {
      console.error("Temporary token verification failed:", error);
      throw new Error("Invalid temporary token");
    }
  },
};
