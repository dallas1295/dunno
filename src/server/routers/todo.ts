import { router, protectedRoute } from "../trpc";
import { z } from "zod";
import { Priority, Pattern } from "@/models/todo";
import { TRPCError } from "@trpc/server";
import { getTodoService } from "@/config/service";
import { toTodoResponse } from "@/dto/todo";
import { makeTodoLink } from "@/utils/links";
import { ErrorCounter, HTTPMetrics } from "@/utils/otel";

const priorityEnum = z.enum(Object.keys(Priority) as [keyof typeof Priority]);
const patternEnum = z.enum(Object.keys(Pattern) as [keyof typeof Pattern]);

export const todoRouter = router({
  create: protectedRoute
    .input(
      z.object({
        todoName: z.string(),
        description: z.string(),
        tags: z.array(z.string()).default([]),
        priority: priorityEnum.optional(),
        dueDate: z.date().optional(),
        reminderAt: z.date().optional(),
        isRecurring: z.boolean().optional(),
        recurringPattern: patternEnum.optional(),
        reccurenceEnd: z.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", "/todos/create");
      const userId = ctx.user.userId;
      try {
        const todoService = await getTodoService();
        const todo = await todoService.createTodo(
          userId,
          input.todoName,
          input.description,
          input.tags,
          input.priority,
          input.dueDate,
          input.reminderAt,
          input.isRecurring,
          input.recurringPattern,
          input.reccurenceEnd,
        );

        const links = {
          self: makeTodoLink(todo.todoId, "self"),
          update: makeTodoLink(todo.todoId, "update"),
          delete: makeTodoLink(todo.todoId, "delete"),
        };

        return toTodoResponse(todo, links);
      } catch (error: any) {
        if (error.message === "Invalid todo") {
          ErrorCounter.add(1, {
            type: "validation",
            operation: "create_todo",
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "create_todo",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create todo",
        });
      }
    }),
  update: protectedRoute
    .input(
      z.object({
        todoId: z.string(),
        updates: z.object({
          todoName: z.string().optional(),
          description: z.string().optional(),
          tags: z.array(z.string()).optional(),
          priority: priorityEnum.optional(),
          dueDate: z.date().optional(),
          reminderAt: z.date().optional(),
          isRecurring: z.boolean().optional(),
          recurringPattern: patternEnum.optional(),
          recurrenceEnd: z.date().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      HTTPMetrics.track("POST", `/todos/update/${input.todoId}`);
      const userId = ctx.user.userId;
      try {
        const todoService = await getTodoService();
        const updatedTodo = await todoService.updateTodo(
          userId,
          input.todoId,
          input.updates,
        );

        const links = {
          self: makeTodoLink(updatedTodo.todoId, "self"),
          update: makeTodoLink(updatedTodo.todoId, "update"),
          delete: makeTodoLink(updatedTodo.todoId, "delete"),
        };

        return toTodoResponse(updatedTodo, links);
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error.message === "Todo does not exist") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "update_todo",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        if (error.message === "Todo not found") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "update_todo",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        if (error.message === "Invalid todo update") {
          ErrorCounter.add(1, {
            type: "validation",
            operation: "update_todo",
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "update_todo",
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to update todo",
        });
      }
    }),
  delete: protectedRoute
    .input(
      z.object({
        todoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      try {
        const todoService = await getTodoService();
        await todoService.deleteTodo(userId, input.todoId);
        return { success: true };
      } catch (error: any) {
        if (error.message === "Todo does not exist") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "delete_todo",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        if (error.message === "Todo not found") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "delete_todo",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }

        ErrorCounter.add(1, {
          type: "internal",
          operation: "delete_todo",
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete todo",
        });
      }
    }),

  searchTodos: protectedRoute
    .input(
      z.object({
        includeCompleted: z.boolean().optional(),
        onlyWithDueDate: z.boolean().optional(),
        onlyRecurring: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      HTTPMetrics.track("GET", "/todos/search");
      const userId = ctx.user.userId;
      try {
        const todoService = await getTodoService();
        const todos = await todoService.searchTodos(userId, input);
        return todos.map((todo) => {
          const links = {
            self: makeTodoLink(todo.todoId, "self"),
            update: makeTodoLink(todo.todoId, "update"),
            delete: makeTodoLink(todo.todoId, "delete"),
          };
          return toTodoResponse(todo, links);
        });
      } catch (error: any) {
        ErrorCounter.add(1, {
          type: "internal",
          operation: "search_todos",
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search todos",
        });
      }
    }),

  getTodoById: protectedRoute
    .input(
      z.object({
        todoId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      HTTPMetrics.track("GET", `/todos/${input.todoId}`);
      const userId = ctx.user.userId;
      try {
        const todoService = await getTodoService();
        const todo = await todoService.getTodo(userId, input.todoId);
        const links = {
          self: makeTodoLink(todo.todoId, "self"),
          update: makeTodoLink(todo.todoId, "update"),
          delete: makeTodoLink(todo.todoId, "delete"),
        };
        return toTodoResponse(todo, links);
      } catch (error: any) {
        if (error.message === "Todo does not exist") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "get_todo_by_id",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }
        ErrorCounter.add(1, {
          type: "internal",
          operation: "get_todo_by_id",
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get todo",
        });
      }
    }),

  getTodoStats: protectedRoute.query(async ({ ctx }) => {
    HTTPMetrics.track("GET", "/todos/stats");
    const userId = ctx.user.userId;
    try {
      const todoService = await getTodoService();
      return await todoService.getTodoStats(userId);
    } catch (error: any) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "get_todo_stats",
      });
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get todo stats",
      });
    }
  }),

  getTodoTags: protectedRoute.query(async ({ ctx }) => {
    HTTPMetrics.track("GET", "/todos/tags");
    const userId = ctx.user.userId;
    try {
      const todoService = await getTodoService();
      return await todoService.getTodoTags(userId);
    } catch (error: any) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "get_todo_tags",
      });
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get todo tags",
      });
    }
  }),

  toggleComplete: protectedRoute
    .input(
      z.object({
        todoId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      HTTPMetrics.track("POST", `/todos/toggle/${input.todoId}`);
      const userId = ctx.user.userId;
      try {
        const todoService = await getTodoService();
        const updatedTodo = await todoService.toggleComplete(
          userId,
          input.todoId,
        );
        const links = {
          self: makeTodoLink(updatedTodo.todoId, "self"),
          update: makeTodoLink(updatedTodo.todoId, "update"),
          delete: makeTodoLink(updatedTodo.todoId, "delete"),
        };
        return toTodoResponse(updatedTodo, links);
      } catch (error: any) {
        if (error.message === "Could not find todo") {
          ErrorCounter.add(1, {
            type: "not_found",
            operation: "toggle_complete",
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
          });
        }
        ErrorCounter.add(1, {
          type: "internal",
          operation: "toggle_complete",
        });
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle todo",
        });
      }
    }),

  countTodos: protectedRoute.query(async ({ ctx }) => {
    HTTPMetrics.track("GET", "/todos/count");
    const userId = ctx.user.userId;
    try {
      const todoService = await getTodoService();
      const count = await todoService.countTodos(userId);
      return { count };
    } catch (error: any) {
      ErrorCounter.add(1, {
        type: "internal",
        operation: "count_todos",
      });
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to count todos",
      });
    }
  }),
});
