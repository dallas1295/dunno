import { router } from "@/server/trpc";
import { userRouter } from "@/server/routers/user";
import { noteRouter } from "@/server/routers/note";
import { todoRouter } from "@/server/routers/todo";

export const appRouter = router({
  user: userRouter,
  note: noteRouter,
  todo: todoRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
