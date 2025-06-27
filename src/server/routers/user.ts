import { router, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { tokenService } from "@/services/token";
import { getUserService } from "@/config/service";

export const userRouter = router({
  /**
   * Creates a new user. Publicly accessible.
   */
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const service = await getUserService();
        const user = await service.createUser(
          input.username,
          input.email,
          input.password,
        );
        return { success: true, userId: user.userId };
      } catch (error: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message,
        });
      }
    }),

  /**
   * Authenticates a user and returns a token pair. Publicly accessible.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const service = await getUserService();
      const user = await service.findByEmail(input.email);
      // NOTE: You need to add password verification logic here
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }
      const tokenPair = await tokenService.generateTokenPair(user);
      return tokenPair;
    }),

  /**
   * Gets the logged-in user's profile. Protected.
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const service = await getUserService();
    const userProfile = await service.getProfile(ctx.user.userId);
    if (!userProfile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return userProfile;
  }),

  /**
   * Changes the logged-in user's password. Protected.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        oldPassword: z.string(),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getUserService();
        await service.changePassword(
          ctx.user.userId,
          input.newPassword,
          input.oldPassword,
        );
        return { success: true };
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }
    }),

  /**
   * Starts the 2FA setup process. Protected.
   */
  enableTwoFactor: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const service = await getUserService();
      const result = await service.enableTwoFactor(ctx.user.userId);
      return result;
    } catch (error: any) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
  }),

  /**
   * Verifies the 2FA token and finalizes setup. Protected.
   */
  verifyTwoFactor: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getUserService();
        const result = await service.verifyTwoFactor(
          ctx.user.userId,
          input.token,
        );
        return result;
      } catch (error: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      }
    }),
});

