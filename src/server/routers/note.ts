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

        if (error.message === "Cannot delete pinned notes, unpin first please") {
          ErrorCounter.add(1, {
            type: "validation",
            operation: "delete_note",
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
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
  search: protectedRoute
    .input(
      z.object({
        query: z.string(),
        tags: z.array(z.string()),
        page: z.number(),
        pageSize: z.number(),
        sortBy: z.string(),
        sortOrder: z.enum(["asc", "desc"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      HTTPMetrics.track("GET", "/notes/search");
      const userId = ctx.user.userId;
      try {
        const noteService = await getNoteService();
        const results = await noteService.searchNotes({
          userId,
          query: input.query,
          tags: input.tags,
          page: input.page,
          pageSize: input.pageSize,
          sortBy: input.sortBy,
          sortOrder: input.sortOrder,
        });

        return results;
      } catch (error: any) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "search_notes",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to query notes",
        });
      }
    }),
  getNoteById: protectedRoute
    .input(
      z.object({
        noteId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      HTTPMetrics.track("GET", `/notes/${input.noteId}`);
      const userId = ctx.user.userId;

      try {
        const noteService = await getNoteService();
        const note = await noteService.getNote(userId, input.noteId);

        const links = {
          self: makeNoteLink(note.noteId, "self"),
          update: makeNoteLink(note.noteId, "update"),
          delete: makeNoteLink(note.noteId, "delete"),
        };

        return toNoteResponse(note, links);
      } catch (error: any) {
        if (error.message === "Note not found") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "get_note_by_id",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "get_note_by_id",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get note",
        });
      }
    }),

  archive: protectedRoute
    .input(
      z.object({
        noteId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      HTTPMetrics.track("POST", `/notes/archive/${input.noteId}`);
      const userId = ctx.user.userId;
      try {
        const service = await getNoteService();
        const newStatus = await service.archiveNote(userId, input.noteId);
        return { success: true, archived: newStatus };
      } catch (error: any) {
        if (error.message === "Note does not exist") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "archive_note",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "archive_note",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to archive note",
        });
      }
    }),

  getArchivedNotes: protectedRoute
    .input(
      z.object({
        page: z.number().min(1).optional().default(1),
        pageSize: z.number().min(1).max(100).optional().default(15),
        sortBy: z.string().optional().default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      HTTPMetrics.track("GET", "/notes/archived");
      const userId = ctx.user.userId;
      try {
        const service = await getNoteService();
        const result = await service.fetchArchivedNotes(
          userId,
          input.page,
          input.pageSize,
          input.sortBy,
          input.sortOrder,
        );
        return result;
      } catch (error: any) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "get_archived_notes",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch archived notes",
        });
      }
    }),

  getPinnedNotes: protectedRoute.query(async ({ ctx }) => {
    HTTPMetrics.track("GET", "/notes/pinned");
    const userId = ctx.user.userId;
    try {
      const service = await getNoteService();
      const notes = await service.getPinnedNotes(userId);
      return notes;
    } catch (error: any) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "get_pinned_notes",
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get pinned notes",
      });
    }
  }),

  togglePin: protectedRoute
    .input(
      z.object({
        noteId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      HTTPMetrics.track("POST", `/notes/pin/toggle/${input.noteId}`);
      const userId = ctx.user.userId;
      try {
        const service = await getNoteService();
        await service.togglePin(userId, input.noteId);
        return { success: true };
      } catch (error: any) {
        if (error.message === "Note not found") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "toggle_pin",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "toggle_pin",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle pin status",
        });
      }
    }),

  updatePinPosition: protectedRoute
    .input(
      z.object({
        noteId: z.string(),
        newPosition: z.number().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      HTTPMetrics.track("POST", `/notes/pin/position/${input.noteId}`);
      const userId = ctx.user.userId;
      try {
        const service = await getNoteService();
        await service.updatePinPosition(
          userId,
          input.noteId,
          input.newPosition,
        );
        return { success: true };
      } catch (error: any) {
        if (
          error.message === "There is no note" ||
          error.message === "Note is not pinned"
        ) {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "update_pin_position",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        if (error.message === "Invalid position") {
          ErrorCounter.add(1, {
            type: "validation",
            operation: "update_pin_position",
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "update_pin_position",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update pin position",
        });
      }
    }),

  getNoteTags: protectedRoute.query(async ({ ctx }) => {
    HTTPMetrics.track("GET", "/notes/tags");
    const userId = ctx.user.userId;
    try {
      const service = await getNoteService();
      const tags = await service.getNoteTags(userId);
      return tags;
    } catch (error: any) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "get_note_tags",
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get note tags",
      });
    }
  }),

  getNoteNames: protectedRoute.query(async ({ ctx }) => {
    HTTPMetrics.track("GET", "/notes/names");
    const userId = ctx.user.userId;
    try {
      const service = await getNoteService();
      const names = await service.getNoteNames(userId);
      return names;
    } catch (error: any) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "get_note_names",
      });

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get note names",
      });
    }
  }),
});
