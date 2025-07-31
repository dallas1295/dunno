import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { parse } from "cookie";
import { tokenService, UserPayload } from "@/services/token";
import { getUserService } from "@/config/service";

// init tRPC
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

// Context creation function
export const createTRPCContext = async (opts: FetchCreateContextFnOptions) => {
  const { req, resHeaders } = opts;
  const cookies = parse(req.headers.get("cookie") ?? "");
  const token = cookies.accessToken;
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const context: {
    req: typeof req;
    resHeaders: typeof resHeaders;
    user: UserPayload | null;
    ip: string;
    cookies: Record<string, string | undefined>;
  } = {
    req,
    resHeaders,
    user: null,
    ip,
    cookies,
  };

  if (!token) {
    return context;
  }

  try {
    const userPayload = await tokenService.verifyToken(token);
    context.user = userPayload;
    return context;
  } catch {
    return context;
  }
};

const isTempAuthenticated = t.middleware(async ({ ctx, next }) => {
  const tempToken = ctx.req.headers.get("authorization")?.split(" ")[1];

  if (!tempToken) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No token provided" });
  }

  try {
    const userPayload = await tokenService.verifyTempToken(tempToken);
    return next({
      ctx: {
        ...ctx,
        user: userPayload,
      },
    });
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token" });
  }
});
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const userService = await getUserService();
  const validUser = await userService.findById(ctx.user.userId);

  if (!validUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const router = t.router;
export const publicRoute = t.procedure; // Public route
export const protectedRoute = t.procedure.use(isAuthenticated);
export const tempAuthRoute = t.procedure.use(isTempAuthenticated);
