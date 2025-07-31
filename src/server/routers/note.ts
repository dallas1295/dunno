import { router, protectedRoute } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getNoteService } from "@/config/service";
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
      try {
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

  update: protectedRoute
    .input(
      z.object({
        noteId: z.string(),
        name: z.string().optional(),
        content: z.string().optional(),
        tags: z.array(z.string()).optional(),
        isPinned: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      HTTPMetrics.track("PUT", `/notes/update/${input.noteId}`);
      const userId = ctx.user.userId;
      const { noteId, ...updates } = input;

      try {
        const service = await getNoteService();
        const updatedNote = await service.updateNote(userId, noteId, updates);

        const links = {
          self: makeNoteLink(updatedNote.noteId, "self"),
          update: makeNoteLink(updatedNote.noteId, "update"),
          delete: makeNoteLink(updatedNote.noteId, "delete"),
        };

        return toNoteResponse(updatedNote, links);
      } catch (error: any) {
        if (error.message === "Note does not exist") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "update_note",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        if (error.message === "One or more update can't be done") {
          ErrorCounter.add(1, {
            type: "validation",
            operation: "update_note",
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "update_note",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update note",
        });
      }
    }),

  delete: protectedRoute
    .input(
      z.object({
        noteId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      HTTPMetrics.track("DELETE", `/notes/delete/${input.noteId}`);
      try {
        const service = await getNoteService();
        await service.deleteNote(userId, input.noteId);
        return { success: true };
      } catch (error: any) {
        if (error.message === "Note does not exist") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "delete_note",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "delete_note",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete note",
        });
      }
    }),
});
