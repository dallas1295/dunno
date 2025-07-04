import { router, protectedRoute } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getNoteService, getUserService } from "@/config/service";
import { toNoteResponse } from "@/dto/note";
import { makeNoteLink } from "@/utils/links";
import { ErrorCounter, HTTPMetrics } from "@/utils/otel";

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
      HTTPMetrics.track("POST", "/notes/create");
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

        const links = {
          self: makeNoteLink(note.noteId, "self"),
          update: makeNoteLink(note.noteId, "update"),
          delete: makeNoteLink(note.noteId, "delete"),
        };

        return toNoteResponse(note, links);
      } catch (error: any) {
        if (error.message === "Invalid note") {
          ErrorCounter.add(1, {
            type: "validation",
            operation: "create_note",
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "create_note",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create note",
        });
      }
    }),
});
