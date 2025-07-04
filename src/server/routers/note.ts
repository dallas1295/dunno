import { router,  protectedRoute } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getNoteService, getUserService } from "@/config/service";

export const noteRouter = router({
  create: protectedRoute
    .input(
      z.object({
        name: z.string(),
        content: z.string(),
        tags: z.array(z.string()).optional(),
        isPinned: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      try {
        const userService = await getUserService();
        const validUser = await userService.findById(userId);
        if (!validUser) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User not found",
          });
        }

        const service = await getNoteService();
        const note = await service.createNote(
          userId,
          input.name,
          input.content,
          input.tags,
          input.isPinned,
        );
        return note;
      } catch (error) {
        console.error("Failed to create note:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create note",
        });
      }
    }),
});
