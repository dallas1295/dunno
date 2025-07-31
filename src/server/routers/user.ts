import { router, publicRoute, protectedRoute, tempAuthRoute } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tokenService } from "@/services/token";
import { getUserService } from "@/config/service";
import { ErrorCounter, HTTPMetrics } from "@/utils/otel";
import { serialize } from "cookie";
import { verifyPassword } from "@/services/password";
import { RateLimiter } from "@/utils/rateLimit";
import { toUserResponse } from "@/dto/user";
import { makeUserLink } from "@/utils/links";

export const userRouter = router({
  register: publicRoute
    .input(
      z.object({
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", "/register");

      try {
        const service = await getUserService();
        if (await RateLimiter.isRateLimited(ctx.ip, input.username)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many registration attempts. Please try again later.",
          });
        }

        const user = await service.createUser(
          input.username,
          input.email,
          input.password,
        );

        const tokenPair = await tokenService.generateTokenPair(user);

        const isProd = process.env.NODE_ENV === "production";

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("accessToken", tokenPair.accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
          }),
        );

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("refreshToken", tokenPair.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
          }),
        );

        return {
          message: "User registered successfully",
          user: toUserResponse(user, {
            self: makeUserLink(user.userId, "self"),
          }),
        };
      } catch (error: any) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "register",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        // Handle specific error messages from service layer
        if (error.message.includes("already exists")) {
          throw new TRPCError({
            code: "CONFLICT",
            message: error.message,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error registering user",
        });
      }
    }),

  login: publicRoute
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", "/login");

      try {
        if (await RateLimiter.isRateLimited(ctx.ip, input.username)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many login attempts. Please try again later.",
          });
        }

        const service = await getUserService();
        const user = await service.findByUsername(input.username);

        if (!user) {
          await RateLimiter.trackAttempt(ctx.ip, input.username);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User doesn't exist",
          });
        }

        const checkPassword = await verifyPassword(
          user.passwordHash,
          input.password,
        );

        if (!checkPassword) {
          await RateLimiter.trackAttempt(ctx.ip, input.username);
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid password",
          });
        }

        await RateLimiter.resetAttempts(ctx.ip, input.username);

        if (user.twoFactorEnabled) {
          const recoveryAvailable = Boolean(
            user.recoveryCodes && user.recoveryCodes.length > 0,
          );

          const temp = await tokenService.generateTempToken(
            user.userId,
            "5m",
            recoveryAvailable,
          );

          return {
            requireTwoFactor: true,
            tempToken: temp,
            user: user.username,
            recoveryAvailable,
          };
        }

        const tokenPair = await tokenService.generateTokenPair(user);

        const isProd = process.env.NODE_ENV === "production";

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("accessToken", tokenPair.accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
          }),
        );

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("refreshToken", tokenPair.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
          }),
        );

        console.log("Successful Login");
        return {
          user: toUserResponse(user, {
            self: makeUserLink(user.userId, "self"),
            logout: { href: "/auth/logout", method: "POST" },
          }),
        };
      } catch (error: any) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "login",
        });
        console.log("Login Failed");

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Error logging in",
        });
      }
    }),

  logout: protectedRoute.mutation(async ({ ctx }) => {
    HTTPMetrics.track("POST", "/logout");

    const accessToken = ctx.cookies.accessToken;
    const refreshToken = ctx.cookies.refreshToken;

    if (!accessToken && !refreshToken) {
      ErrorCounter.add(1, {
        type: "auth",
        operation: "logout_no_tokens_found",
      });
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "No tokens to log out",
      });
    }

    const toBlacklist: string[] = [];
    if (accessToken) {
      toBlacklist.push(accessToken);
    }
    if (refreshToken) {
      toBlacklist.push(refreshToken);
    }

    if (toBlacklist.length > 0) {
      await tokenService.blacklistTokens(toBlacklist);
    }

    const isProd = process.env.NODE_ENV === "production";

    ctx.resHeaders.append(
      "Set-Cookie",
      serialize("accessToken", "", {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: -1, // Expire the cookie immediately
      }),
    );

    ctx.resHeaders.append(
      "Set-Cookie",
      serialize("refreshToken", "", {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        maxAge: -1, // Expire the cookie immediately
      }),
    );

    return { message: "Logout successful" };
  }),

  profile: protectedRoute.query(async ({ ctx }) => {
    HTTPMetrics.track("GET", "/profile");

    const userId = ctx.user.userId;

    try {
      const service = await getUserService();
      const userData = await service.getProfile(userId);

      return {
        ...userData,
        links: {
          self: makeUserLink(userId, "self"),
          changeEmail: makeUserLink(userId, "changeEmail"),
          changePassword: makeUserLink(userId, "changePassword"),
          changeUsername: makeUserLink(userId, "changeUsername"),
          logout: { href: `/api/auth/logout` },
        },
      };
    } catch (error: any) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "profile",
      });
      console.log("Failed to retrieve profile");

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Error retrieving profile",
      });
    }
  }),

  delete: protectedRoute
    .input(
      z.object({
        passwordOne: z.string(),
        passwordTwo: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", "/delete");
      const userId = ctx.user.userId;

      if (await RateLimiter.isRateLimited(ctx.ip, userId)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }

      if (input.passwordOne !== input.passwordTwo) {
        await RateLimiter.trackAttempt(ctx.ip, userId);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Passwords do not match",
        });
      }

      try {
        const userService = await getUserService();

        await userService.deleteUser(userId, input.passwordOne);

        const accessToken = ctx.cookies.accessToken;
        const refreshToken = ctx.cookies.refreshToken;

        const toBlacklist: string[] = [];
        if (accessToken) {
          toBlacklist.push(accessToken);
        }
        if (refreshToken) {
          toBlacklist.push(refreshToken);
        }

        if (toBlacklist.length > 0) {
          await tokenService.blacklistTokens(toBlacklist);
        }

        const isProd = process.env.NODE_ENV === "production";

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("accessToken", "", {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: -1,
          }),
        );
        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("refreshToken", "", {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: -1,
          }),
        );

        await RateLimiter.resetAttempts(ctx.ip, userId);
        return { message: "User has been permanently deleted" };
      } catch (error) {
        await RateLimiter.trackAttempt(ctx.ip, userId);
        ErrorCounter.add(1, {
          type: "internal",
          operation: "delete_user",
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error deleting user",
        });
      }
    }),
  changeEmail: protectedRoute
    .input(
      z.object({
        newEmail: z.string().email(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("PUT", "/change-email");
      const userId = ctx.user.userId;

      if (await RateLimiter.isRateLimited(ctx.ip, userId)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }

      try {
        const userService = await getUserService();

        await userService.updateEmail(userId, input.newEmail);

        await RateLimiter.resetAttempts(ctx.ip, userId);
        return { message: "User email has been updated" };
      } catch (error) {
        await RateLimiter.trackAttempt(ctx.ip, userId);
        if (error instanceof Error && error.message.includes("frequently")) {
          ErrorCounter.add(1, {
            type: "rate_limit",
            operation: "change_email",
          });
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "change_email",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Error updating email",
        });
      }
    }),
  changePassword: protectedRoute
    .input(
      z.object({
        oldPassword: z.string(),
        newPassword: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("PUT", "/change-password");
      const userId = ctx.user.userId;

      if (await RateLimiter.isRateLimited(ctx.ip, userId)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }

      if (input.newPassword === input.oldPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New password cannot be the same as the old password",
        });
      }

      try {
        const userService = await getUserService();

        await userService.changePassword(
          userId,
          input.newPassword,
          input.oldPassword,
        );

        await RateLimiter.resetAttempts(ctx.ip, userId);
        return { message: "User password has been updated" };
      } catch (error) {
        await RateLimiter.trackAttempt(ctx.ip, userId);
        if (error instanceof Error && error.message.includes("frequently")) {
          ErrorCounter.add(1, {
            type: "rate_limit",
            operation: "change_password",
          });
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "change_password",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Error updating password",
        });
      }
    }),
  updateUsername: protectedRoute
    .input(
      z.object({
        oldUsername: z.string(),
        newUsername: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("PUT", "/update-username");
      const userId = ctx.user.userId;

      if (await RateLimiter.isRateLimited(ctx.ip, userId)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        });
      }

      try {
        const userService = await getUserService();

        await userService.updateUsername(
          userId,
          input.oldUsername,
          input.newUsername,
        );

        await RateLimiter.resetAttempts(ctx.ip, userId);
        return { message: "User username has been updated" };
      } catch (error) {
        await RateLimiter.trackAttempt(ctx.ip, userId);
        if (error instanceof Error && error.message.includes("frequently")) {
          ErrorCounter.add(1, {
            type: "rate_limit",
            operation: "update_username",
          });
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "update_username",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Error updating username",
        });
      }
    }),
  enableTwoFactor: protectedRoute.mutation(async ({ ctx }) => {
    HTTPMetrics.track("POST", "/2fa/setup");
    const userId = ctx.user.userId;

    try {
      const userService = await getUserService();
      const user = await userService.findById(userId);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      if (user.twoFactorEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA already enabled",
        });
      }

      const { qrCode, uri } = await userService.enableTwoFactor(user.userId);

      return { qrCode, uri };
    } catch (error) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "setup_two_factor",
      });
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Error setting up 2FA",
      });
    }
  }),

  verifyTwoFactor: tempAuthRoute
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", "/2fa/verify");
      const userId = ctx.user.userId;

      try {
        const userService = await getUserService();
        const { verified } = await userService.verifyTwoFactor(
          userId,
          input.token,
        );

        if (!verified) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid verification code",
          });
        }

        const user = await userService.findById(userId);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const tokenPair = await tokenService.generateTokenPair(user);

        const isProd = process.env.NODE_ENV === "production";

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("accessToken", tokenPair.accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
          }),
        );

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("refreshToken", tokenPair.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
          }),
        );

        return { verified: true };
      } catch (error) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "verify_two_factor",
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Error verifying 2FA",
        });
      }
    }),

  disableTwoFactor: protectedRoute
    .input(z.object({ password: z.string(), totp: z.string() }))
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", "/2fa/disable");
      const userId = ctx.user.userId;

      try {
        const userService = await getUserService();
        await userService.disableTwoFactor(userId, input.totp, input.password);

        return { disable: true };
      } catch (error) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "disable_two_factor",
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Error disabling 2FA",
        });
      }
    }),

  useRecoveryCode: tempAuthRoute
    .input(z.object({ recoveryCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", "/2fa/recover");
      const userId = ctx.user.userId;

      try {
        const userService = await getUserService();
        const recovered = await userService.useRecoveryCode(
          userId,
          input.recoveryCode,
        );

        if (!recovered) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid recovery code",
          });
        }

        const user = await userService.findById(userId);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        const tokenPair = await tokenService.generateTokenPair(user);

        const isProd = process.env.NODE_ENV === "production";

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("accessToken", tokenPair.accessToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
          }),
        );

        ctx.resHeaders.append(
          "Set-Cookie",
          serialize("refreshToken", tokenPair.refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
          }),
        );

        return { recovered: true };
      } catch (error) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "use_recovery_code",
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Error using recovery code",
        });
      }
    }),
});
