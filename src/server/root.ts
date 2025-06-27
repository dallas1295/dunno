import { router } from "@/server/trpc";
import { userRouter } from "@/server/routers/user";
import { noteRouter } from "@/server/routers/note";

export const appRouter = router({
  user: userRouter,
  note: noteRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
