import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { parse } from "cookie";
import { tokenService } from "@/services/token";

// init tRPC
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

// Context creation function
export const createTRPCContext = async (opts: FetchCreateContextFnOptions) => {
  const { req } = opts;
  const cookies = parse(req.headers.get("cookie") ?? "");
  const token = cookies.accessToken;

  if (!token) {
    return { user: null };
  }

  try {
    const userPayload = await tokenService.verifyToken(token);
    return { user: userPayload };
  } catch {
    return { user: null };
  }
};

// Middleware
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure; // Public route
export const protectedProcedure = t.procedure.use(isAuthenticated); // Private route
